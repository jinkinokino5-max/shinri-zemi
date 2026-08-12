'use client';

import { useCallback, useEffect, useState } from 'react';
import { getSupabase, PUBLISH_FUNCTION_URL } from '@/lib/supabase/client';
import { FIELDS, KIND_LABEL, kindHref, type Kind } from '@/lib/submission/fields';
import { AuthGate } from './AuthGate';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   代表による公開前レビューの画面
   根拠：draft/ロードマップ.md 6-D ／ 5-C-0 ②（確認の負担を機械で肩代わりする）

   ⚠ この画面に出すのは「人にしか判断できないこと」だけにする。
     機械が判定できることは、すでに機械が済ませている：
       ・独自ページのJS混入・外部参照・容量 → scripts/check-custom-pages.mjs
       ・h1・alt・リンク切れ・非公認の一文  → scripts/check-content.mjs
       ・入力の形式・必須項目・同意          → lib/submission/validate.ts ＋ RLS
     代表に残るのは、写真の許可・拾い画像・掲載ポリシー・団体としての判断の4つ。

     ⚠ 5-C-0 の警告：「人の目だけに頼ると必ず形骸化します。
       形骸化した確認は、無いより危険です」。項目を増やすときはこれを思い出すこと。

   ⚠ 削除ボタンは置かない（6-1）。差し戻すか、公開するかの2つだけ。
   ══════════════════════════════════════════════════════════════════ */

type Row = {
  id: string;
  kind: Kind;
  state: string;
  target_slug: string | null;
  data: Record<string, unknown>;
  images: { path: string; alt: string }[];
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

const SLUG_RE = /^[a-z0-9-]+$/;

export function ReviewApp() {
  return <AuthGate requireRep>{({ accessToken }) => <Inner accessToken={accessToken} />}</AuthGate>;
}

function Inner({ accessToken }: { accessToken: string }) {
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
        <ReviewCard key={row.id} row={row} accessToken={accessToken} onDone={load} />
      ))}
    </>
  );
}

function ReviewCard({
  row,
  accessToken,
  onDone,
}: {
  row: Row;
  accessToken: string;
  onDone: () => void;
}) {
  const supabase = getSupabase()!;
  const [slug, setSlug] = useState(row.target_slug ?? '');
  const [note, setNote] = useState('');
  const [checked, setChecked] = useState<boolean[]>(HUMAN_CHECKS.map(() => false));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [urls, setUrls] = useState<Record<string, string>>({});

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

  const publish = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (slug !== row.target_slug) {
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
      if (!res.ok) throw new Error(json.error ?? `公開に失敗しました（${res.status}）`);

      setMsg(
        `GitHub に書き込みました。数分後に ${json.path} に出ます（自動ビルドの完了後）。`,
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

  const title = String(row.data?.title ?? row.data?.name ?? '（名前がまだ）');

  return (
    <article className={s.card}>
      <h2 className={s.h2}>
        {title}
        <span className={s.meta}>{KIND_LABEL[row.kind]}</span>
      </h2>

      {/* ── 中身をそのまま並べる ── */}
      <dl className={s.dl}>
        {FIELDS[row.kind].map((f) => {
          const v = row.data?.[f.key];
          if (v === undefined || v === null || v === '') return null;
          return (
            <div key={f.key} className={s.dlRow}>
              <dt>{f.label}</dt>
              <dd>{format(v)}</dd>
            </div>
          );
        })}
      </dl>

      {(row.images ?? []).length > 0 && (
        <ul className={s.photos}>
          {row.images.map((im) => (
            <li key={im.path} className={s.photo}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {urls[im.path] && <img src={urls[im.path]} alt={im.alt} className={s.photoImg} />}
              <p className={s.note}>
                説明：{im.alt || <span className={s.error}>（未記入。このままだと公開が止まります）</span>}
              </p>
            </li>
          ))}
        </ul>
      )}

      {row.kind === 'work' && (
        <p className={s.note}>
          同意：掲載 {row.consent_publish ? '✓' : '✗'} ／ 写真に写る人の許可{' '}
          {row.consent_portrait ? '✓' : '✗'}
        </p>
      )}

      {/* ── URL ── */}
      <div className={s.field}>
        <label className={s.label} htmlFor={`slug-${row.id}`}>
          URLになる名前
        </label>
        {/* ⚠ 公開後にここを変えるとリンクが切れる（lib/schema.ts の slug と同じ約束）。
              だから公開の直前に、代表が確定させる。 */}
        <p className={s.hint}>
          半角の英小文字・数字・ハイフンだけ。<b>公開後は変えられません</b>（変えるとリンクが切れます）。
        </p>
        <input
          id={`slug-${row.id}`}
          className={slug && !slugOk ? `${s.input} ${s.inputInvalid} ${s.short}` : `${s.input} ${s.short}`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="例：rakugaki-bon"
        />
        {slug && slugOk && <p className={s.note}>公開先：{kindHref(row.kind, slug)}</p>}
        {slug && !slugOk && <p className={s.error}>半角の英小文字・数字・ハイフンだけが使えます。</p>}
      </div>

      {/* ── 人にしか判断できないこと ── */}
      <fieldset className={s.consent}>
        <legend className={s.label}>目で見て確かめること</legend>
        {HUMAN_CHECKS.map((label, i) => (
          <label key={label} className={s.check}>
            <input
              type="checkbox"
              checked={checked[i]}
              onChange={(e) =>
                setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))
              }
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
          disabled={busy || !allChecked || !slugOk}
          onClick={publish}
        >
          {busy ? '公開しています…' : '公開する'}
        </button>
        <button type="button" className={s.secondary} disabled={busy} onClick={sendBack}>
          差し戻す
        </button>
      </div>
      {!allChecked && (
        <p className={s.note}>
          上の4つを確認してからでないと公開できません。
        </p>
      )}
    </article>
  );
}

function format(v: unknown): string {
  if (Array.isArray(v)) return v.join('、');
  if (v && typeof v === 'object') {
    const b = v as { kind?: string; slug?: string };
    if (b.kind && b.slug) return `${b.kind} / ${b.slug}`;
    return JSON.stringify(v);
  }
  if (v === 'active') return '活動中・進行中';
  if (v === 'done') return '終了';
  return String(v);
}
