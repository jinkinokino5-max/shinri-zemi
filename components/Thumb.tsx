import styles from './Thumb.module.css';
import type { ImageRef } from '@/lib/schema';

/* ══════════════════════════════════════════════════════════════════
   写真枠。詳細は Thumb.module.css のコメントを参照。

   ⚠ cover が無いときは 6-4 のフォールバックに切り替える。
     大本資料は 6-4 を「⚠ 必須」「運用上、決定的に重要」としている。
     部活やPJによっては必ず「まだ良い写真がない」状態が発生するため、
     この分岐をデータ設計の段階で決めてある（schema.ts の cover は optional）。
   ══════════════════════════════════════════════════════════════════ */

export function Thumb({
  cover,
  name,
  done,
  ratio,
}: {
  cover?: ImageRef;
  /** 写真が無いときに枠の中へ出す名前。 */
  name: string;
  done?: boolean;
  /** 既定は 4/3。イベントなど横長にしたいときに指定する。 */
  ratio?: string;
}) {
  const cls = [styles.thumb, done && styles.done].filter(Boolean).join(' ');
  const style = ratio ? { aspectRatio: ratio } : undefined;

  if (!cover) {
    return (
      <div className={`${cls} ${styles.empty}`} style={style}>
        <div>
          <p className={styles.emptyName}>{name}</p>
          <p className={styles.emptyNote}>NO IMAGE</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cls} style={style}>
      {/* ⚠ next/image は output:'export' では最適化が効かないため使わない。
            sharp によるビルド前処理へ切り替える（ロードマップ 1-E）。
            それまでは素の <img> を使い、loading="lazy" だけ効かせる。
            ⚠ alt はスキーマで必須にしてある（06資料 2章）。 */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className={styles.img} src={cover.src} alt={cover.alt} loading="lazy" decoding="async" />
      <span className={styles.overlay} />
    </div>
  );
}

/** カードの外枠。ホバーで写真の色が戻るのは、この class が起点。 */
export const cardClass = styles.card;
