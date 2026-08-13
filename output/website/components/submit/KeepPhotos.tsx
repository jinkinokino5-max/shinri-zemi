'use client';

import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   すでに公開されている写真の扱い（「直す」提案のときだけ出る）
   根拠：draft/ロードマップ.md 6-1 ／ 06資料 2章（alt）

   ⚠ ここが無いと何が起きるか
     編集画面で写真を1枚も足さずに提出した瞬間、公開済みの写真が
     全部消える。投稿者は「文章だけ直した」つもりでいる。
     いちばん静かに起きて、いちばん気づかれない壊れ方なので、
     「そのまま残す」を既定にして、外すときだけ明示させる。

   ⚠ 公開済みの写真は Storage ではなくリポジトリの public/photos にある。
     だから path ではなく src（/photos/… ）で持つ。新しく足す写真
     （PhotoInput）とは出所が違う。混ぜないこと。
   ══════════════════════════════════════════════════════════════════ */

export type KeptImage = { src: string; alt: string };

export function KeepPhotos({
  images,
  onChange,
}: {
  images: KeptImage[];
  onChange: (v: KeptImage[]) => void;
}) {
  if (images.length === 0) return null;

  const setAlt = (src: string, alt: string) =>
    onChange(images.map((im) => (im.src === src ? { ...im, alt } : im)));

  return (
    <div className={s.field}>
      <span className={s.label}>いま載っている写真</span>
      <p className={s.hint}>
        そのままにしておけば、いまの写真が残ります。説明文だけ直すこともできます。
        {images.length > 1 && ' 1枚目が一覧に出る写真です。'}
      </p>

      <ul className={s.photos}>
        {images.map((im, i) => (
          <li key={im.src} className={s.photo}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={im.src} alt="" className={s.photoImg} />
            <div className={s.photoBody}>
              <label className={s.altLabel}>
                {i === 0 ? '1枚目（一覧に出ます）' : `${i + 1}枚目`}の説明
                <input
                  className={s.input}
                  value={im.alt}
                  onChange={(e) => setAlt(im.src, e.target.value)}
                  placeholder="何が写っているか"
                />
              </label>
              {/* ⚠ 「消す」ではなく「この写真を外す提案をする」。
                    押した時点では何も消えない。消えるのは承認された後。 */}
              <button
                type="button"
                className={s.linkBtn}
                onClick={() => onChange(images.filter((x) => x.src !== im.src))}
              >
                この写真を外す
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
