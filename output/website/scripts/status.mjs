// ══════════════════════════════════════════════════════════════════
//  入力状況の一覧
//  「あと何を書けばいいか」を一目で分かるようにするためのもの。
//
//  使い方：  npm run status
//
//  ⚠ 埋まっていないこと自体は問題ではない。
//    サイトは項目が空でも成立する設計にしてある（大本資料 6-4）。
//    これは「急かすため」ではなく「どこから手をつけるか決めるため」の表。
// ══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const LABEL = { clubs: '部活', projects: 'PJ', events: 'イベント', works: '作品' };

/** その項目に「本当に値が入っているか」。空文字や空配列は未入力とみなす。 */
function has(v) {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return true;
}

const rows = [];

for (const kind of Object.keys(LABEL)) {
  const dir = join(root, 'content', kind);
  if (!existsSync(dir)) continue;

  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const slug = file.replace(/\.md$/, '');
    const raw = readFileSync(join(dir, file), 'utf8');
    const { data, content } = matter(raw);

    // 本文から HTML コメント（説明文）を取り除いて、実際に書かれた文字数を数える
    const body = content.replace(/<!--[\s\S]*?-->/g, '').trim();

    const missing = [];
    if (body.length === 0) missing.push('紹介文');
    else if (body.length < 60) missing.push(`紹介文が短い（${body.length}字）`);
    if (!has(data.cover)) missing.push('写真');

    if (kind === 'clubs') {
      if (!has(data.leaderDisplayName)) missing.push('部長');
      if (!has(data.organizerCount)) missing.push('運営メンバー数');
      if (!has(data.meetingInfo)) missing.push('活動日時・場所');
    }
    if (kind === 'projects') {
      if (!has(data.purpose)) missing.push('目的');
      if (!has(data.period)) missing.push('期間');
      if (!has(data.memberDisplayNames)) missing.push('メンバー');
    }
    if (kind === 'events') {
      if (!has(data.organizer)) missing.push('主催');
      if (!has(data.audience)) missing.push('対象者');
    }

    rows.push({ kind, slug, name: data.name ?? data.title ?? slug, missing, body: body.length });
  }
}

console.log('\n════════════════════════════════════════════════════════');
console.log('  入力状況');
console.log('════════════════════════════════════════════════════════');

for (const kind of Object.keys(LABEL)) {
  const list = rows.filter((r) => r.kind === kind);
  if (list.length === 0) continue;

  const done = list.filter((r) => r.missing.length === 0).length;
  console.log(`\n■ ${LABEL[kind]}（${list.length}件／すべて埋まっているもの ${done}件）\n`);

  for (const r of list) {
    if (r.missing.length === 0) {
      console.log(`  ✅ ${r.name}`);
    } else {
      console.log(`  ・${r.name}`);
      console.log(`      未入力：${r.missing.join('／')}`);
      console.log(`      ファイル：content/${r.kind}/${r.slug}.md`);
    }
  }
}

const totalMissing = rows.reduce((n, r) => n + r.missing.length, 0);
console.log('\n════════════════════════════════════════════════════════');
if (totalMissing === 0) {
  console.log('  すべて埋まっています。');
} else {
  console.log(`  未入力：合計 ${totalMissing} 項目`);
  console.log('');
  console.log('  ⚠ 空のままでもサイトは正しく表示されます。');
  console.log('    写真が無い枠は、名前だけの落ち着いた面になります。');
  console.log('    分からない数字を 0 や適当な値で埋めないでください。');
  console.log('');
  console.log('  効果が大きい順：');
  console.log('    1. 紹介文（100〜300字）  ページが一気に埋まります');
  console.log('    2. 道東合宿の内容        9/4開催。告知として効きます');
  console.log('    3. 写真                  加工不要。撮ったままで大丈夫です');
}
console.log('════════════════════════════════════════════════════════\n');
