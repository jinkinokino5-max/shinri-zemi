// ══════════════════════════════════════════════════════════════════
//  公開前の自動検査
//  根拠：reference/design-research/06_アクセシビリティ・パフォーマンス/
//
//  参考サイトが実測で失敗していた点を、そのまま検査項目にしている。
//    blanca      <h1>〜<h4> が1つも無かった／本文14px
//    techyscouts <h1> が無く <h2> 48px が並列
//    musabi      <h1> のテキストが空（画像で組んでいた）
//
//  ⚠ 代表が毎年替わる前提なので、人の注意力ではなく仕組みで守る。
//  使い方：npm run build のあとに node scripts/check-content.mjs
// ══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠ reference/ はプロジェクト直下のまま。2階層上がプロジェクトのルート。
const projectRoot = resolve(root, '../..');
const OUT = join(root, 'out');
const errors = [];
const warns = [];

// ⚠ GitHub Pages では /<リポジトリ名>/ 配下に配信されるため、
//   HTML内のリンクは basePath 付き（例：/shinri-zemi/clubs/）になる。
//   一方 out/ の中身は basePath を含まない。照合前に取り除く必要がある。
//   next.config.mjs と同じ環境変数を見る。
const BASE_PATH = process.env.BASE_PATH ?? '';
const stripBase = (u) =>
  BASE_PATH && u.startsWith(BASE_PATH) ? u.slice(BASE_PATH.length) || '/' : u;

if (!existsSync(OUT)) {
  console.error('❌ out/ がありません。先に `npm run build` を実行してください。');
  process.exit(1);
}

const toPosix = (p) => p.split('\\').join('/');

/** out/ 配下の .html を再帰的に集める。 */
function htmlFiles(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return htmlFiles(p);
    return f.endsWith('.html') ? [p] : [];
  });
}

const files = htmlFiles(OUT);

/** 実在するURLの集合。リンク切れ検査に使う。 */
const urls = new Set(
  files.map((f) => {
    const rel = toPosix(f.slice(OUT.length));
    return rel.replace(/index\.html$/, '') || '/';
  }),
);

/* ── MVV の原文（reference が唯一の正）──────────────── */
const source = readFileSync(join(projectRoot, 'reference/学生団体基本情報.txt'), 'utf8');
const MVV = [
  '大学生の溢れ出す妄想を形にする',
  '北大で最も大量におもろいことが生まれる場所になる',
  '誰を幸せにできるのかを問い続ける',
  '過去から学ぶことを忘れない',
];
for (const m of MVV) {
  if (!source.includes(m)) {
    errors.push(`MVV「${m}」が reference/学生団体基本情報.txt に存在しない`);
  }
}

for (const file of files) {
  const rel = toPosix(file.slice(OUT.length));
  const html = readFileSync(file, 'utf8');
  const text = html.replace(/<[^>]+>/g, '');

  // 1) <h1> はちょうど1つ（techyscouts の失敗）
  const h1s = html.match(/<h1[\s>]/g) ?? [];
  if (h1s.length !== 1) errors.push(`${rel}：<h1> が ${h1s.length} 個（1個であること）`);

  // 2) <h1> が空でない（musabi の失敗）
  const m1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  if (m1 && m1[1].replace(/<[^>]+>/g, '').trim() === '') {
    errors.push(`${rel}：<h1> が空`);
  }

  // 3) lang="ja"（06資料 2章 日本語固有）
  if (!/<html[^>]*lang="ja"/.test(html)) errors.push(`${rel}：<html lang="ja"> が無い`);

  // 4) 固有の title と description（06資料 4章 SEO）
  if (!/<title>[^<]+<\/title>/.test(html)) errors.push(`${rel}：<title> が無い`);
  if (!/name="description"/.test(html)) warns.push(`${rel}：meta description が無い`);

  // 5) ⚠ 非公認の一文。削除・弱化してはならない（大本資料 0-0）
  if (!text.includes('北海道大学の公認サークルではありません')) {
    errors.push(`${rel}：非公認の一文が無い`);
  }

  // 6) box-shadow を使っていない（大本資料 原理3）
  if (/box-shadow\s*:/.test(html)) warns.push(`${rel}：box-shadow が使われている`);

  // 7) 内部リンク・アセットの飛び先が実在する
  //    ⚠ basePath の付け忘れ／付けすぎは、GitHub Pages で全ページが崩れる事故に直結する。
  //      CSSやJSも実在確認する（href/src 両方）。
  const refs = [
    ...(html.match(/href="(\/[^"#?]*)"/g) ?? []).map((s) => s.slice(6, -1)),
    ...(html.match(/src="(\/[^"#?]*)"/g) ?? []).map((s) => s.slice(5, -1)),
  ];
  for (const raw of refs) {
    // basePath を指定しているのに付いていない参照は、その時点で誤り。
    if (BASE_PATH && !raw.startsWith(BASE_PATH)) {
      errors.push(`${rel}：basePath が付いていない参照 ${raw}`);
      continue;
    }
    const u = stripBase(raw);
    const withSlash = u.endsWith('/') ? u : `${u}/`;
    if (!urls.has(withSlash) && !existsSync(join(OUT, u))) {
      errors.push(`${rel}：リンク切れ ${raw}`);
    }
  }

  // 8) img に alt（06資料 2章）
  for (const img of html.match(/<img[^>]*>/g) ?? []) {
    if (!/\salt=/.test(img)) errors.push(`${rel}：alt の無い <img>`);
  }
}

/* ── MVV がサイト上で原文どおりに出ているか ────────── */
const top = readFileSync(join(OUT, 'index.html'), 'utf8').replace(/<[^>]+>/g, '');
for (const m of MVV) {
  if (!top.includes(m)) errors.push(`トップページに MVV「${m}」が原文どおりに出ていない`);
}

/* ── 結果 ─────────────────────────────────────────── */
console.log(`\n検査したページ：${files.length}`);
warns.forEach((w) => console.log(`⚠  ${w}`));
if (errors.length === 0) {
  console.log('✅ すべての必須項目を満たしています。\n');
} else {
  errors.forEach((e) => console.error(`❌ ${e}`));
  console.error(`\n${errors.length} 件の問題があります。\n`);
  process.exit(1);
}
