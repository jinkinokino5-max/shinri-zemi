import Link from 'next/link';
import { Thumb, cardClass } from './Thumb';
import styles from './Card.module.css';
import type { ImageRef } from '@/lib/schema';

/* ══════════════════════════════════════════════════════════════════
   カード（大本資料 7-2）
   ⚠ 枠線・影・背景色なし（原理3）。面は色で分ける。
   ⚠ ホバーは画像の色が戻る＋タイトルに朱の下線。それ以上動かさない。
   ══════════════════════════════════════════════════════════════════ */

export function Card({
  href,
  name,
  meta,
  state,
  cover,
  done,
}: {
  href: string;
  name: string;
  /** 期間など。⚠ 未確定は「––」を渡す。0 で埋めない。 */
  meta?: string;
  /** 「活動中」「終了」など。⚠ 状態は色ではなく文字で示す。 */
  state?: string;
  cover?: ImageRef;
  done?: boolean;
}) {
  // ⚠ 写真が無いときは Thumb が枠の中に名前を出す。
  //   枠下にも同じ名前を出すと二重になるため、そちらは伏せる。
  //   6-4 の原典（武蔵野美術大学）も、枠の中に名前だけを置いている。
  //   読み上げのために、伏せた名前は .vh で残す。
  const hasCover = Boolean(cover);

  return (
    <li>
      <Link className={`${cardClass} ${styles.card}`} href={href}>
        <Thumb cover={cover} name={name} done={done} />
        {hasCover ? (
          <p className={`${styles.name} ${done ? styles.nameDone : ''}`}>{name}</p>
        ) : (
          <span className="vh">{name}</span>
        )}
        {meta && <p className={styles.meta}>{meta}</p>}
        {state && <p className={styles.state}>{state}</p>}
      </Link>
    </li>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return <ul className={styles.grid}>{children}</ul>;
}
