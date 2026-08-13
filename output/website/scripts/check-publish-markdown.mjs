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

/* ── 結果 ─────────────────────────────────────────── */

if (failed > 0) {
  console.error(`\n${failed} 件の問題があります。`);
  console.error('supabase/functions/publish/to-markdown.ts と lib/schema.ts の食い違いです。\n');
  process.exit(1);
}
console.log('\n✅ 投稿から Markdown までの往復は、すべて lib/schema.ts を満たしています。\n');
