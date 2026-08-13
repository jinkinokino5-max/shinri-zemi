'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   写真の入力
   根拠：draft/ロードマップ.md 6-1（「加工不要」）／ 06資料 2章（alt）／ R-5（10MB）

   ⚠ 「加工不要」は約束である。学生に圧縮を頼まない。
     ロードマップ R-d／06資料3章：
       「人に依存するルールは必ず守られなくなる。仕組みで解決する」
     ここでは元のまま受け取り、公開時に scripts/optimize-images.mjs が縮める。

   ⚠ alt は必ず書いてもらう。空の alt は scripts/check-content.mjs が
     デプロイを止める（参考サイト blanca の失敗をそのまま検査項目にしている）。
   ══════════════════════════════════════════════════════════════════ */

export type UploadedImage = { path: string; alt: string };

const MAX_BYTES = 10 * 1024 * 1024; // R-5：1つあたり 10MB

export function PhotoInput({
  userId,
  submissionId,
  images,
  onChange,
  label = '写真',
}: {
  userId: string;
  submissionId: string;
  images: UploadedImage[];
  onChange: (v: UploadedImage[]) => void;
  /** ⚠ すでに載っている写真がある画面では「写真を足す」に変える。
   *    そのまま「写真」だと、既存が置き換わるように読める。 */
  label?: string;
}) {
  const supabase = getSupabase()!;
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [previews, setPreviews] = useState<Record<string, string>>({});

  // 非公開バケットなので、見るには署名付きURLが要る。
  // ⚠ 承認前の写真が誰にでも見えては困る。公開バケットにしない。
  useEffect(() => {
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const im of images) {
        const { data } = await supabase.storage.from('submissions').createSignedUrl(im.path, 600);
        if (data?.signedUrl) next[im.path] = data.signedUrl;
      }
      if (alive) setPreviews(next);
    })();
    return () => {
      alive = false;
    };
  }, [images, supabase]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr('');
    setBusy(true);
    try {
      const added: UploadedImage[] = [];
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
      onChange([...images, ...added]);
    } catch (x) {
      setErr(x instanceof Error ? x.message : String(x));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (path: string) => {
    await supabase.storage.from('submissions').remove([path]);
    onChange(images.filter((im) => im.path !== path));
  };

  const setAlt = (path: string, alt: string) =>
    onChange(images.map((im) => (im.path === path ? { ...im, alt } : im)));

  return (
    <div className={s.field}>
      <span className={s.label}>
        {label}
        <span className={s.optional}>任意</span>
      </span>
      <p className={s.hint}>
        何枚でも入れられます。<b>加工しないでそのまま入れてください。</b>
        軽くする処理はサイト側で自動的に行います（scripts/optimize-images.mjs）。1枚 10MB まで。
        {images.length > 0 && ' 1枚目が一覧に出る写真になります。'}
      </p>

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

      {images.length > 0 && (
        <ul className={s.photos}>
          {images.map((im, i) => (
            <li key={im.path} className={s.photo}>
              {previews[im.path] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previews[im.path]} alt="" className={s.photoImg} />
              ) : (
                <div className={s.photoImg} aria-hidden="true" />
              )}
              <div className={s.photoBody}>
                <label className={s.altLabel}>
                  {i === 0 ? '1枚目（一覧に出ます）' : `${i + 1}枚目`}の説明
                  {/* ⚠ 目が見えない人に写真の内容を伝える文。空だと公開が止まる。 */}
                  <input
                    className={s.input}
                    value={im.alt}
                    placeholder="何が写っているか（例：完成した冊子を並べたところ）"
                    onChange={(e) => setAlt(im.path, e.target.value)}
                  />
                </label>
                <button type="button" className={s.linkBtn} onClick={() => remove(im.path)}>
                  この写真を消す
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
