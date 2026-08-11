import styles from './Marquee.module.css';

/* ══════════════════════════════════════════════════════════════════
   流れる帯（マーキー）
   根拠：draft/mock_flow/02x04_title_flow.html（2026-08-11 に確定した案）

   同じ列を2つ並べ、トラック全体を -50% 動かすことで継ぎ目を消す。

   ⚠ 大本資料 8-4「1画面に同時に動く要素は3つまで」との関係
     帯は多数の子を持つが、全要素が単一トラックを同一速度で動くため、
     知覚されるのは「1本につき1つの動き」である。既存の Chip.module.css が
     20枚の札に対して行っているのと同じ読み替えを適用している。

   ⚠ 2つ目の列は「継ぎ目を消すための複製」であって、内容の重複ではない。
     したがって aria-hidden と inert の両方を付ける。
       aria-hidden … 読み上げが同じ内容を2周するのを防ぐ
       inert       … Tab キーが複製側のリンクに入り込むのを防ぐ
     ⚠ どちらか一方では足りない。aria-hidden だけだとフォーカスは入る。

   ⚠ ホバー・フォーカスで停止する。
     読みたい人が読めない動きは、動きではなく妨害である。
   ══════════════════════════════════════════════════════════════════ */

export function Marquee({
  children,
  /** 流れる向き。 */
  dir = 'left',
  /** 1周にかける秒数。⚠ 長いほど遅い。背景装飾は80秒以上にする。 */
  speed = 60,
  /** 両端を地の色で溶かす。⚠ 切ると帯が「切れた」に見え、「流れ」に見えない。 */
  fade = true,
  className,
}: {
  children: React.ReactNode;
  dir?: 'left' | 'right';
  speed?: number;
  fade?: boolean;
  className?: string;
}) {
  const cls = [
    styles.flow,
    dir === 'left' ? styles.left : styles.right,
    fade && styles.fade,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} style={{ ['--speed' as string]: `${speed}s` }}>
      <div className={styles.track}>
        <div className={styles.set}>{children}</div>
        {/* ⚠ 複製。aria-hidden と inert の両方が要る（上のコメント参照）。 */}
        <div className={styles.set} aria-hidden inert>
          {children}
        </div>
      </div>
    </div>
  );
}
