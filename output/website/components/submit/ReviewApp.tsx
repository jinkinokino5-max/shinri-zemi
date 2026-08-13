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
import type { DependentMap, PublishedEntry } from '@/lib/submission/published';
import { AuthGate } from './AuthGate';
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
   ══════════════════════════════════════════════════════════════════ */

type Row = {
  id: string;
  kind: Kind;
  op: Op;
  state: string;
  target_slug: string | null;
  data: Record<string, unknown>;
  images: { path: string; alt: string }[];
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
}: {
  entries: PublishedEntry[];
  dependents: DependentMap;
}) {
  return (
    <AuthGate requireRep>
      {({ accessToken }) => (
        <Inner accessToken={accessToken} entries={entries} dependents={dependents} />
      )}
    </AuthGate>
  );
}

function Inner({
  accessToken,
  entries,
  dependents,
}: {
  accessToken: string;
  entries: PublishedEntry[];
  dependents: DependentMap;
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
  onDone,
}: {
  row: Row;
  accessToken: string;
  entries: PublishedEntry[];
  dependents: DependentMap;
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
    setBusy(true);
    setMsg('');
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
    row.data?.title ?? row.data?.name ?? before?.label ?? row.target_slug ?? '（名前がまだ）',
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

          {/* ── 中身をそのまま並べる。直す提案なら、変わったところを示す ── */}
          <dl className={s.dl}>
            {FIELDS[row.kind].map((f) => {
              const v = row.data?.[f.key];
              const old = before?.data?.[f.key];
              const changed = op === 'update' && format(v) !== format(old);
              if ((v === undefined || v === null || v === '') && !changed) return null;
              return (
                <div key={f.key} className={changed ? `${s.dlRow} ${s.dlChanged}` : s.dlRow}>
                  <dt>
                    {f.label}
                    {changed && <span className={s.changedTag}>変更</span>}
                  </dt>
                  <dd>
                    {/* ⚠ 変更前を必ず並べて出す。新しい値だけを見せると、
                          代表は「何が変わったのか」を自分で思い出す羽目になり、
                          結局そのまま押す（＝確認の形骸化）。 */}
                    {changed && (
                      <span className={s.beforeText}>
                        {format(old) === '' ? '（空）' : format(old)}
                      </span>
                    )}
                    {format(v) === '' ? '（空）' : format(v)}
                  </dd>
                </div>
              );
            })}
          </dl>

          <KeptPhotos data={row.data} before={before} op={op} />

          {(row.images ?? []).length > 0 && (
            <>
              <p className={s.label}>{op === 'update' ? '新しく足す写真' : '写真'}</p>
              <ul className={s.photos}>
                {row.images.map((im) => (
                  <li key={im.path} className={s.photo}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {urls[im.path] && <img src={urls[im.path]} alt={im.alt} className={s.photoImg} />}
                    <p className={s.note}>
                      説明：
                      {im.alt || (
                        <span className={s.error}>（未記入。このままだと公開が止まります）</span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            </>
          )}

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

function KeptPhotos({
  data,
  before,
  op,
}: {
  data: Record<string, unknown>;
  before: PublishedEntry | null;
  op: Op;
}) {
  if (op !== 'update' || !before) return null;

  const kept = (data.keepImages as { src: string; alt: string }[] | undefined) ?? [];
  const dropped = before.images.filter((b) => !kept.some((k) => k.src === b.src));

  if (kept.length === 0 && dropped.length === 0) return null;

  return (
    <>
      {kept.length > 0 && (
        <>
          <p className={s.label}>そのまま残す写真（{kept.length}枚）</p>
          <ul className={s.photos}>
            {kept.map((im) => {
              const old = before.images.find((b) => b.src === im.src);
              const altChanged = old && old.alt !== im.alt;
              return (
                <li key={im.src} className={s.photo}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={im.src} alt={im.alt} className={s.photoImg} />
                  <p className={s.note}>
                    説明：{im.alt || <span className={s.error}>（未記入）</span>}
                    {altChanged && <span className={s.changedTag}>変更</span>}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* ⚠ 外される写真は、必ず目で見せる。「文章を直しただけ」のつもりで
            写真が落ちる事故は、この一覧が無いと承認の瞬間に見抜けない。 */}
      {dropped.length > 0 && (
        <>
          <p className={s.label}>この提案で外される写真（{dropped.length}枚）</p>
          <ul className={s.photos}>
            {dropped.map((im) => (
              <li key={im.src} className={`${s.photo} ${s.photoDropped}`}>
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
