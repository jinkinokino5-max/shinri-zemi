// ══════════════════════════════════════════════════════════════════
//  明朝サブセットURLの自動生成
//  根拠：draft/デザイン大本資料_v1.md 4-2「サブセット書体の絶対ルール」
//
//  Google Fonts の text= パラメータに使用文字を渡すと、その文字だけを
//  含む単一の @font-face が返る（121分割のスライスではなくなる）。
//  実測：42字で 11,980 bytes。サブセットなしの推定150〜300KB に対し約95%削減。
//
//  ⚠ この仕組みが必要な理由
//    サブセット書体は「URLで指定した字しか持たない」。範囲外の文字を流すと
//    その文字だけ別書体になり、見た目が崩れる。
//    MVVの文言を変えたときに URL の更新を忘れると、静かに壊れる。
//    → 人が手で管理してはいけない。ビルド時に必ず再生成する。
//
//  出力：lib/generated/font-subset.ts（コミット対象。差分で変化が見える）
// ══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// ⚠ reference/ はプロジェクト直下のまま（サイトのコードは output/website/ に置いた）。
//   2階層上がプロジェクトのルート。
const projectRoot = resolve(root, '../..');

/* ⚠ MVV は reference/学生団体基本情報.txt が唯一の正。
     ここに直接書き写さず、ファイルから読んで一字一句を保証する。
     （大本資料 0-1：団体の言葉をデザイン上の都合で書き換えてはならない） */
const SOURCE = resolve(projectRoot, 'reference/学生団体基本情報.txt');

/** 明朝（--font-serif）で組む文字列。⚠ 増やしたらビルドが自動で追随する。 */
export const SERIF_TEXTS = [
  '大学生の溢れ出す妄想を形にする',                 // Mission
  '北大で最も大量におもろいことが生まれる場所になる', // Vision
  '誰を幸せにできるのかを問い続ける',               // Value 1
  '過去から学ぶことを忘れない',                     // Value 2
];

function main() {
  const source = readFileSync(SOURCE, 'utf8');

  // ⚠ 原文照合。1つでも一致しなければビルドを止める。
  //   「レイアウトの都合で文言を変えてしまった」事故を、仕組みで防ぐ。
  const missing = SERIF_TEXTS.filter((t) => !source.includes(t));
  if (missing.length > 0) {
    console.error('\n❌ 原文と一致しない文字列があります。');
    console.error('   reference/学生団体基本情報.txt に存在しません：');
    missing.forEach((m) => console.error(`     - ${m}`));
    console.error('\n   MVV は一字一句、原文どおりでなければなりません（大本資料 0-1）。');
    console.error('   団体が文言を変えた場合は、まず reference/ 側を更新してください。\n');
    process.exit(1);
  }

  const chars = [...new Set(SERIF_TEXTS.join(''))].sort();
  const text = encodeURIComponent(chars.join(''));
  const url = `https://fonts.googleapis.com/css2?family=Shippori+Mincho&text=${text}&display=swap`;

  const out = `// ⚠ 自動生成ファイル。手で編集しないこと。
// 生成元：scripts/build-font-subset.mjs（npm run dev / build の前に必ず走る）
// 生成日時は書かない（差分がノイズになるため）。

/** Shippori Mincho のサブセットURL。⚠ 収録字は下の SERIF_SUBSET_CHARS だけ。 */
export const SERIF_SUBSET_URL =
  '${url}';

/** サブセットに収録されている文字（${chars.length}字）。
 *  ⚠ この範囲外の文字に --font-serif を当てると、その文字だけ別書体になる。 */
export const SERIF_SUBSET_CHARS = '${chars.join('')}';

/** 開発時の検査用。--font-serif を当てる文字列が範囲内か確かめる。 */
export function isCoveredBySerifSubset(s: string): boolean {
  return [...s].every((c) => SERIF_SUBSET_CHARS.includes(c));
}
`;

  const outPath = resolve(root, 'lib/generated/font-subset.ts');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, out, 'utf8');

  console.log(`✅ 明朝サブセット：${chars.length}字（原文照合 ${SERIF_TEXTS.length}/${SERIF_TEXTS.length} 一致）`);
  console.log(`   → lib/generated/font-subset.ts`);
}

main();
