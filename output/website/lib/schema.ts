import { z } from 'zod';

/* ══════════════════════════════════════════════════════════════════
   データスキーマ
   根拠：draft/デザイン大本資料_v1.md 9-1 ／ draft/ロードマップ.md 1-3

   ⚠ この定義が、将来の投稿機能（P6）のデータベース設計にそのまま
     引き継がれる。ここだけは後から変えにくいので、慎重に扱うこと。

   ⚠ 守っている3つの原則
     1. cover は必ず optional。空のときフォールバック表示に切り替える
        （大本資料 6-4 ／ 6-4 は「⚠ 必須」と明記されている）
     2. 数値も optional。分からない数字を 0 で埋めない
        （CLAUDE.md 3-4：根拠のない数字を捏造しない）
     3. 本名を保存しない。表示名 1 項目だけを持つ
        （必要情報更新 B-1：本人選択制。保存しなければ漏れない）
   ══════════════════════════════════════════════════════════════════ */

/** 活動の状態。部活・PJ の両方が持つ（2026-08-10：部活も終了するため追加）。
 *  ⚠ 終了しても削除しない。status を 'done' に変えるだけ。理由は3つ：
 *    ① Value「過去から学ぶことを忘れない」をデータ構造として実装する
 *    ② 終了したものに紐づく作品がリンク切れにならない
 *    ③ 活動の積み重ねが数字で示せる（PJ 進行中5／終了5） */
export const Status = z.enum(['active', 'done']);
export type Status = z.infer<typeof Status>;

/**
 * 枠の中で写真のどこを見せるか。
 *
 * ⚠ なぜ要るか
 *   1枚目（cover）は、出る場所ごとに違う比率へ切り抜かれる。
 *     一覧カード 4:3 ／ トップの帯 16:10 ／ 部活・PJ 16:9 ／ 作品ページ 3:2
 *   縦長の写真を 16:9 に切ると、まん中しか残らない。
 *   人が写っていれば顔が切れるし、作品なら題字が切れる。
 *   投稿者が「どこを残すか」を決められないと、これは直しようがない。
 *
 * ⚠ すべて optional。省略時は「まん中・等倍」で、これまでと同じ表示になる。
 *   既存の content/*.md を1文字も書き換えずに済むようにしてある。
 *
 * ⚠ 切り抜きの結果を .md に焼き込まない（画像そのものは切らない）。
 *   焼き込むと、あとで比率を変えたときに直せなくなる。
 *   ここに残すのは「どこを中心に見せたいか」という意図だけである。
 */
const Focus = z.object({
  /** 横の中心。0=左端 50=まん中 100=右端。CSS の object-position に渡す。 */
  x: z.number().min(0).max(100).default(50),
  /** 縦の中心。0=上端 50=まん中 100=下端。 */
  y: z.number().min(0).max(100).default(50),
  /** 拡大率。1=そのまま。⚠ 3倍を超えると、どんな写真も荒れる。 */
  zoom: z.number().min(1).max(3).default(1),
});
export type Focus = z.infer<typeof Focus>;

/** 画像への参照。⚠ alt は必須（06資料 2章：装飾画像以外は alt を入れる）。 */
const ImageRef = z.object({
  src: z.string(),
  alt: z.string(),
  focus: Focus.optional(),
});
export type ImageRef = z.infer<typeof ImageRef>;

/** 全コンテンツ共通の土台。 */
const base = {
  /** URLになる。半角英数とハイフンのみ。⚠ 公開後は変えない（リンクが切れる）。 */
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug は半角英小文字・数字・ハイフンのみ'),
  /** 画面に出す名前。日本語でよい。 */
  name: z.string().min(1),
  /** 本文（Markdown）。 */
  body: z.string().default(''),
  /** ⚠ optional。無いときは 6-4 のフォールバック表示になる。 */
  cover: ImageRef.optional(),
};

/* ── 部活 ───────────────────────────────────────────── */
export const Club = z.object({
  ...base,
  status: Status,
  /** 例：'2026-04'。⚠ 現在は全部活とも暫定値（必要情報更新 C-2）。 */
  foundedYearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** 終了した部活のみ。例：'2026-06'（ラジオ部・心理シェア部）。 */
  endedYearMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  /** ⚠ 表示名のみ。本名は保存しない（B-1）。 */
  leaderDisplayName: z.string().optional(),
  /** 運営メンバー数（その部活を回している人の数）。
   *  ⚠ 2026-08-10：「部員数」から変更した。
   *    部活は参加が流動的で「部員」の線引きが曖昧になりやすい。
   *    実態を偽らずに書ける数字として、運営している人の数を採る。
   *  ⚠ optional。分からないとき 0 を入れない。 */
  organizerCount: z.number().int().positive().optional(),
  /** 新入生が最も知りたい情報（必要情報更新 C-2）。 */
  meetingInfo: z.string().optional(),
});
export type Club = z.infer<typeof Club> & { collection: 'clubs' };

/* ── プロジェクト ───────────────────────────────────── */
export const Project = z.object({
  ...base,
  status: Status,
  /** 基本情報に「成果は目的が達成できているか」とあるため、目的の明示が重要。 */
  purpose: z.string().optional(),
  period: z.string().optional(),
  /** ⚠ 表示名のみ。 */
  memberDisplayNames: z.array(z.string()).default([]),
  outputUrl: z.string().url().optional(),
});
export type Project = z.infer<typeof Project> & { collection: 'projects' };

/* ── イベント ───────────────────────────────────────── */
export const EventItem = z.object({
  ...base,
  /** 例：'2026-09-04'。 */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  /** 運営部 / 企画部 など。 */
  organizer: z.string().optional(),
  audience: z.string().optional(),
  participantCount: z.number().int().positive().optional(),
});
export type EventItem = z.infer<typeof EventItem> & { collection: 'events' };

/* ── 作品 ───────────────────────────────────────────── */
export const Work = z.object({
  slug: base.slug,
  title: z.string().min(1),
  body: base.body,
  cover: base.cover,
  /** ⚠ B-1 本人選択制。本名かニックネームかは投稿者が選ぶ。
   *     システムは選ばれた側だけを保存し、本名は持たない。 */
  displayNames: z.array(z.string()).min(1),
  /** どの部活／PJ／イベントのものか。⚠ 自由入力にせず既存から選ばせる。 */
  belongsTo: z.object({
    kind: z.enum(['club', 'project', 'event']),
    slug: z.string(),
  }),
  year: z.number().int().min(2000).max(2100),
  publishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  images: z.array(ImageRef).default([]),
  tags: z.array(z.string()).default([]),
  externalUrl: z.string().url().optional(),
});
export type Work = z.infer<typeof Work> & { collection: 'works' };

/** コレクション名 → スキーマ。scripts/check-content.mjs と lib/content.ts が使う。 */
export const schemas = {
  clubs: Club,
  projects: Project,
  events: EventItem,
  works: Work,
} as const;

export type CollectionName = keyof typeof schemas;
