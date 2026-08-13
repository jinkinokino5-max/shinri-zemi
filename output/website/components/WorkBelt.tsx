import Link from 'next/link';
import { Marquee } from './Marquee';
import { Thumb, cardClass } from './Thumb';
import styles from './WorkBelt.module.css';
import type { Activity } from '@/lib/content';

/* ══════════════════════════════════════════════════════════════════
   写真の帯
   根拠：draft/mock_flow/02x04_title_flow.html（2026-08-11 に団体が採用）

   活動写真を横に流す。

   ⚠ 2026-08-13：写真を白黒＋朱で統一するのをやめた（Thumb.module.css 参照）。
     写真はそのままの色で流れる。揃うのは枠の比率と間隔だけである。
     見た目が揃わないのは不具合ではなく、決定の結果である。

   ⚠ 写真が無い活動を帯から外さない。
     Thumb が 6-4 のフォールバック（名前だけの落ち着いた枠）に切り替える。
     外すと「写真を出した部活だけが載る」ことになり、
     写真の有無が掲載の条件だと誤解される。

   ⚠ この帯は TitleHero の直下に置く。1画面目で
     「団体名」「何をしているか」「Mission」が同時に入ることが狙い。
   ══════════════════════════════════════════════════════════════════ */

export function WorkBelt({ activities }: { activities: Activity[] }) {
  return (
    <section className={styles.belt}>
      {/* ⚠ 件数は必ず配列の長さから出す。手で書くと content/ が増えたとき矛盾する。 */}
      <p className={styles.cap}>
        <span className="label">これまでに生まれた企画</span>
        <span>
          <b className={`num ${styles.n}`}>{activities.length}</b>
          <small className={styles.unit}> 件</small>
        </span>
      </p>

      {/* ⚠ .wrap の外に出して画面幅いっぱいに流す。
            両端で断ち切ると「切れた」に見え、「流れ」に見えない。 */}
      <Marquee dir="left" speed={96}>
        {activities.map((a) => (
          <Link key={a.slug} className={`${cardClass} ${styles.tile}`} href={a.href}>
            <Thumb cover={a.cover} name={a.name} done={a.done} ratio="16 / 10" />
            <p className={styles.name}>{a.name}</p>
            {/* ⚠ 状態は色ではなく必ず文字でも示す。 */}
            <p className={styles.meta}>{a.meta}</p>
          </Link>
        ))}
      </Marquee>
    </section>
  );
}
