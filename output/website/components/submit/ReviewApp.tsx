'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase, PUBLISH_FUNCTION_URL } from '@/lib/supabase/client';
import {
  FIELDS,
  KIND_LABEL,
  OP_BADGE,
  kindHref,
  type Kind,
  type Op,
} from '@/lib/submission/fields';
import { validate, hasErrors, type Errors } from '@/lib/submission/validate';
import type { DependentMap, PublishedEntry } from '@/lib/submission/published';
import { asset } from '@/lib/asset';
import type { Focus } from '@/lib/schema';
import { AuthGate } from './AuthGate';
import { FieldInput, type BelongsToOption } from './FieldInput';
import { DEFAULT_FOCUS, PhotoFraming } from './PhotoFraming';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   代表による公開前レビューの画面
   根拠：draft/ロードマップ.md 6-D ／ 5-C-0 ②（確認の負担を機械で肩代わりする）
        ／ supabase/migrations/0003_edit_delete.sql（直す・消すの承認）

   ⚠ この画面に出すのは「人にしか判断できないこと」だけにする。
     機械が判定できることは、すでに機械が済ませている：
       ・独自ページのJS混入・外部参照・容量 → scripts/check-custom-pages.mjs
       ・h1・alt・リンク切れ・非公認の一文  → scripts/check-content.mjs
       ・入力の形式・必須項目・同意          → lib/submission/validate.ts ＋ RLS
       ・削除で行き場を失う作品の有無        → lib/submission/published.ts（下で使う）
     代表に残るのは、写真の許可・拾い画像・掲載ポリシー・団体としての判断。

     ⚠ 5-C-0 の警告：「人の目だけに頼ると必ず形骸化します。
       形骸化した確認は、無いより危険です」。項目を増やすときはこれを思い出すこと。

   ⚠ この画面から出せる操作は3つだけ：反映する／差し戻す／（何もしない）。
     投稿そのものを消すボタンは無い（6-1）。差し戻しは記録が残るが、
     削除は記録が残らないので、記録が残る側だけを用意している。

   ⚠ 2026-08-16 追加：代表は中身の文章そのものをここで直せる。
     差し戻して書き直してもらう往復が、誤字レベルの直しにも毎回発生していた
     （団体からの指摘）。代表が直接直した内容は、そのまま「公開する」で
     GitHub に書き込まれる。⚠ 直した内容は投稿者には通知されない。
     投稿の趣旨そのものを変えるような直しは、差し戻して理由を書くこと。
   ══════════════════════════════════════════════════════════════════ */

type Row = {
  id: string;
  kind: Kind;
  op: Op;
  state: string;
  target_slug: string | null;
  data: Record<string, unknown>;
  images: { path: string; alt: string; focus?: Focus }[];
  delete_reason: string | null;
  consent_publish: boolean;
  consent_portrait: boolean;
  updated_at: string;
  author: string;
};

/** 代表が目で見るべきこと。ロードマップ 5-C-0 の右列そのもの。 */
const HUMAN_CHECKS = [
  '写っている人の許可は取れているか',
  '拾い画像・他人の著作物が無いか',
  '掲載ポリシー（B-1〜B-5）に反していないか',
  '内容が団体として出して問題ないか',
];

/** 消すときに確かめること。
 *  ⚠ 上の4つを流用しない。消すときに問われるのは中身の可否ではなく、
 *    「消してよいのか」「消さずに済まないか」である。 */
const DELETE_CHECKS = [
  '消す理由に納得できるか',
  '「終了」に切り替えるだけでは済まないか（終了ならページは残る）',
  '消したものは元に戻らない（作り直しになる）と分かっているか',
];

const SLUG_RE = /^[a-z0-9-]+$/;

export function ReviewApp({
  entries,
  dependents,
  options,
}: {
  entries: PublishedEntry[];
  dependents: DependentMap;
  options: BelongsToOption[];
}) {
  return (
    <AuthGate requireRep>
      {({ accessToken }) => (
        <Inner accessToken={accessToken} entries={entries} dependents={dependents} options={options} />
      )}
    </AuthGate>
  );
}

function Inner({
  accessToken,
  entries,
  dependents,
  options,
}: {
  accessToken: string;
  entries: PublishedEntry[];
  dependents: DependentMap;
  options: BelongsToOption[];
}) {
  const supabase = getSupabase()!;
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('state', 'pending')
      .order('updated_at', { ascending: true }); // 古いものから。待たせている順。
    setRows((data ?? []) as Row[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <p className={s.note}>読み込んでいます…</p>;

  if (rows.length === 0) {
    return <p className={s.note}>確認待ちの投稿はありません。</p>;
  }

  return (
    <>
      <p className={s.notice}>
        確認待ち <b>{rows.length}</b> 件。古いものから並んでいます。
      </p>
      {rows.map((row) => (
        <ReviewCard
          key={row.id}
          row={row}
          accessToken={accessToken}
          entries={entries}
          dependents={dependents}
          options={options}
          onDone={load}
        />
      ))}
    </>
  );
}

function ReviewCard({
  row,
  accessToken,
  entries,
  dependents,
  options,
  onDone,
}: {
  row: Row;
  accessToken: string;
  entries: PublishedEntry[];
  dependents: DependentMap;
  options: BelongsToOption[];
  onDone: () => void;
}) {
  const supabase = getSupabase()!;
  const op: Op = row.op ?? 'create';
  const [slug, setSlug] = useState(row.target_slug ?? '');
  const [note, setNote] = useState('');
  const checks = op === 'delete' ? DELETE_CHECKS : HUMAN_CHECKS;
  const [checked, setChecked] = useState<boolean[]>(checks.map(() => false));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});
  // ⚠ row.data の複製。photos など FIELDS に無いキーもそのまま持ち回る。
  //   FIELDS の項目だけをここで直接書き換える（下の dl を参照）。
  const [data, setData] = useState<Record<string, unknown>>({ ...row.data });
  const [fieldErrors, setFieldErrors] = useState<Errors>({});

  /** いまサイトに出ている内容。⚠ ビルド時点のもの。 */
  const before = entries.find((e) => e.kind === row.kind && e.slug === row.target_slug) ?? null;

  /** 消すと所属先を失う作品。⚠ ここが空でないと反映できない。 */
  const orphans = op === 'delete' && row.kind !== 'work'
    ? (dependents[`${row.kind}:${row.target_slug}`] ?? [])
    : [];

  useEffect(() => {
    (async () => {
      const next: Record<string, string> = {};
      for (const im of row.images ?? []) {
        const { data } = await supabase.storage.from('submissions').createSignedUrl(im.path, 900);
        if (data?.signedUrl) next[im.path] = data.signedUrl;
      }
      setUrls(next);
    })();
  }, [row.images, supabase]);

  const allChecked = checked.every(Boolean);
  const slugOk = SLUG_RE.test(slug);
  // ⚠ リンク切れを作る削除は、ここで止める。承認してから
  //   scripts/check-content.mjs に止められると、サイト全体の公開が止まる。
  const blocked = orphans.length > 0;

  const publish = async () => {
    setMsg('');

    // ⚠ 代表がここで直した内容も、このまま公開される。
    //   誤字レベルの直しのために差し戻す往復を無くすための機能なので、
    //   最低限の形式チェックだけは通す（lib/schema.ts が Zod で弾く前に止める）。
    if (op !== 'delete') {
      const e = validate(row.kind, data, { publish: true, portrait: true }, op);
      setFieldErrors(e);
      if (hasErrors(e)) {
        setMsg('直した内容に足りないところがあります。赤い文の欄を見てください。');
        return;
      }
    }

    setBusy(true);
    try {
      // 新規のときだけ、代表がここで slug を確定させる。
      // ⚠ 直す・消すの slug は投稿者が対象を選んだ時点で決まっている。
      //   ここで変えられると、別のページを書き換えてしまう。
      if (op === 'create' && slug !== row.target_slug) {
        const { error } = await supabase
          .from('submissions')
          .update({ target_slug: slug })
          .eq('id', row.id);
        if (error) throw new Error(error.message);
      }

      // ⚠ 代表が直した中身を、公開前にここで書き戻す。
      //   Edge Function はこのテーブルの行をそのまま読んで Markdown にするため、
      //   ここで書いておかないと、直した内容が無かったことになる。
      if (op !== 'delete') {
        const { error } = await supabase.from('submissions').update({ data }).eq('id', row.id);
        if (error) throw new Error(error.message);
      }

      // ⚠ GitHub への書き込みはここでは行わない。トークンはブラウザに置かない。
      //   Edge Function 側でもう一度「本当に代表か」を確かめている。
      const res = await fetch(PUBLISH_FUNCTION_URL, {
        method: 'POST',
        headers: { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' },
        body: JSON.stringify({ submission_id: row.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? `反映に失敗しました（${res.status}）`);

      setMsg(
        op === 'delete'
          ? `GitHub から消しました。数分後に ${json.path} が消えます（自動ビルドの完了後）。`
          : `GitHub に書き込みました。数分後に ${json.path} に出ます（自動ビルドの完了後）。`,
      );
      setTimeout(onDone, 1500);
    } catch (x) {
      setMsg(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };

  const sendBack = async () => {
    if (note.trim() === '') {
      setMsg('差し戻す理由を書いてください。理由が分からない差し戻しは、次の投稿を止めます。');
      return;
    }
    setBusy(true);
    setMsg('');
    const { error } = await supabase
      .from('submissions')
      .update({ state: 'returned', review_note: note.trim(), reviewed_at: new Date().toISOString() })
      .eq('id', row.id);
    setBusy(false);
    if (error) return setMsg(error.message);
    onDone();
  };

  const title = String(
    data.title ?? data.name ?? before?.label ?? row.target_slug ?? '（名前がまだ）',
  );

  return (
    <article className={s.card}>
      <h2 className={s.h2}>
        {title}
        <span className={s.meta}>
          {OP_BADGE[op]} ／ {KIND_LABEL[row.kind]}
        </span>
      </h2>

      {op === 'delete' ? (
        <DeleteReview row={row} before={before} orphans={orphans} />
      ) : (
        <>
          {op === 'update' && (
            <p className={s.note}>
              {before
                ? `${before.href} の内容を書き換えます。URL は変わりません。`
                : '⚠ いまサイトに出ている内容が見つかりませんでした（ビルド時点の一覧に無い）。対象が正しいか確かめてください。'}
            </p>
          )}

          {/* ⚠ 代表が最初に見るのは「サイトでどう出るか」。
                項目の羅列より先に置く。ここで顔が切れていれば、
                公開してから気づくのではなく、いま差し戻せる。 */}
          <PhotoReview row={row} urls={urls} name={title} before={before} op={op} />

          {/* ── 中身。代表はここで直接書き換えられる ──
                ⚠ 直す提案なら、変わったところに印を付ける（何が変わったかを
                  自分で思い出させない。5-C-0：確認の形骸化への対策）。
                ⚠ 投稿者が書いた元の値は必ず出す。代表の直しで消えても、
                  「元は何だったか」が分かるようにするため。 */}
          <div className={s.dl}>
            {FIELDS[row.kind].map((f) => {
              const v = data[f.key];
              const old = before?.data?.[f.key];
              const submitted = row.data?.[f.key];
              const changedFromBefore = op === 'update' && format(submitted) !== format(old);
              const editedByRep = format(v) !== format(submitted);
              return (
                <div
                  key={f.key}
                  className={changedFromBefore ? `${s.dlRow} ${s.dlChanged}` : s.dlRow}
                >
                  {changedFromBefore && (
                    <p className={s.beforeText}>
                      いま公開されている内容：
                      {format(old) === '' ? '（空）' : format(old)}
                    </p>
                  )}
                  {editedByRep && (
                    <p className={s.beforeText}>
                      投稿された内容：
                      {format(submitted) === '' ? '（空）' : format(submitted)}
                    </p>
                  )}
                  <FieldInput
                    field={f}
                    value={v}
                    error={fieldErrors[f.key]}
                    options={options}
                    onChange={(next) => setData((d) => ({ ...d, [f.key]: next }))}
                  />
                </div>
              );
            })}
          </div>

          {row.kind === 'work' && (
            <p className={s.note}>
              同意：掲載 {row.consent_publish ? '✓' : '✗'} ／ 写真に写る人の許可{' '}
              {row.consent_portrait ? '✓' : '✗'}
            </p>
          )}
        </>
      )}

      {/* ── URL ── */}
      {op === 'create' ? (
        <div className={s.field}>
          <label className={s.label} htmlFor={`slug-${row.id}`}>
            URLになる名前
          </label>
          {/* ⚠ 公開後にここを変えるとリンクが切れる（lib/schema.ts の slug と同じ約束）。
                だから公開の直前に、代表が確定させる。 */}
          <p className={s.hint}>
            半角の英小文字・数字・ハイフンだけ。<b>公開後は変えられません</b>
            （変えるとリンクが切れます）。
          </p>
          <input
            id={`slug-${row.id}`}
            className={
              slug && !slugOk ? `${s.input} ${s.inputInvalid} ${s.short}` : `${s.input} ${s.short}`
            }
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="例：rakugaki-bon"
          />
          {slug && slugOk && <p className={s.note}>公開先：{kindHref(row.kind, slug)}</p>}
          {slug && !slugOk && <p className={s.error}>半角の英小文字・数字・ハイフンだけが使えます。</p>}
        </div>
      ) : (
        <p className={s.note}>
          対象：<code>{kindHref(row.kind, row.target_slug ?? '')}</code>
          （投稿者が選んだものです。ここでは変えられません）
        </p>
      )}

      {/* ── 人にしか判断できないこと ── */}
      <fieldset className={s.consent}>
        <legend className={s.label}>目で見て確かめること</legend>
        {checks.map((label, i) => (
          <label key={label} className={s.check}>
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <div className={s.field}>
        <label className={s.label} htmlFor={`note-${row.id}`}>
          差し戻すときの理由
        </label>
        <p className={s.hint}>投稿した本人に、そのまま見えます。</p>
        <textarea
          id={`note-${row.id}`}
          className={`${s.input} ${s.textarea}`}
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {msg && (
        <p className={s.message} role="status">
          {msg}
        </p>
      )}

      <div className={s.row}>
        <button
          type="button"
          className={s.primary}
          disabled={busy || !allChecked || blocked || (op === 'create' && !slugOk)}
          onClick={publish}
        >
          {busy ? '反映しています…' : op === 'delete' ? 'サイトから消す' : '公開する'}
        </button>
        <button type="button" className={s.secondary} disabled={busy} onClick={sendBack}>
          差し戻す
        </button>
      </div>
      {!allChecked && !blocked && (
        <p className={s.note}>上の{checks.length}つを確認してからでないと反映できません。</p>
      )}
    </article>
  );
}

/* ── 消す提案の中身 ─────────────────────────────── */

function DeleteReview({
  row,
  before,
  orphans,
}: {
  row: Row;
  before: PublishedEntry | null;
  orphans: { slug: string; title: string }[];
}) {
  return (
    <>
      <p className={s.notice}>
        <b>{before?.label ?? row.target_slug}</b>（{kindHref(row.kind, row.target_slug ?? '')}）を
        サイトから消す提案です。押すと、content の Markdown と写真が GitHub から消えます。
      </p>

      <dl className={s.dl}>
        <div className={s.dlRow}>
          <dt>消す理由（投稿者が書いたもの）</dt>
          <dd>{row.delete_reason ?? '（未記入）'}</dd>
        </div>
      </dl>

      {/* ⚠ ここが、この画面でいちばん大事な表示である。
            リンク切れを作る削除を通すと、次のビルドで
            scripts/check-content.mjs がサイト全体の公開を止める。
            「押せてしまうが後で壊れる」を作らないために、押せなくする。 */}
      {orphans.length > 0 && (
        <div className={s.blocked}>
          <p className={s.panelTitle}>これは消せません。</p>
          <p className={s.note}>
            この {KIND_LABEL[row.kind]} を所属先にしている作品が {orphans.length} 件あります。
            消すと、その作品の所属先が行方不明になり、次のビルドでサイト全体の公開が止まります。
          </p>
          <ul className={s.orphans}>
            {orphans.map((o) => (
              <li key={o.slug}>
                <a href={`/works/${o.slug}/`}>{o.title}</a>
              </li>
            ))}
          </ul>
          <p className={s.note}>
            どちらかをしてください。
            <br />
            ・この提案を差し戻し、<b>「終了」に切り替える</b>ことを勧める（ページは残り、作品のリンクも切れません）
            <br />
            ・上の作品の所属先を先に別のものへ移してから、もう一度この提案を出してもらう
          </p>
        </div>
      )}

      {before && before.images.length > 0 && (
        <>
          <p className={s.label}>一緒に消える写真（{before.images.length}枚）</p>
          <ul className={s.photos}>
            {before.images.map((im) => (
              <li key={im.src} className={s.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={im.src} alt={im.alt} className={s.photoImg} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

/* ── いま載っている写真をどうするか ─────────────── */

/* ── 写真が実際どう出るか ────────────────────────
   ⚠ 投稿画面と同じ並び（data.photos）を、同じ順で見せる。
     代表と投稿者が違うものを見ていると、「切れている」の話が噛み合わない。
   ⚠ 1枚目＝表紙（切り抜かれる）、2枚目以降＝本文中（切り抜かれない）。
     この区別を代表の画面にも出す。出さないと、表紙が入れ替わったことに
     気づかないまま承認できてしまう。 */

type ReviewPhoto = { src?: string; path?: string; alt: string; focus?: Focus };

function PhotoReview({
  row,
  urls,
  name,
  before,
  op,
}: {
  row: Row;
  urls: Record<string, string>;
  name: string;
  before: PublishedEntry | null;
  op: Op;
}) {
  const d = row.data as { photos?: ReviewPhoto[]; keepImages?: ReviewPhoto[] };
  // ⚠ 古い下書きの形（keepImages ＋ images）も開ける。
  const photos: ReviewPhoto[] =
    d.photos ?? [...(d.keepImages ?? []), ...(row.images ?? [])];

  const urlOf = (p: ReviewPhoto) => (p.src ? asset(p.src) : (urls[p.path ?? ''] ?? ''));

  // ⚠ 外される写真は必ず見せる。「文章を直しただけ」のつもりで写真が落ちる事故は、
  //   この一覧が無いと承認の瞬間に見抜けない。
  const dropped =
    op === 'update' && before
      ? before.images.filter((b) => !photos.some((p) => p.src === b.src))
      : [];

  if (photos.length === 0 && dropped.length === 0) return null;

  return (
    <>
      {photos.length > 0 && (
        <>
          {/* 表紙は、出る場所ごとの切り抜きまで見せる。 */}
          {urlOf(photos[0]) && (
            <PhotoFraming
              src={urlOf(photos[0])}
              alt={photos[0].alt}
              name={name}
              focus={photos[0].focus ?? DEFAULT_FOCUS}
              readOnly
            />
          )}

          {photos.length > 1 && (
            <>
              <p className={s.label}>
                本文中の写真（{photos.length - 1}枚）
                <span className={s.meta}>元の比率のまま出ます</span>
              </p>
              <ul className={s.photos}>
                {photos.slice(1).map((im, i) => (
                  <li key={im.src ?? im.path} className={s.photo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {urlOf(im) && <img src={urlOf(im)} alt={im.alt} className={s.photoImg} />}
                    <p className={s.note}>
                      {i + 1}枚目の説明：
                      {/* ⚠ 空でも公開は止まらない（check-content.mjs は alt 属性の
                            有無しか見ていない）。止まると書くのは嘘になる。 */}
                      {im.alt || (
                        <span className={s.error}>
                          （未記入。公開はされますが、目の見えない人に内容が伝わりません）
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}

      {dropped.length > 0 && (
        <>
          <p className={s.label}>この提案で外される写真（{dropped.length}枚）</p>
          <ul className={s.photos}>
            {dropped.map((im) => (
              <li key={im.src} className={`${s.photo} ${s.photoDropped}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={asset(im.src)} alt={im.alt} className={s.photoImg} />
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function format(v: unknown): string {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.join('、');
  if (typeof v === 'object') {
    const b = v as { kind?: string; slug?: string };
    if (b.kind && b.slug) return `${b.kind} / ${b.slug}`;
    return JSON.stringify(v);
  }
  if (v === 'active') return '活動中・進行中';
  if (v === 'done') return '終了';
  return String(v);
}
