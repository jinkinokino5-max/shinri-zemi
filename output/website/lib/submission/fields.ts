/* ══════════════════════════════════════════════════════════════════
   投稿フォームの項目定義
   根拠：draft/ロードマップ.md 6-1「投稿画面で編集できるもの」の4つの表

   ⚠ ここは lib/schema.ts（公開サイトのデータ形式）の鏡である。
     片方だけ変えると、承認したのに Markdown が壊れてビルドが落ちる。
     項目を足すときは必ず両方を見ること。

   ⚠ ここに「色」「書体」「余白」「レイアウト」の項目は無い。
     無いのは作り忘れではない（ロードマップ 6-1）。
       「色や書体や余白を各自が変えられるようにすると、1年で全体が崩れます。
         デザインの一貫性は、編集できない範囲を決めることで守られます」
     見た目を変えたい人には、部活の独自ページ（/clubs/<slug>/）がある。
   ══════════════════════════════════════════════════════════════════ */

export type Kind = 'work' | 'club' | 'project' | 'event';

export type Field = {
  /** data jsonb の中のキー。lib/schema.ts の項目名と一致させる。 */
  key: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'year'
    | 'yearMonth'
    | 'date'
    | 'url'
    | 'status'
    | 'list'      // 複数追加できるテキスト
    | 'belongsTo' // 既存の部活／PJ／イベントから選ぶ
    | 'tags';
  required?: boolean;
  /** 入力欄の下に出す案内。⚠ 断定できないことは書かない。 */
  hint?: string;
  /** status 型のときのラベル（active / done の呼び名が種類ごとに違う）。 */
  statusLabels?: { active: string; done: string };
};

export const KIND_LABEL: Record<Kind, string> = {
  work: '作品',
  club: '部活',
  project: 'プロジェクト',
  event: 'イベント',
};

/** どのコレクション（content/ の下のフォルダ）に書き出されるか。 */
export const KIND_COLLECTION: Record<Kind, string> = {
  work: 'works',
  club: 'clubs',
  project: 'projects',
  event: 'events',
};

/** 公開後のURL。承認画面に出して、代表が「どこに出るか」を確認できるようにする。 */
export const kindHref = (kind: Kind, slug: string) => `/${KIND_COLLECTION[kind]}/${slug}/`;

/* ── ① 作品（WORKS）── メンバー全員が投稿できる ────── */
const workFields: Field[] = [
  { key: 'title', label: '作品名', type: 'text', required: true },
  {
    key: 'displayNames',
    label: 'サイトに載せる名前',
    type: 'list',
    required: true,
    // ⚠ B-1 本人選択制。この一文は消さないこと。
    hint: '本名でもニックネームでも、あなたが選んだ表記で載ります。本名は保存されません。一緒に作った人がいれば追加してください。',
  },
  {
    key: 'belongsTo',
    label: 'どの部活・PJ・イベントのものか',
    type: 'belongsTo',
    required: true,
    hint: '一覧から選びます。自由入力にしていないのは、表記ゆれで作品が行方不明になるのを防ぐためです。',
  },
  { key: 'year', label: '制作年', type: 'year', required: true },
  {
    key: 'body',
    label: '説明文',
    type: 'textarea',
    required: true,
    hint: '200〜600字くらいが最も見栄えします（目安であって、上限ではありません）。',
  },
  { key: 'tags', label: 'タグ', type: 'tags' },
  { key: 'externalUrl', label: '外部リンク', type: 'url', hint: 'https:// から始まるURL。' },
];

/* ── ② 部活（CLUB）── 部長のみ、自分の部活だけ ────── */
const clubFields: Field[] = [
  { key: 'name', label: '部活名', type: 'text', required: true },
  {
    key: 'status',
    label: '状態',
    type: 'status',
    required: true,
    statusLabels: { active: '活動中', done: '終了' },
    // ⚠ ロードマップ 6-1：「終了」に切り替えても消えず、表示が変わるだけ。
    hint: '「終了」にしても、ページは消えません。表示が変わるだけです。紐づいた作品もそのまま残ります。',
  },
  { key: 'body', label: '紹介文', type: 'textarea', required: true, hint: '100〜300字くらい。' },
  {
    key: 'meetingInfo',
    label: 'いつ・どこで活動しているか',
    type: 'text',
    hint: '新入生がいちばん知りたい情報です。例：毎週水曜 18:00〜／北大構内',
  },
  { key: 'leaderDisplayName', label: '部長の名前（表示する表記）', type: 'text' },
  {
    key: 'organizerCount',
    label: '運営メンバー数',
    type: 'number',
    // ⚠ CLAUDE.md 3-4：根拠のない数字を捏造しない。
    hint: 'その部活を回している人の数。分からなければ空のままにしてください。0 や適当な数を入れないでください。',
  },
  { key: 'foundedYearMonth', label: '設立', type: 'yearMonth', hint: '例：2026-04' },
  { key: 'endedYearMonth', label: '終了', type: 'yearMonth', hint: '終了した部活のみ。' },
];

/* ── ③ プロジェクト（PJ）── PJのメンバーのみ ──────── */
const projectFields: Field[] = [
  { key: 'name', label: 'PJ名', type: 'text', required: true },
  {
    key: 'status',
    label: '状態',
    type: 'status',
    required: true,
    statusLabels: { active: '進行中', done: '終了' },
    hint: '「終了」にしても、ページは消えません。表示が変わるだけです。',
  },
  {
    key: 'purpose',
    label: '目的',
    type: 'text',
    hint: '成果は「目的が達成できているか」で測る、と基本情報にあります。',
  },
  { key: 'period', label: '期間', type: 'text', hint: '例：2026年4月〜9月' },
  { key: 'memberDisplayNames', label: 'メンバー（表示する表記）', type: 'list' },
  { key: 'body', label: '紹介文', type: 'textarea', required: true },
  { key: 'outputUrl', label: '成果物リンク', type: 'url' },
];

/* ── ④ イベント（EVENT）── 運営部・企画部のみ ─────── */
const eventFields: Field[] = [
  { key: 'name', label: 'イベント名', type: 'text', required: true },
  { key: 'date', label: '開催日', type: 'date', required: true, hint: '例：2026-09-04' },
  { key: 'endDate', label: '最終日', type: 'date', hint: '複数日にわたる場合だけ。' },
  { key: 'organizer', label: '主催', type: 'text', hint: '例：運営部' },
  { key: 'audience', label: '対象者', type: 'text' },
  { key: 'participantCount', label: '参加人数', type: 'number', hint: '分かる場合だけ。' },
  { key: 'body', label: '内容', type: 'textarea', required: true },
];

export const FIELDS: Record<Kind, Field[]> = {
  work: workFields,
  club: clubFields,
  project: projectFields,
  event: eventFields,
};

/** その種類が「載せる名前」の項目を持つか（作品だけ、同意チェックが要る）。 */
export const NEEDS_CONSENT: Record<Kind, boolean> = {
  work: true,
  club: false,
  project: false,
  event: false,
};
