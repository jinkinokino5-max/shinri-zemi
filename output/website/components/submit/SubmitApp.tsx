'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { FIELDS, KIND_LABEL, NEEDS_CONSENT, type Kind } from '@/lib/submission/fields';
import { hasErrors, validate, type Errors } from '@/lib/submission/validate';
import { canSubmit, type Member } from '@/lib/submission/useMember';
import { AuthGate } from './AuthGate';
import { FieldInput, type BelongsToOption } from './FieldInput';
import { PhotoInput, type UploadedImage } from './PhotoInput';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   投稿画面
   根拠：draft/ロードマップ.md 6-1「投稿画面で編集できるもの」

   ⚠ ここで編集できるのは「中身」だけ。「見た目」は編集できない。
     色・書体・余白・レイアウト・題字・ナビ・フッター、そして
     「北海道大学の公認サークルではありません」の一文は、この画面に無い。
     無いのは作り忘れではなく、決定事項である（6-1 の最後の表）。

   ⚠ 投稿しただけでは公開されない。代表が確認してから公開される（F-8）。
     この一文は画面にも出す。出さないと「送ったのに載らない」と受け取られる。
   ══════════════════════════════════════════════════════════════════ */

type Row = {
  id: string;
  kind: Kind;
  state: 'draft' | 'pending' | 'returned' | 'published';
  target_slug: string | null;
  data: Record<string, unknown>;
  images: UploadedImage[];
  review_note: string | null;
  updated_at: string;
};

const STATE_JA: Record<Row['state'], string> = {
  draft: '下書き',
  pending: '代表の確認待ち',
  returned: '差し戻し',
  published: '公開済み',
};

export function SubmitApp({ options }: { options: BelongsToOption[] }) {
  return (
    <AuthGate>
      {({ member }) => <Inner member={member} options={options} />}
    </AuthGate>
  );
}

function Inner({ member, options }: { member: Member; options: BelongsToOption[] }) {
  const supabase = getSupabase()!;

  const kinds = useMemo(
    () => (['work', 'club', 'project', 'event'] as Kind[]).filter((k) => canSubmit(member, k)),
    [member],
  );

  const [kind, setKind] = useState<Kind>(kinds[0] ?? 'work');
  const [id, setId] = useState(() => crypto.randomUUID());
  const [data, setData] = useState<Record<string, unknown>>({});
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [consent, setConsent] = useState({ publish: false, portrait: false });
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [mine, setMine] = useState<Row[]>([]);

  const loadMine = async () => {
    const { data: rows } = await supabase
      .from('submissions')
      .select('id, kind, state, target_slug, data, images, review_note, updated_at')
      .order('updated_at', { ascending: false });
    setMine((rows ?? []) as Row[]);
  };

  useEffect(() => {
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 新規の入力に戻す。 */
  const reset = () => {
    setId(crypto.randomUUID());
    setData({});
    setImages([]);
    setConsent({ publish: false, portrait: false });
    setErrors({});
  };

  /** 下書き・差し戻しを編集用に読み込む。 */
  const edit = (row: Row) => {
    setId(row.id);
    setKind(row.kind);
    setData(row.data ?? {});
    setImages(row.images ?? []);
    setConsent({ publish: false, portrait: false });
    setErrors({});
    setMessage('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * 保存する。
   * @param submit true なら代表に提出する（pending）。false なら下書き。
   *
   * ⚠ 部活・PJ を更新する投稿は target_slug が要る。
   *   作品・イベントの新規は、代表が承認画面で slug を決める
   *   （公開後にURLが変わらないようにするため）。
   */
  const save = async (submit: boolean) => {
    setMessage('');

    if (submit) {
      const e = validate(kind, data, consent);
      setErrors(e);
      if (hasErrors(e)) {
        setMessage('入力に足りないところがあります。赤い文の欄を見てください。');
        return;
      }
    }

    setBusy(true);
    try {
      // 部活・PJ は「自分の担当のもの」を更新する投稿なので、slug が最初から決まる。
      const ownSlug =
        kind === 'club'
          ? member.club_slugs[0]
          : kind === 'project'
            ? member.project_slugs[0]
            : null;

      const { error } = await supabase.from('submissions').upsert({
        id,
        kind,
        author: member.user_id,
        state: submit ? 'pending' : 'draft',
        target_slug: ownSlug,
        data,
        images,
        consent_publish: consent.publish,
        consent_portrait: consent.portrait,
      });
      if (error) throw new Error(error.message);

      setMessage(
        submit
          ? '提出しました。代表が確認したあとに公開されます。結果はこの画面の下に出ます。'
          : '下書きとして保存しました。まだ代表には見えていません。',
      );
      if (submit) reset();
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

  return (
    <>
      {/* ⚠ この一文を消さない。「送ったのに載らない」という誤解は、
            運用の不信につながる。最初に書いておく（F-8）。 */}
      <p className={s.notice}>
        投稿しただけでは公開されません。<b>代表が確認してから公開されます。</b>
      </p>

      {kinds.length > 1 && (
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
                  reset();
                }}
              >
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        className={s.form}
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
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

        <PhotoInput
          userId={member.user_id}
          submissionId={id}
          images={images}
          onChange={setImages}
        />

        {NEEDS_CONSENT[kind] && (
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

        {message && (
          <p className={s.message} role="status">
            {message}
          </p>
        )}

        <div className={s.row}>
          <button className={s.primary} disabled={busy}>
            {busy ? '送っています…' : '代表に提出する'}
          </button>
          <button type="button" className={s.secondary} disabled={busy} onClick={() => save(false)}>
            下書きとして保存
          </button>
        </div>
      </form>

      <MySubmissions rows={mine} onEdit={edit} />
    </>
  );
}

function MySubmissions({ rows, onEdit }: { rows: Row[]; onEdit: (r: Row) => void }) {
  if (rows.length === 0) return null;
  return (
    <section className={s.mine}>
      <h2 className={s.h2}>あなたの投稿</h2>
      <ul className={s.mineList}>
        {rows.map((r) => (
          <li key={r.id} className={s.mineItem}>
            <div>
              <b>{String(r.data?.title ?? r.data?.name ?? '（名前がまだ）')}</b>
              <span className={s.meta}>
                {KIND_LABEL[r.kind]} ／ {STATE_JA[r.state]}
              </span>
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
