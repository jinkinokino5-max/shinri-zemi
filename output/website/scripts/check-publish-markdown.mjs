// ══════════════════════════════════════════════════════════════════
//  投稿 → Markdown の検査
//  根拠：draft/ロードマップ.md フェーズ6 6-D
//
//  ⚠ この検査が守っているのは、次のいちばん直しにくい壊れ方である。
//
//      代表が承認した → GitHub にコミットされた → ビルドが落ちた → 公開されない
//
//    このとき、投稿した学生から見ると「通ったのに載らない」。
//    代表から見ると「押したのに何も起きない」。原因はリポジトリの奥にある。
//    起きてから直すのが最も高くつくので、ここで先に潰す。
//
//  やっていること：
//    supabase/functions/publish/to-markdown.ts が吐いた Markdown を、
//    サイト本体が使うのと同じ gray-matter と同じ lib/schema.ts の Zod に通す。
//
//  使い方：npm run check:publish
// ══════════════════════════════════════════════════════════════════

import matter from 'gray-matter';
import { schemas } from '../lib/schema.ts';
import { toMarkdown } from '../supabase/functions/publish/to-markdown.ts';

const COLLECTION = { work: 'works', club: 'clubs', project: 'projects', event: 'events' };
const TODAY = new Date('2026-08-12T00:00:00Z');

let failed = 0;

/** 1件ぶんの往復を試す。 */
function check(label, row, { photos = [] } = {}) {
  const collection = COLLECTION[row.kind];
  const photoDir = `/photos/${collection}/${row.target_slug}`;
  const md = toMarkdown({ ...row, images: photos }, photoDir, TODAY);

  let parsed;
  try {
    parsed = matter(md);
  } catch (e) {
    console.error(`❌ ${label}：フロントマターとして読めません\n${e.message}\n--- 出力 ---\n${md}`);
    failed++;
    return;
  }

  const result = schemas[collection].safeParse({
    ...parsed.data,
    slug: row.target_slug,
    body: parsed.content.trim(),
  });

  if (!result.success) {
    console.error(`❌ ${label}：lib/schema.ts の検証に落ちました`);
    for (const i of result.error.issues) {
      console.error(`      ・${i.path.join('.') || '(全体)'}：${i.message}`);
    }
    console.error(`--- 出力 ---\n${md}`);
    failed++;
    return;
  }

  console.log(`✅ ${label}`);
  return { md, value: result.data };
}

/* ── ふつうの投稿 ─────────────────────────────────── */

check('作品（写真なし）', {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  kind: 'work',
  target_slug: 'rakugaki-bon-2026',
  data: {
    title: 'らくがき本 2026',
    displayNames: ['みずき'],
    belongsTo: { kind: 'project', slug: 'rakugaki-bon' },
    year: 2026,
    body: '部員が持ち寄ったらくがきを1冊にまとめました。',
    tags: ['冊子', 'イラスト'],
  },
});

check(
  '作品（写真3枚。1枚目が cover、残りが images）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    kind: 'work',
    target_slug: 'tofu-game',
    data: {
      title: 'とうふゲーム',
      displayNames: ['あお', 'Ken'],
      belongsTo: { kind: 'project', slug: 'tofu-game' },
      year: 2026,
      body: 'とうふを運ぶゲームです。',
      externalUrl: 'https://example.com/tofu',
    },
  },
  {
    photos: [
      { path: 'uid/sub/aaaa1111.jpg', alt: '完成した盤面' },
      { path: 'uid/sub/bbbb2222.jpg', alt: '制作中のようす' },
      { path: 'uid/sub/cccc3333.jpg', alt: '遊んでいるところ' },
    ],
  },
);

check('部活（任意項目あり）', {
  id: 'aaaaaaaa-0000-0000-0000-000000000003',
  kind: 'club',
  target_slug: 'dokusho',
  data: {
    name: '読書部',
    status: 'active',
    foundedYearMonth: '2026-04',
    organizerCount: 3,
    meetingInfo: '毎週水曜 18:00〜／北大構内',
    leaderDisplayName: 'みずき',
    body: '好きな本を持ち寄って話します。',
  },
});

check('PJ（終了・メンバー複数）', {
  id: 'aaaaaaaa-0000-0000-0000-000000000004',
  kind: 'project',
  target_slug: 'kaimin',
  data: {
    name: '快眠PJ',
    status: 'done',
    purpose: 'よく眠れる方法を探す',
    period: '2026年4月〜7月',
    memberDisplayNames: ['あお', 'みずき', 'Ken'],
    body: '眠りについて調べました。',
    outputUrl: 'https://example.com/kaimin',
  },
});

check('イベント（複数日）', {
  id: 'aaaaaaaa-0000-0000-0000-000000000005',
  kind: 'event',
  target_slug: 'doto',
  data: {
    name: '道東合宿',
    date: '2026-09-04',
    endDate: '2026-09-06',
    organizer: '運営部',
    audience: 'メンバー',
    participantCount: 12,
    body: '道東で合宿します。',
  },
});

/* ── 壊しにくる入力 ───────────────────────────────
   ⚠ ここが本題。学生の自由入力には、記号も改行も普通に入ってくる。 */

check('引用符・コロン・改行・絵文字が入った作品名', {
  id: 'aaaaaaaa-0000-0000-0000-000000000006',
  kind: 'work',
  target_slug: 'kikenna-namae',
  data: {
    title: '「妄想」: 第1回 — \\ と " と # が入った名前 🎨',
    displayNames: ['name: with colon', '"quoted"'],
    belongsTo: { kind: 'club', slug: 'dokusho' },
    year: 2026,
    body: '本文には\n改行が\n入ります。\n\n---\n\n本文中の区切り線も壊してはいけない。',
    tags: ['a: b', 'c"d'],
  },
});

check('空文字・空配列・undefined が混ざった投稿', {
  id: 'aaaaaaaa-0000-0000-0000-000000000007',
  kind: 'club',
  target_slug: 'kara',
  data: {
    name: 'からっぽ部',
    status: 'active',
    body: '任意の項目は全部あけてあります。',
    // ⚠ 空文字が書き出されると optional が「空である」に化ける。
    meetingInfo: '',
    leaderDisplayName: undefined,
    organizerCount: undefined,
    endedYearMonth: '',
  },
});

/* ── 書き出されてはいけないものが出ていないか ────── */

const kara = check('（再掲）空の項目が Markdown に出ていないこと', {
  id: 'aaaaaaaa-0000-0000-0000-000000000008',
  kind: 'club',
  target_slug: 'kara2',
  data: { name: 'からっぽ部2', status: 'active', body: 'あ', meetingInfo: '', organizerCount: undefined },
});

if (kara && /meetingInfo|organizerCount/.test(kara.md)) {
  console.error('❌ 空の任意項目が書き出されています（分からない値が「空」として固定されます）');
  failed++;
}

// ⚠ 写真が無いときに cover が出ないこと。出ると lib/content.ts が
//   「あるはずの写真が無い」としてビルドを止める。
const noPhoto = check('（再掲）写真が無いとき cover が出ないこと', {
  id: 'aaaaaaaa-0000-0000-0000-000000000009',
  kind: 'work',
  target_slug: 'shashin-nashi',
  data: {
    title: '写真なし',
    displayNames: ['みずき'],
    belongsTo: { kind: 'club', slug: 'dokusho' },
    year: 2026,
    body: 'まだ写真がありません。',
  },
});

if (noPhoto && /^cover:/m.test(noPhoto.md)) {
  console.error('❌ 写真が無いのに cover が書き出されています');
  failed++;
}

/* ── 直す提案（op='update'）───────────────────────
   ⚠ 直す提案には keepImages が入ってくる。これはコンテンツの項目ではなく、
     「いま載っている写真をそのまま残す」という指示である。
     フロントマターに漏れると、lib/schema.ts が知らない項目が .md に残り続ける。 */

const kept = check(
  '直す提案（いまの写真をそのまま残す）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000010',
    kind: 'work',
    target_slug: 'tofu-game',
    data: {
      title: 'とうふゲーム（改訂）',
      displayNames: ['あお'],
      belongsTo: { kind: 'project', slug: 'tofu-game' },
      year: 2026,
      body: '説明文だけ直しました。',
      publishedAt: '2026-05-01',
      keepImages: [
        { src: '/photos/works/tofu-game/aaaa1111.jpg', alt: '完成した盤面' },
        { src: '/photos/works/tofu-game/bbbb2222.jpg', alt: '制作中のようす' },
      ],
    },
  },
  { photos: [] },
);

if (kept) {
  if (/keepImages/.test(kept.md)) {
    console.error('❌ keepImages がフロントマターに漏れています（内部の指示であって項目ではない）');
    failed++;
  }
  if (kept.value.cover?.src !== '/photos/works/tofu-game/aaaa1111.jpg') {
    console.error('❌ 残した写真の1枚目が cover になっていません');
    failed++;
  }
  // ⚠ 直すたびに公開日が今日へ動くと、去年の作品が毎回新着になる。
  if (kept.value.publishedAt !== '2026-05-01') {
    console.error(`❌ 公開日が書き換わっています（${kept.value.publishedAt}）`);
    failed++;
  }
}

const mixed = check(
  '直す提案（残す写真＋足す写真。並びは 残す→足す）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000011',
    kind: 'work',
    target_slug: 'tofu-game',
    data: {
      title: 'とうふゲーム',
      displayNames: ['あお'],
      belongsTo: { kind: 'project', slug: 'tofu-game' },
      year: 2026,
      body: '写真を1枚足しました。',
      keepImages: [{ src: '/photos/works/tofu-game/aaaa1111.jpg', alt: '完成した盤面' }],
    },
  },
  { photos: [{ path: 'uid/sub/dddd4444.jpg', alt: '追加した写真' }] },
);

if (mixed) {
  // ⚠ 一覧に出る写真（cover）が、文章を直しただけで入れ替わってはいけない。
  if (mixed.value.cover?.src !== '/photos/works/tofu-game/aaaa1111.jpg') {
    console.error('❌ 写真を足しただけで cover が入れ替わっています');
    failed++;
  }
  if (mixed.value.images?.[0]?.src !== '/photos/works/tofu-game/dddd4444.jpg') {
    console.error('❌ 足した写真が images に入っていません');
    failed++;
  }
}

check('直す提案（写真を全部外した＝写真の無いページにする指示）', {
  id: 'aaaaaaaa-0000-0000-0000-000000000012',
  kind: 'club',
  target_slug: 'dokusho',
  data: {
    name: '読書部',
    status: 'active',
    body: '写真を外しました。',
    keepImages: [],
  },
});

/* ── 切り抜きの位置（focus）───────────────────────
   ⚠ ここは実際に壊れた場所である（2026-08-13）。
     images は「配列の中のオブジェクト」で、その中にさらに focus という
     オブジェクトが入る。字下げを1段間違えるだけでフロントマターが崩れ、
     承認したのにビルドが落ちる、といういちばん直しにくい壊れ方になる。 */

const framed = check(
  '焦点つきの写真（cover と images の両方に入れ子が出る）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000013',
    kind: 'work',
    target_slug: 'framed',
    data: {
      title: '切り抜きを指定した作品',
      displayNames: ['みずき'],
      belongsTo: { kind: 'club', slug: 'dokusho' },
      year: 2026,
      body: '縦長の写真なので、上のほうを残しています。',
    },
  },
  {
    photos: [
      { path: 'uid/sub/aaaa1111.jpg', alt: '表紙', focus: { x: 40, y: 22, zoom: 1.6 } },
      { path: 'uid/sub/bbbb2222.jpg', alt: '中身', focus: { x: 70, y: 50, zoom: 1 } },
      { path: 'uid/sub/cccc3333.jpg', alt: '裏表紙' },
    ],
  },
);

if (framed) {
  if (framed.value.cover?.focus?.y !== 22 || framed.value.cover?.focus?.zoom !== 1.6) {
    console.error('❌ cover の focus が読み戻せません');
    failed++;
  }
  if (framed.value.images?.[0]?.focus?.x !== 70) {
    console.error('❌ images の中の focus が読み戻せません（字下げが崩れている可能性）');
    failed++;
  }
  // ⚠ まん中・等倍は書き出さない。全部の写真に既定値が並ぶと、
  //   .md を読んだ人が「何か指定されている」と誤解する。
  if (framed.value.images?.[1]?.focus !== undefined) {
    console.error('❌ 指定していない写真にまで focus が書き出されています');
    failed++;
  }
}

check('まん中・等倍を明示的に渡しても、focus は書き出されないこと', {
  id: 'aaaaaaaa-0000-0000-0000-000000000014',
  kind: 'club',
  target_slug: 'mannaka',
  data: {
    name: 'まん中部',
    status: 'active',
    body: '既定値です。',
    keepImages: [
      { src: '/photos/clubs/mannaka/1.jpg', alt: '活動のようす', focus: { x: 50, y: 50, zoom: 1 } },
    ],
  },
});

/* ── 写真の並び（data.photos）─────────────────────
   ⚠ ここは実際に事故が起きた場所である（2026-08-13）。
     ・部活に2枚目を投稿すると、写真ファイルだけがリポジトリに残り、
       .md からは参照されないまま消えた（images が作品専用だったため）
     ・「残す写真」と「足す写真」が別配列で、新しい写真を表紙にできなかった
     ・投稿画面が両方の先頭を「1枚目」と呼び、投稿者が取り違えた
   直したのは構造（並びを1本にした）なので、ここで並びを検査する。 */

const belt = check(
  '部活の2枚目以降が書き出されること（かつて捨てられていた）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000015',
    kind: 'club',
    target_slug: 'dokusho',
    data: {
      name: '読書部',
      status: 'active',
      body: '写真を3枚入れました。',
      photos: [
        { src: '/photos/clubs/dokusho/1.jpg', alt: '表紙' },
        { src: '/photos/clubs/dokusho/2.jpg', alt: '本文1' },
        { path: 'uid/sub/eeee5555.jpg', alt: '本文2' },
      ],
    },
  },
  { photos: [{ path: 'uid/sub/eeee5555.jpg', alt: '本文2' }] },
);

if (belt) {
  if (belt.value.cover?.src !== '/photos/clubs/dokusho/1.jpg') {
    console.error('❌ 並びの1件目が表紙になっていません');
    failed++;
  }
  if ((belt.value.images ?? []).length !== 2) {
    console.error(`❌ 部活の2枚目以降が書き出されていません（${(belt.value.images ?? []).length}枚）`);
    failed++;
  }
  if (belt.value.images?.[1]?.src !== '/photos/clubs/dokusho/eeee5555.jpg') {
    console.error('❌ 新しく上げた写真のパスが公開URLに直っていません');
    failed++;
  }
}

const newCover = check(
  '新しく上げた写真を表紙にできること（並びの1件目が新規）',
  {
    id: 'aaaaaaaa-0000-0000-0000-000000000016',
    kind: 'project',
    target_slug: 'kaimin',
    data: {
      name: '快眠PJ',
      status: 'active',
      body: '表紙を新しい写真に差し替えました。',
      photos: [
        { path: 'uid/sub/ffff6666.jpg', alt: '新しい表紙', focus: { x: 20, y: 80, zoom: 2 } },
        { src: '/photos/projects/kaimin/old.jpg', alt: '前の表紙' },
      ],
    },
  },
  { photos: [{ path: 'uid/sub/ffff6666.jpg', alt: '新しい表紙' }] },
);

if (newCover) {
  // ⚠ 並びを1本にする前は、残す写真が必ず先に来るため、これができなかった。
  if (newCover.value.cover?.src !== '/photos/projects/kaimin/ffff6666.jpg') {
    console.error('❌ 新しく上げた写真を表紙にできていません');
    failed++;
  }
  if (newCover.value.cover?.focus?.zoom !== 2) {
    console.error('❌ 表紙の focus が落ちています');
    failed++;
  }
  if (newCover.value.images?.[0]?.src !== '/photos/projects/kaimin/old.jpg') {
    console.error('❌ 前の表紙が本文中の写真に回っていません');
    failed++;
  }
}

const legacy = check('古い下書き（keepImages ＋ images）も、まだ開けること', {
  id: 'aaaaaaaa-0000-0000-0000-000000000017',
  kind: 'event',
  target_slug: 'doto',
  data: {
    name: '道東合宿',
    date: '2026-09-04',
    body: '2026-08-13 より前に保存された下書きの形。',
    keepImages: [{ src: '/photos/events/doto/1.jpg', alt: '前からある写真' }],
  },
});

if (legacy && legacy.value.cover?.src !== '/photos/events/doto/1.jpg') {
  console.error('❌ 古い形の下書きで写真が失われています');
  failed++;
}

if (legacy && /photos:|keepImages/.test(legacy.md)) {
  console.error('❌ 内部の指示（photos / keepImages）がフロントマターに漏れています');
  failed++;
}

/* ── 結果 ─────────────────────────────────────────── */

if (failed > 0) {
  console.error(`\n${failed} 件の問題があります。`);
  console.error('supabase/functions/publish/to-markdown.ts と lib/schema.ts の食い違いです。\n');
  process.exit(1);
}
console.log('\n✅ 投稿から Markdown までの往復は、すべて lib/schema.ts を満たしています。\n');
