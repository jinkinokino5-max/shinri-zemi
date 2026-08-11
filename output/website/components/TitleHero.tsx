import { Logomark } from './Logomark';
import { Marquee } from './Marquee';
import styles from './TitleHero.module.css';
import { ORG } from '@/lib/org';
import type { Activity } from '@/lib/content';

/* ══════════════════════════════════════════════════════════════════
   ヒーロー：題字「北大心理ゼミ」の背後を活動名が流れる
   根拠：draft/mock_flow/02x04_title_flow.html（2026-08-11 に団体が採用）

   なぜこの形か
     従来のトップは1画面目が題字だけで、「何をしている団体か」が
     スクロールしないと分からなかった。題字を小さくして解決するのではなく、
     題字はそのまま大きく残したうえで、その背後に活動そのものを置く。

   ⚠⚠ 大本資料 8-4「1画面に同時に動く要素は3つまで」を超えている
     背景の帯3本 ＋ 直下の写真の帯1本 ＝ 4本。上限を1つ超過している。
     2026-08-11、上限超過を説明したうえで団体側が3列を選択した。
     ⚠ これは意図的な逸脱であり、実装の見落としではない。
     ⚠ 実機で「うるさい」と感じた場合、最初に戻すのはここ。
       ROWS を 2 にすれば上限内に収まる。

   ⚠ 背景に流れる名前は「装飾」である。読ませる対象ではない。
     ・コントラストを意図的に落としてある（題字と Mission を邪魔させないため）
     ・aria-hidden を付け、リンクにもしていない
     ・⚠ よって、ここにしか無い情報を置いてはならない。
       同じ活動は必ず直下の WorkBelt にも出す。

   ⚠ 題字は文字が抜けている形なので、背景の名前が字の抜き
     （「心」「理」の内側など）を通り抜けて見える。これは意図した効果であり、
     不具合ではない。ただし字が潰れては本末転倒なので、
     背景色は --paper との差が小さい値に固定してある（CSS 側のコメント参照）。
   ══════════════════════════════════════════════════════════════════ */

/** 背景の帯の本数。⚠ 増やさないこと（上のコメント参照）。 */
const ROWS = 3;

/** 帯ごとの速度（秒）。⚠ 3本が同期して見えないよう、互いに素に近い値を選ぶ。 */
const SPEEDS = [88, 104, 96];

export function TitleHero({ activities }: { activities: Activity[] }) {
  return (
    <section className={styles.hero}>
      {/* ══ 背景：流れる活動名 ══
          ⚠ 装飾なので aria-hidden。リンクにもしない。
            リンクにすると、読めない文字にタブで到達してしまう。 */}
      <div className={styles.bg} aria-hidden>
        {Array.from({ length: ROWS }, (_, row) => (
          <Marquee key={row} dir={row % 2 === 0 ? 'left' : 'right'} speed={SPEEDS[row]}>
            {/* ⚠ 3本に交互に振り分ける。前から順に等分すると、
                  終了したものが最後の1本に固まって密度が偏る。 */}
            {activities
              .filter((_, i) => i % ROWS === row)
              .map((a) => (
                <span key={a.slug} className={styles.bgName}>
                  {a.name}
                </span>
              ))}
          </Marquee>
        ))}
      </div>

      {/* ══ 前面：題字と Mission ══ */}
      <div className={styles.fg}>
        <p className={styles.logo}>
          <Logomark />
        </p>

        <p className={styles.line}>
          <span className={`label ${styles.label}`}>Mission</span>
        </p>
        {/* ⚠ Mission は原文どおり。句読点の追加・語尾の変更・要約はしない。
              <span> は文字を1字も増減させていない（囲んでいるだけ）。 */}
        <h1 className={styles.line}>
          <span className={`${styles.mission} has-kenten`}>
            大学生の溢れ出す<span className="kenten">妄想</span>を形にする
          </span>
        </h1>

        {/* ⚠ Mission の文字列が org.ts と食い違っていないかを型で縛れないため、
              ここで実行時に確認する。ずれたらビルドが落ちる。
              （scripts/build-font-subset.mjs も同じ文字列を機械照合している） */}
        {ORG.mission !== '大学生の溢れ出す妄想を形にする'
          ? (() => {
              throw new Error(
                'TitleHero: ORG.mission と画面の文言が食い違っています。' +
                  'どちらかを直してください。',
              );
            })()
          : null}
      </div>
    </section>
  );
}
