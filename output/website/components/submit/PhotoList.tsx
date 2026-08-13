'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { asset } from '@/lib/asset';
import type { Focus } from '@/lib/schema';
import { DEFAULT_FOCUS, PhotoFraming } from './PhotoFraming';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   写真（1本の並び）
   根拠：draft/ロードマップ.md 6-1 ／ 06資料 2章（alt）／ R-5（10MB）

   ⚠ このファイルは KeepPhotos.tsx と PhotoInput.tsx を1つにまとめたもの
     （2026-08-13）。分かれていたときに何が起きたかを残しておく。

       ・「いま載っている写真」と「写真を足す」が別々の配列だった
       ・どちらも自分の先頭を「1枚目（一覧に出ます）」と表示していた
       ・投稿者は足したほうを表紙だと思って切り抜きを調整した
       ・実際の表紙は残っていたほうで、足したほうは表紙にならず、
         さらに当時は2枚目以降が .md に書き出されないため消えた
       ・結果：調整しても何も反映されない、2枚目はどこにも出ない

     直したのは表示ではなく構造である。**並びが1本しか無ければ、
     どれが表紙かを間違えようがない。** 表示だけ直すと、また分かれる。

   ⚠ 表紙（1枚目）と本文中（2枚目以降）は、出かたが違う。
       表紙   … 出る場所ごとに違う比率へ切り抜かれる → 位置の調整が要る
       本文中 … 元の比率のまま並ぶ（components/Gallery.tsx）→ 調整するものが無い
     この違いを画面に書く。書かないと、投稿者は全部同じ扱いだと思う。

   ⚠ 「加工不要」は約束である。学生に圧縮を頼まない（ロードマップ R-d）。
     元のまま受け取り、公開時に scripts/optimize-images.mjs が縮める。
   ══════════════════════════════════════════════════════════════════ */

/**
 * 1枚の写真。src と path のどちらか一方だけを持つ。
 *   src  … すでに公開されている写真（/photos/… ）
 *   path … 新しく上げた写真（Storage のパス）
 * ⚠ supabase/functions/publish/to-markdown.ts の OrderedPhoto と同じ形。
 *   片方だけ変えると、承認したのに写真が消える。
 */
export type Photo = { src?: string; path?: string; alt: string; focus?: Focus };

const MAX_BYTES = 10 * 1024 * 1024; // R-5：1つあたり 10MB

/** その写真を画面に出すためのURL。⚠ 新しい写真は署名付きURLが要る。 */
function useDisplayUrls(photos: Photo[]) {
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const p of photos) {
        if (!p.path) continue;
        const { data } = await supabase.storage.from('submissions').createSignedUrl(p.path, 900);
        if (data?.signedUrl) next[p.path] = data.signedUrl;
      }
      if (alive) setUrls((prev) => ({ ...prev, ...next }));
    })();
    return () => {
      alive = false;
    };
    // ⚠ photos そのものを依存に入れない。並べ替えのたびに署名を取り直し、
    //   そのたびに画像が一瞬消える。パスの集合が変わったときだけ取り直す。
  }, [photos.map((p) => p.path ?? '').join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return (p: Photo) => (p.src ? asset(p.src) : (urls[p.path!] ?? ''));
}

export const photoKey = (p: Photo) => p.src ?? p.path ?? '';

export function PhotoList({
  userId,
  submissionId,
  photos,
  onChange,
  frameName,
}: {
  userId: string;
  submissionId: string;
  photos: Photo[];
  onChange: (v: Photo[]) => void;
  /** 写真が無いときの枠に出る名前（6-4）。 */
  frameName: string;
}) {
  const supabase = getSupabase()!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const urlOf = useDisplayUrls(photos);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    setBusy(true);
    try {
      const added: Photo[] = [];
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          throw new Error(
            `${file.name} は ${(file.size / 1024 / 1024).toFixed(1)}MB あります。1枚 10MB までです。`,
          );
        }
        // ⚠ 元のファイル名を使わない。日本語・空白・記号が入ると、
        //   GitHub 上のパスと <img src> で扱いが食い違って画像が壊れる。
        const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
        const name = `${crypto.randomUUID().slice(0, 8)}.${ext}`;
        const path = `${userId}/${submissionId}/${name}`;

        const { error } = await supabase.storage
          .from('submissions')
          .upload(path, file, { contentType: file.type, upsert: false });
        if (error) throw new Error(error.message);

        added.push({ path, alt: '' });
      }
      onChange([...photos, ...added]);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };

  const update = (key: string, patch: Partial<Photo>) =>
    onChange(photos.map((p) => (photoKey(p) === key ? { ...p, ...patch } : p)));

  /** 並びから外す。⚠ 公開済みの写真は Storage に無いので消しに行かない。 */
  const remove = async (p: Photo) => {
    if (p.path) await supabase.storage.from('submissions').remove([p.path]);
    onChange(photos.filter((x) => photoKey(x) !== photoKey(p)));
  };

  /** 表紙にする＝先頭へ動かす。⚠ 残りの順序は変えない。 */
  const makeCover = (key: string) => {
    const target = photos.find((p) => photoKey(p) === key);
    if (!target) return;
    onChange([target, ...photos.filter((p) => photoKey(p) !== key)]);
  };

  const move = (key: string, dir: -1 | 1) => {
    const i = photos.findIndex((p) => photoKey(p) === key);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= photos.length) return;
    const next = [...photos];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };

  return (
    <div className={s.field}>
      <span className={s.label}>
        写真<span className={s.optional}>任意</span>
      </span>
      <p className={s.hint}>
        何枚でも入れられます。<b>加工しないでそのまま入れてください。</b>
        軽くする処理はサイト側で自動的に行います。1枚 10MB まで。
      </p>

      {/* ⚠ 役割の説明を、写真を入れる前に出す。
            入れてから説明すると、入れ直しになる。 */}
      <div className={s.roles}>
        <p>
          <b>1枚目＝表紙</b>　一覧・トップの帯・このページの頭に出ます。
          出る場所ごとに<b>枠の形が違うので切り抜かれます</b>。
        </p>
        <p>
          <b>2枚目以降＝本文中の写真</b>　このページの本文の下に、
          <b>元の比率のまま</b>並びます。切り抜かれません。
        </p>
      </div>

      <input
        type="file"
        className={s.file}
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        disabled={busy}
        onChange={(e) => {
          upload(e.target.files);
          e.target.value = '';
        }}
      />
      {busy && <p className={s.note}>アップロードしています…</p>}
      {err && <p className={s.error}>{err}</p>}

      {photos.length > 0 && (
        <ol className={s.photoList}>
          {photos.map((p, i) => (
            <PhotoRow
              key={photoKey(p)}
              photo={p}
              index={i}
              total={photos.length}
              url={urlOf(p)}
              frameName={frameName}
              onAlt={(alt) => update(photoKey(p), { alt })}
              onFocus={(focus) => update(photoKey(p), { focus })}
              onCover={() => makeCover(photoKey(p))}
              onMove={(d) => move(photoKey(p), d)}
              onRemove={() => remove(p)}
            />
          ))}
        </ol>
      )}
    </div>
  );
}

/* ── 写真1枚ぶん ─────────────────────────────────── */

function PhotoRow({
  photo,
  index,
  total,
  url,
  frameName,
  onAlt,
  onFocus,
  onCover,
  onMove,
  onRemove,
}: {
  photo: Photo;
  index: number;
  total: number;
  url: string;
  frameName: string;
  onAlt: (v: string) => void;
  onFocus: (v: Focus) => void;
  onCover: () => void;
  onMove: (d: -1 | 1) => void;
  onRemove: () => void;
}) {
  const isCover = index === 0;
  const published = Boolean(photo.src);

  return (
    <li className={isCover ? `${s.photoRow} ${s.photoRowCover}` : s.photoRow}>
      <div className={s.photoHead}>
        {/* ⚠ 役割を色ではなく文字で出す。「1枚目」ではなく「表紙」と書く。
              番号は並びの話で、役割の話ではない。 */}
        <span className={isCover ? s.roleCover : s.roleBody}>
          {isCover ? '表紙' : `本文中 ${index}枚目`}
        </span>
        {published && <span className={s.meta}>公開中</span>}
      </div>

      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className={s.photoImg} />
      ) : (
        <div className={s.photoImg} aria-hidden="true" />
      )}

      <label className={s.altLabel}>
        この写真の説明
        <input
          className={s.input}
          value={photo.alt}
          placeholder="何が写っているか（例：完成した冊子を並べたところ）"
          onChange={(e) => onAlt(e.target.value)}
        />
      </label>
      {/* ⚠ 空でも公開は止まらない。事実を書いたうえで、書く理由を伝える。 */}
      {photo.alt.trim() === '' && (
        <p className={s.note}>
          空のままでも公開はされますが、目の見えない人にこの写真の内容が伝わりません。
        </p>
      )}

      {/* 表紙のときだけ、出る場所のプレビューと切り抜きの調整を出す。
          ⚠ 本文中の写真は切り抜かれないので、調整するものが無い。 */}
      {isCover && url && (
        <PhotoFraming
          src={url}
          alt={photo.alt}
          name={frameName}
          focus={photo.focus ?? DEFAULT_FOCUS}
          onChange={onFocus}
        />
      )}
      {!isCover && (
        <p className={s.note}>
          この写真は<b>元の比率のまま</b>、本文の下に出ます。切り抜かれないので、
          位置の調整はありません。
        </p>
      )}

      <div className={s.photoActions}>
        {!isCover && (
          <button type="button" className={s.linkBtn} onClick={onCover}>
            この写真を表紙にする
          </button>
        )}
        <button
          type="button"
          className={s.linkBtn}
          onClick={() => onMove(-1)}
          disabled={index === 0}
        >
          ↑ 前へ
        </button>
        <button
          type="button"
          className={s.linkBtn}
          onClick={() => onMove(1)}
          disabled={index === total - 1}
        >
          ↓ 後ろへ
        </button>
        {/* ⚠ 公開中の写真は「外す」。押した時点では消えない（代表の承認後に消える）。
              新しく上げた写真は「消す」。こちらはその場で Storage から消える。 */}
        <button type="button" className={s.linkBtn} onClick={onRemove}>
          {published ? 'この写真を外す' : 'この写真を消す'}
        </button>
      </div>
    </li>
  );
}
