import Link from 'next/link';
import styles from './Chip.module.css';

/* ══════════════════════════════════════════════════════════════════
   札（整列 ALIGNMENT）
   根拠：draft/モック案_10案.md 案3 ／ draft/mock_top_v2.html

   散らばった札が、スクロールすると格子に吸い込まれる。
   「妄想（散乱）→ 形にする（整列）」を、Mission のとおりに画面で演じる。

   ⚠ 大本資料 8-4 との関係
     資料は「1画面に同時に動く要素は3つまで」と定めており、
     本コンポーネントは20枚が同時に動くため字義的には抵触する。
     ただし全札が同一タイムライン・同一イージングで動くため、
     知覚されるのは「20個の動き」ではなく「1つの動き」である。
     この読み替えを前提に採用している。増やす方向に拡張しないこと。

   ⚠ 安全な劣化
     animation-timeline 未対応ブラウザでは animation-duration が既定の 0s に
     なり、即座に終端＝整列状態になる。散らばったまま固まることはない。
   ══════════════════════════════════════════════════════════════════ */

export type ChipProps = {
  href: string;
  name: string;
  /** 例：'Club / 活動中'。⚠ 状態は色ではなく必ず文字でも示す。 */
  meta: string;
  /** 終了したもの。⚠ 消さずに残す（Value「過去から学ぶことを忘れない」）。 */
  done?: boolean;
  /** 近日開催のイベントなど、画面で1枚だけ朱にするもの。
   *  ⚠ 朱を2箇所に使うと効果が半減する。1画面に1枚まで。 */
  highlight?: boolean;
};

export function Chip({ href, name, meta, done, highlight }: ChipProps) {
  const cls = [styles.chip, done && styles.done, highlight && styles.live]
    .filter(Boolean)
    .join(' ');
  return (
    <li>
      <Link className={cls} href={href}>
        <span className={styles.name}>{name}</span>
        <span className={styles.meta}>{meta}</span>
      </Link>
    </li>
  );
}

export function ChipField({ children }: { children: React.ReactNode }) {
  return <ul className={styles.field}>{children}</ul>;
}
