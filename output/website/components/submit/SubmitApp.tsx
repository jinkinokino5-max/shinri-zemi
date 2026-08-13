'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import {
  FIELDS,
  KIND_LABEL,
  OP_BADGE,
  needsConsent,
  type Kind,
  type Op,
} from '@/lib/submission/fields';
import type { PublishedEntry } from '@/lib/submission/published';
import { hasErrors, validate, type Errors } from '@/lib/submission/validate';
import { canSubmit, type Member } from '@/lib/submission/useMember';
import { AuthGate } from './AuthGate';
import { FieldInput, type BelongsToOption } from './FieldInput';
import { KeepPhotos, type KeptImage } from './KeepPhotos';
import { PhotoInput, type UploadedImage } from './PhotoInput';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   投稿画面
   根拠：draft/ロードマップ.md 6-1「投稿画面で編集できるもの」
        ／ supabase/migrations/0003_edit_delete.sql（直す・消すの提案）

   ⚠ ここで編集できるのは「中身」だけ。「見た目」は編集できない。
     色・書体・余白・レイアウト・題字・ナビ・フッター、そして
     「北海道大学の公認サークルではありません」の一文は、この画面に無い。
     無いのは作り忘れではなく、決定事項である（6-1 の最後の表）。

   ⚠ 投稿しただけでは公開されない。代表が確認してから公開される（F-8）。
     この一文は画面にも出す。出さないと「送ったのに載らない」と受け取られる。

   ⚠ 「直す」「消す」も同じ道を通る（0003）。
     押した時点では、サイトは1文字も変わらない。変わるのは代表が承認した後。
     この画面には「消す」ボタンに見えるものがあるが、どれも提案である。
     取り違えると事故になるので、文言から「消えます」を排除している。
   ══════════════════════════════════════════════════════════════════ */

type Row = {
  id: string;
  kind: Kind;
  op: Op;
  state: 'draft' | 'pending' | 'returned' | 'published';
  target_slug: string | null;
  data: Record<string, unknown>;
  images: UploadedImage[];
  delete_reason: string | null;
  review_note: string | null;
  updated_at: string;
};

const STATE_JA: Record<Row['state'], string> = {
  draft: '下書き',
  pending: '代表の確認待ち',
  returned: '差し戻し',
  published: '反映済み',
};

/** 画面の上のタブ。⚠ 「消す」を独立したタブにしない。
 *  対象を選ばずに削除の話を始められる画面は、押し間違いを誘う。 */
type Mode = 'create' | 'change';

export function SubmitApp({
  options,
  entries,
}: {
  options: BelongsToOption[];
  entries: PublishedEntry[];
}) {
  return (
    <AuthGate>
      {({ member }) => <Inner member={member} options={options} entries={entries} />}
    </AuthGate>
  );
}

function Inner({
  member,
  options,
  entries,
}: {
  member: Member;
  options: BelongsToOption[];
  entries: PublishedEntry[];
}) {
  const supabase = getSupabase()!;

  const kinds = useMemo(
    () => (['work', 'club', 'project', 'event'] as Kind[]).filter((k) => canSubmit(member, k)),
    [member],
  );

  const [mode, setMode] = useState<Mode>('create');
  const [op, setOp] = useState<Op>('create');
  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'work');
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [id, setId] = useState(() => crypto.randomUUID());
  const [data, setData] = useState<Record<string, unknown>>({});
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [keepImages, setKeepImages] = useState<KeptImage[]>([]);
  const [deleteReason, setDeleteReason] = useState('');
  const [consent, setConsent] = useState({ publish: false, portrait: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<Row[]>([]);

  const loadMine = async () => {
    const { data: rows } = await supabase
      .from('submissions')
      .select(
        'id, kind, op, state, target_slug, data, images, delete_reason, review_note, updated_at',
      )
      .order('updated_at', { ascending: false });
    setMine((rows ?? []) as Row[]);
  };

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 入力を空に戻す。⚠ 対象（targetSlug）も必ず一緒に消す。
   *  残すと、別のものを直したつもりが前の対象に書き込まれる。 */
  const reset = (nextOp: Op = 'create') => {
    setId(crypto.randomUUID());
    setOp(nextOp);
    setTargetSlug(null);
    setData({});
    setImages([]);
    setKeepImages([]);
    setDeleteReason('');
    setConsent({ publish: false, portrait: false });
    setErrors({});
  };

  /** 公開中のものを選ぶ。中身を入力欄に写す。 */
  const pick = (slug: string, nextOp: Op) => {
    const e = entries.find((x) => `${x.kind}:${x.slug}` === slug);
    if (!e) return reset(nextOp);
    setId(crypto.randomUUID());
    setOp(nextOp);
    setKind(e.kind);
    setTargetSlug(e.slug);
    setData({ ...e.data });
    setImages([]);
    setKeepImages(e.images.map((im) => ({ ...im })));
    setDeleteReason('');
    setConsent({ publish: false, portrait: false });
    setErrors({});
    setMessage('');
  };

  /** 下書き・差し戻しを編集用に読み込む。 */
  const edit = (row: Row) => {
    const { keepImages: kept, ...rest } = (row.data ?? {}) as {
      keepImages?: KeptImage[];
    } & Record<string, unknown>;
    setId(row.id);
    setKind(row.kind);
    setOp(row.op);
    setMode(row.op === 'create' ? 'create' : 'change');
    setTargetSlug(row.target_slug);
    setData(rest);
    setImages(row.images ?? []);
    setKeepImages(kept ?? []);
    setDeleteReason(row.delete_reason ?? '');
    setConsent({ publish: false, portrait: false });
    setErrors({});
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 保存する。
   * @param submit true なら代表に提出する（pending）。false なら下書き。
   *
   * ⚠ 部活・PJ を新しく作る投稿は target_slug が要る。
   *   作品・イベントの新規は、代表が承認画面で slug を決める
   *   （公開後にURLが変わらないようにするため）。
   *   直す・消す提案は、対象を選んだ時点で slug が決まっている。
   */
  const save = async (submit: boolean) => {
    setMessage('');

    if (op !== 'create' && !targetSlug) {
      setMessage('どれを直す／消すのかを選んでください。');
      return;
    }

    if (submit) {
      const e = validate(kind, data, consent, op, deleteReason);
      setErrors(e);
      if (hasErrors(e)) {
        setMessage('入力に足りないところがあります。赤い文の欄を見てください。');
        return;
      }
    }

    setBusy(true);
    try {
      // 部活・PJ の新規は「自分の担当のもの」なので、slug が最初から決まる。
      const ownSlug =
        op !== 'create'
          ? targetSlug
          : kind === 'club'
            ? (member.club_slugs[0] ?? null)
            : kind === 'project'
              ? (member.project_slugs[0] ?? null)
              : null;

      // ⚠ keepImages は data の中に入れて運ぶ。
      //   フロントマターには出さない（to-markdown.ts が除外している）。
      const payload =
        op === 'delete' ? {} : keepImages.length > 0 ? { ...data, keepImages } : { ...data };

      const { error } = await supabase.from('submissions').upsert({
        id,
        kind,
        op,
        author: member.user_id,
        state: submit ? 'pending' : 'draft',
        target_slug: ownSlug,
        data: payload,
        images: op === 'delete' ? [] : images,
        delete_reason: op === 'delete' ? deleteReason.trim() : null,
        consent_publish: consent.publish,
        consent_portrait: consent.portrait,
      });
      if (error) throw new Error(error.message);

      setMessage(
        submit
          ? op === 'delete'
            ? '消す提案を出しました。代表が確認するまで、サイトからは消えません。'
            : '提出しました。代表が確認したあとに反映されます。結果はこの画面の下に出ます。'
          : '下書きとして保存しました。まだ代表には見えていません。',
      );
      if (submit) {
        reset(op === 'create' ? 'create' : op);
        if (op !== 'create') setMode('change');
      }
      await loadMine();
    } catch (x) {
      setMessage(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };

  if (kinds.length === 0) {
    return <p className={s.note}>いまのあなたの権限では、投稿できるものがありません。</p>;
  }

  const fields = FIELDS[kind];
  const picked = targetSlug ? entries.find((e) => e.kind === kind && e.slug === targetSlug) : null;

  return (
    <>
      {/* ⚠ この一文を消さない。「送ったのに載らない」という誤解は、
            運用の不信につながる。最初に書いておく（F-8）。 */}
      <p className={s.notice}>
        投稿・変更・削除のどれも、出しただけでは反映されません。
        <b>代表が確認してから反映されます。</b>
      </p>

      {/* ── 何をしに来たか ── */}
      <div className={s.field}>
        <span className={s.label}>何をしますか</span>
        <div className={s.tabs} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'create'}
            className={mode === 'create' ? `${s.tab} ${s.tabOn}` : s.tab}
            onClick={() => {
              setMode('create');
              setKind(kinds[0] ?? 'work');
              reset('create');
            }}
          >
            新しく載せる
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'change'}
            className={mode === 'change' ? `${s.tab} ${s.tabOn}` : s.tab}
            onClick={() => {
              setMode('change');
              reset('update');
            }}
          >
            いま載っているものを直す・消す
          </button>
        </div>
      </div>

      {mode === 'create' && kinds.length > 1 && (
        <div className={s.field}>
          <span className={s.label}>何を投稿しますか</span>
          <div className={s.tabs} role="tablist">
            {kinds.map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={k === kind}
                className={k === kind ? `${s.tab} ${s.tabOn}` : s.tab}
                onClick={() => {
                  setKind(k);
                  reset('create');
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      {mode === 'change' && (
        <TargetPicker
          entries={entries}
          value={targetSlug ? `${kind}:${targetSlug}` : ''}
          op={op}
          onPick={pick}
          onOp={(next) => {
            setOp(next);
            setErrors({});
            setMessage('');
          }}
        />
      )}

      {/* 対象を選ぶまでは入力欄を出さない。
          ⚠ 空のフォームを先に見せると、対象を選ばずに書き始めて全部消える。 */}
      {(mode === 'create' || picked) && (
        <form
          className={s.form}
          onSubmit={(e) => {
            e.preventDefault();
            save(true);
          }}
        >
          {op === 'delete' ? (
            <DeleteForm
              entry={picked!}
              reason={deleteReason}
              error={errors.deleteReason}
              onChange={setDeleteReason}
            />
          ) : (
            <>
              {picked && (
                <p className={s.note}>
                  <b>{picked.label}</b> の内容を直します。公開先の URL（{picked.href}）は変わりません。
                  {/* ⚠ 静的サイトなので、ここに出ている内容はビルド時点のもの。隠さない。 */}
                  <br />
                  ここに入っているのは、いまサイトに出ている内容です。直したいところだけ書き換えてください。
                </p>
              )}

              {fields.map((f) => (
                <FieldInput
                  key={f.key}
                  field={f}
                  value={data[f.key]}
                  error={errors[f.key]}
                  options={options}
                  onChange={(v) => setData((d) => ({ ...d, [f.key]: v }))}
                />
              ))}

              <KeepPhotos images={keepImages} onChange={setKeepImages} />

              <PhotoInput
                userId={member.user_id}
                submissionId={id}
                images={images}
                onChange={setImages}
                label={keepImages.length > 0 ? '写真を足す' : undefined}
              />

              {needsConsent(kind, op) && (
                <fieldset className={s.consent}>
                  <legend className={s.label}>確認</legend>
                  {/* ⚠ ロードマップ 6-1：このチェックボックスは「外せない」。
                        外したまま提出できない、という形で実装している。
                        データベース側の制約でも同じことを担保している。 */}
                  <label className={s.check}>
                    <input
                      type="checkbox"
                      checked={consent.publish}
                      onChange={(e) => setConsent((c) => ({ ...c, publish: e.target.checked }))}
                    />
                    この作品をサイトに載せることに同意します。
                  </label>
                  {errors.consent_publish && <p className={s.error}>{errors.consent_publish}</p>}

                  <label className={s.check}>
                    <input
                      type="checkbox"
                      checked={consent.portrait}
                      onChange={(e) => setConsent((c) => ({ ...c, portrait: e.target.checked }))}
                    />
                    写真に他の人が写っている場合、その人の許可を取りました。
                  </label>
                  {errors.consent_portrait && <p className={s.error}>{errors.consent_portrait}</p>}
                </fieldset>
              )}
            </>
          )}

          {message && (
            <p className={s.message} role="status">
              {message}
            </p>
          )}

          <div className={s.row}>
            <button className={s.primary} disabled={busy}>
              {busy
                ? '送っています…'
                : op === 'delete'
                  ? '消す提案を代表に出す'
                  : op === 'update'
                    ? '直す提案を代表に出す'
                    : '代表に提出する'}
            </button>
            <button
              type="button"
              className={s.secondary}
              disabled={busy}
              onClick={() => save(false)}
            >
              下書きとして保存
            </button>
          </div>
        </form>
      )}

      <MySubmissions rows={mine} onEdit={edit} />
    </>
  );
}

/* ── 直す・消す対象を選ぶ ────────────────────────── */

function TargetPicker({
  entries,
  value,
  op,
  onPick,
  onOp,
}: {
  entries: PublishedEntry[];
  value: string;
  op: Op;
  onPick: (key: string, op: Op) => void;
  onOp: (op: Op) => void;
}) {
  const groups: { kind: Kind; label: string }[] = [
    { kind: 'work', label: '作品' },
    { kind: 'club', label: '部活' },
    { kind: 'project', label: 'PJ' },
    { kind: 'event', label: 'イベント' },
  ];

  return (
    <>
      <div className={s.field}>
        <label className={s.label} htmlFor="target">
          どれを直しますか・消しますか
        </label>
        {/* ⚠ 「誰でも提案できる」ことを最初に書く。書かないと、
              自分の投稿以外は触ってはいけないと受け取られて、
              間違いが放置される（0003 の設計理由そのもの）。 */}
        <p className={s.hint}>
          自分が出したものでなくても、直す・消す提案は出せます。
          反映されるのは代表が承認したときだけなので、気づいたら出してください。
        </p>
        <select
          id="target"
          className={s.input}
          value={value}
          onChange={(e) => onPick(e.target.value, op === 'create' ? 'update' : op)}
        >
          <option value="">選んでください</option>
          {groups.map((g) => {
            const list = entries.filter((e) => e.kind === g.kind);
            if (list.length === 0) return null;
            return (
              <optgroup key={g.kind} label={g.label}>
                {list.map((e) => (
                  <option key={`${e.kind}:${e.slug}`} value={`${e.kind}:${e.slug}`}>
                    {e.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>

      {value && (
        <div className={s.field}>
          <span className={s.label}>どうしますか</span>
          <fieldset className={s.radioSet}>
            <label className={s.radio}>
              <input
                type="radio"
                name="op"
                checked={op === 'update'}
                onChange={() => onOp('update')}
              />
              内容を直す
            </label>
            <label className={s.radio}>
              <input
                type="radio"
                name="op"
                checked={op === 'delete'}
                onChange={() => onOp('delete')}
              />
              サイトから消す
            </label>
          </fieldset>
        </div>
      )}
    </>
  );
}

/* ── 消す提案 ──────────────────────────────────── */

function DeleteForm({
  entry,
  reason,
  error,
  onChange,
}: {
  entry: PublishedEntry;
  reason: string;
  error?: string;
  onChange: (v: string) => void;
}) {
  return (
    <>
      <p className={s.notice}>
        <b>{entry.label}</b>（{entry.href}）を、サイトから消す提案です。
        <br />
        いま押しても消えません。代表が承認したときに消えます。
      </p>

      {/* ⚠ 部活・PJ・イベントの削除は、紐づく作品のリンクを切る。
            ここでは件数まで出さない（ビルド時点の一覧しか手元に無いため、
            断定できない数字を出すことになる）。判断材料は代表の画面に出す。 */}
      {entry.kind !== 'work' && (
        <p className={s.note}>
          ⚠ この {KIND_LABEL[entry.kind]} に紐づく作品があると、その作品の所属先が
          行方不明になります。<b>「終了」に切り替えるだけで済まないか</b>、
          もう一度考えてみてください。終了にしてもページは消えず、表示が変わるだけです。
        </p>
      )}

      <div className={s.field}>
        <label className={s.label} htmlFor="delete-reason">
          なぜ消すのか
          <span className={s.required}>必須</span>
        </label>
        <p className={s.hint}>
          代表がこれだけを見て判断します。
          あとから「なぜ消えたのか」を調べる人にも、この文が残ります。
        </p>
        <textarea
          id="delete-reason"
          className={error ? `${s.input} ${s.textarea} ${s.inputInvalid}` : `${s.input} ${s.textarea}`}
          rows={4}
          value={reason}
          onChange={(e) => onChange(e.target.value)}
        />
        {error && (
          <p className={s.error} role="alert">
            {error}
          </p>
        )}
      </div>
    </>
  );
}

/* ── 自分が出したもの ───────────────────────────── */

function MySubmissions({ rows, onEdit }: { rows: Row[]; onEdit: (r: Row) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className={s.mine}>
      <h2 className={s.h2}>あなたが出したもの</h2>
      <ul className={s.mineList}>
        {rows.map((r) => (
          <li key={r.id} className={s.mineItem}>
            <div>
              <b>
                {String(
                  r.data?.title ?? r.data?.name ?? r.target_slug ?? '（名前がまだ）',
                )}
              </b>
              <span className={s.meta}>
                {OP_BADGE[r.op ?? 'create']} ／ {KIND_LABEL[r.kind]} ／ {STATE_JA[r.state]}
              </span>
              {r.op === 'delete' && r.delete_reason && (
                <p className={s.note}>消す理由：{r.delete_reason}</p>
              )}
              {/* ⚠ 差し戻しの理由は必ず投稿者に見せる。理由の分からない差し戻しは、
                    二度と投稿しない理由になる。 */}
              {r.state === 'returned' && r.review_note && (
                <p className={s.returned}>代表より：{r.review_note}</p>
              )}
            </div>
            {(r.state === 'draft' || r.state === 'returned') && (
              <button type="button" className={s.linkBtn} onClick={() => onEdit(r)}>
                続きを書く
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
