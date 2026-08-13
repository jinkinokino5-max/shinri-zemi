import type { ImageRef } from '@/lib/schema';
import { asset } from '@/lib/asset';
import styles from './Gallery.module.css';

/* ══════════════════════════════════════════════════════════════════
   2枚目以降の写真
   根拠：draft/デザイン大本資料_v1.md 原理2（作品集は極限まで引く）

   ⚠ 2026-08-13 に作った。それまで作品ページの中にだけ同じ処理があり、
     部活・PJ・イベントには置き場そのものが無かった。
     そのため2枚目を投稿すると、写真ファイルだけがリポジトリに残り、
     どのページからも参照されないまま消えていた（実際に起きた）。

   ⚠ 切り抜かない。元の比率のまま出す。
     ここは「見せたい写真をそのまま見せる」場所であって、
     枠に収める場所ではない。cover（Thumb）とは役割が違う。
     投稿画面もそう説明しているので、変えるときは両方を直すこと。

   ⚠ 1列に詰め込まない。写真同士が隣り合うと互いの色が干渉する。
   ══════════════════════════════════════════════════════════════════ */

export function Gallery({ images }: { images: ImageRef[] }) {
  if (images.length === 0) return null;

  return (
    <ul className={styles.gallery}>
      {images.map((im) => (
        <li key={im.src}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={asset(im.src)}
            alt={im.alt}
            loading="lazy"
            decoding="async"
            className={styles.img}
          />
        </li>
      ))}
    </ul>
  );
}
