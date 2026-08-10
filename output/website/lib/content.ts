import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import { z } from 'zod';
import { schemas, type CollectionName } from './schema';

/* ══════════════════════════════════════════════════════════════════
   コンテンツ読み込み
   根拠：reference/design-research/08_技術スタック検討/技術スタック比較と推奨.md

   08資料は Astro の Content Collections を推奨していた。
   本件は投稿機能（P6）のため Next.js を採用したので、
   その考え方だけを移植する：**Markdown＋フロントマター＋Zod検証**。

   ⚠ Zod で検証する理由（08資料の言葉）
     「学生が項目名を間違えるとビルドが失敗して教えてくれる。
       運用事故を仕組みで防げる」
     代表が毎年替わる本件では、人の注意力に頼る運用は必ず破綻する。

   ⚠ ここはサーバー側（ビルド時）でのみ動く。'use client' から呼ばない。
   ══════════════════════════════════════════════════════════════════ */

const CONTENT_DIR = join(process.cwd(), 'content');

/** コレクション名から、そのコレクションの要素型を得る。 */
export type Entry<K extends CollectionName> = z.infer<(typeof schemas)[K]>;

function readCollection<K extends CollectionName>(name: K): Entry<K>[] {
  const dir = join(CONTENT_DIR, name);
  if (!existsSync(dir)) return [];

  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((file): Entry<K> => {
      const slug = file.replace(/\.md$/, '');
      const raw = readFileSync(join(dir, file), 'utf8');
      const { data, content } = matter(raw);

      // ⚠ schemas[name] は K が総称のままだと4スキーマの合併型になり、
      //   絞り込みが効かない。unknown を経由して当該コレクションの型に固定する。
      //   検証そのものは実行時に正しく行われる（安全性は落ちていない）。
      const schema = schemas[name] as unknown as z.ZodType<Entry<K>>;
      const parsed = schema.safeParse({ ...data, slug, body: content.trim() });

      if (!parsed.success) {
        // ⚠ ここで止める。壊れたデータのまま公開されるより、ビルドが落ちるほうがよい。
        const issues = parsed.error.issues
          .map((i) => `      ・${i.path.join('.') || '(全体)'}：${i.message}`)
          .join('\n');
        throw new Error(
          `\n❌ content/${name}/${file} の内容に問題があります。\n${issues}\n` +
            `   項目名と形式は lib/schema.ts を見てください。\n`,
        );
      }

      // ⚠ cover に書いた写真が実在するかを確かめる。
      //   書き間違いや置き忘れがあると、公開サイトで画像が壊れて表示される。
      //   「写真が無い」のは 6-4 のフォールバックで正しく処理されるが、
      //   「あるはずの写真が無い」は事故なので、ここで止める。
      const cover = (parsed.data as { cover?: { src: string } }).cover;
      if (cover?.src && cover.src.startsWith('/')) {
        const filePath = join(process.cwd(), 'public', cover.src);
        if (!existsSync(filePath)) {
          throw new Error(
            `\n❌ content/${name}/${file} が指している写真が見つかりません。\n` +
              `      指定：${cover.src}\n` +
              `      探した場所：public${cover.src}\n\n` +
              `   どちらかをしてください。\n` +
              `     ・写真を public${cover.src} に置く\n` +
              `     ・写真がまだ無いなら、cover: の3行の先頭に # を付けて無効にする\n` +
              `       （写真が無くても、名前だけの落ち着いた枠で正しく表示されます）\n`,
          );
        }
      }

      return parsed.data;
    });
}

/* ── 部活 ───────────────────────────────────────────── */

export function getClubs() {
  const all = readCollection('clubs');
  // 活動中を先、終了を後。同じ状態の中では設立が早い順。
  // ⚠ 終了を後ろに置くのは隠すためではない。積み重ねとして最後にまとめて見せる。
  return all.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return (a.foundedYearMonth ?? '').localeCompare(b.foundedYearMonth ?? '');
  });
}

/* ── PJ ─────────────────────────────────────────────── */

export function getProjects() {
  const all = readCollection('projects');
  return all.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
    return a.name.localeCompare(b.name, 'ja');
  });
}

/* ── イベント ───────────────────────────────────────── */

export function getEvents() {
  // 新しい順。
  return readCollection('events').sort((a, b) => b.date.localeCompare(a.date));
}

/** まだ終わっていないイベントか。
 *  ⚠ 静的書き出しなので「今日」はビルド時点。
 *    開催後に表示を切り替えるには再ビルドが要る（ロードマップ P5 の運用事項）。 */
export function isUpcoming(e: { date: string; endDate?: string }, today = new Date()): boolean {
  return (e.endDate ?? e.date) >= today.toISOString().slice(0, 10);
}

/** 今日以降に開催されるイベントのうち、最も近いもの。無ければ null。 */
export function getUpcomingEvent(today = new Date()) {
  const upcoming = getEvents()
    .filter((e) => isUpcoming(e, today))
    .sort((a, b) => a.date.localeCompare(b.date));
  return upcoming[0] ?? null;
}

/* ── 作品 ───────────────────────────────────────────── */

export function getWorks() {
  return readCollection('works').sort((a, b) => b.year - a.year);
}

/* ── 集計 ───────────────────────────────────────────── */

/** トップと団体紹介で使う件数。⚠ 数字は必ずここ経由で出す。手で書かない。 */
export function getCounts() {
  const clubs = getClubs();
  const projects = getProjects();
  return {
    clubsActive: clubs.filter((c) => c.status === 'active').length,
    clubsDone: clubs.filter((c) => c.status === 'done').length,
    projectsActive: projects.filter((p) => p.status === 'active').length,
    projectsDone: projects.filter((p) => p.status === 'done').length,
    events: getEvents().length,
    works: getWorks().length,
  };
}
