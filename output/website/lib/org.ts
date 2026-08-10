/* ══════════════════════════════════════════════════════════════════
   団体の基本情報（サイト全体で唯一の出所）
   根拠：reference/学生団体基本情報.txt ／ draft/必要情報更新.txt

   ⚠ 数字をページに直接書かない。必ずここを参照する。
     同じ数字が複数ページに散らばると、更新漏れで矛盾が生まれる。

   ⚠ 分からない数字は null にする。0 で埋めない（CLAUDE.md 3-4）。
     null のとき画面には「––」が出る。
   ══════════════════════════════════════════════════════════════════ */

/* ⚠ サイトの公開URL。
     いまは GitHub Pages の暫定URL。独自ドメインを取得したらここを書き換える。
     sitemap.xml・OGP・構造化データがすべてこの値を使う。
     ここを直し忘れると、SNSでシェアしたときに画像が出ない。 */
export const SITE_URL =
  process.env.SITE_URL ?? 'https://jinkinokino5-max.github.io/shinri-zemi';

export const ORG = {
  name: '北大心理ゼミ',
  /** ⚠ 心理学とは無関係の団体。PSYCHOLOGY と英訳せず、ローマ字転写のみ使う。 */
  romaji: 'HOKUDAI SHINRI ZEMI',

  established: '2022-04',
  establishedLabel: '2022.04',

  /** 2026-08-10 時点。 */
  memberCount: 56,

  email: 'hokkaido.u.psychology@gmail.com',

  social: [
    { label: 'Instagram', href: 'https://www.instagram.com/tan1_is_rational/' },
    { label: 'X', href: 'https://x.com/hokudaishinri' },
  ],

  /** ⚠ 削除・弱化してはならない。文面は 2026-08-10 に団体が確定したもの。 */
  affiliationNotice: '北大心理ゼミは、北海道大学の公認サークルではありません。',

  /* ── MVV ─────────────────────────────────────────
     ⚠ 一字一句、原文どおり。句読点の追加・語尾の変更・要約はいずれも禁止。
       レイアウトに収まらない場合は、文言ではなく文字サイズ・改行位置・
       余白の側を調整する（大本資料 0-1）。
     ⚠ scripts/build-font-subset.mjs が reference/学生団体基本情報.txt と
       機械照合しており、ずれるとビルドが止まる。 */
  mission: '大学生の溢れ出す妄想を形にする',
  vision: '北大で最も大量におもろいことが生まれる場所になる',
  values: ['誰を幸せにできるのかを問い続ける', '過去から学ぶことを忘れない'],

  /* ── 目的（原文どおり）───────────────────────────── */
  purposes: [
    '大学生が学びを得て、新しい挑戦につなげる場をつくる',
    'イベント・部活・PJを通じて、学生の興味や挑戦を形にする',
    '多様な学生が交わり、イノベーションが生まれる環境をつくる',
    '組織を持続させ、人の成長に寄与する',
  ],

  /** ⚠ 年間の企画数は増え続けるため確定不能。固定値を掲載しない。
   *    null のまま「––」を出す。推測で埋めないこと。 */
  eventsPerYear: null as number | null,
} as const;

/** 数値を画面に出す。⚠ 未確定（null / undefined）は「––」にする。 */
export function figure(value: number | null | undefined): string {
  return value === null || value === undefined ? '––' : String(value);
}
