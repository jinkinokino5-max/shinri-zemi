// ══════════════════════════════════════════════════════════════════
//  投稿レコード → content/*.md
//
//  ⚠ 出力の形は lib/schema.ts が唯一の正である。
//    ここが食い違うと「代表は承認したのに、ビルドが落ちて公開されない」
//    という、いちばん直しにくい壊れ方をする。
//    そのため index.ts から切り出して、単体で試せるようにしてある。
//    → scripts/check-publish-markdown.mjs が、ここが吐いた Markdown を
//      実際に gray-matter で読み、lib/schema.ts の Zod に通して確かめる。
//
//  ⚠ この2つを揃えて変えること。片方だけ変えない。
// ══════════════════════════════════════════════════════════════════

export type PublishRow = {
  id: string;
  kind: 'work' | 'club' | 'project' | 'event';
  target_slug: string;
  data: Record<string, unknown>;
  images: { path: string; alt: string }[];
};

/**
 * data の中で、フロントマターに書き出してはいけないキー。
 *
 * ⚠ keepImages は「すでに公開されている写真を、そのまま残す」という
 *   指示であって、コンテンツの項目ではない。書き出すと lib/schema.ts の
 *   Zod が知らない項目として通ってしまい、.md にゴミが残り続ける。
 *   写真そのものは下の toMarkdown が cover / images に組み立て直す。
 */
const INTERNAL_KEYS = new Set(['keepImages']);

/** 「そのまま残す」と指示された、公開済みの写真。src は /photos/… の形。 */
type KeptImage = { src: string; alt: string };

/* ── YAML の出力 ────────────────────────────────────
   ⚠ 自前で書いている理由：値は学生の自由入力で、コロン・引用符・改行が
     普通に入ってくる。素朴な文字列結合だと、その瞬間にフロントマターが壊れる。
     必ず引用符で囲み、中の引用符と改行を退避させる。 */

function yamlString(v: string): string {
  return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}

function yamlValue(v: unknown, indent = ''): string {
  // ⚠ 数値と真偽値は引用符で囲まない。囲むと文字列になり、
  //   lib/schema.ts の z.number() が弾く。
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);

  if (Array.isArray(v)) {
    if (v.length === 0) return '[]';
    return (
      '\n' +
      v
        .map((x) =>
          x && typeof x === 'object' && !Array.isArray(x)
            ? // 配列の中のオブジェクト（images の各要素）。
              //   - src: "…"
              //     alt: "…"
              `${indent}  - ` +
              Object.entries(x as Record<string, unknown>)
                .map(([k, y], i) =>
                  i === 0 ? `${k}: ${yamlValue(y)}` : `\n${indent}    ${k}: ${yamlValue(y)}`,
                )
                .join('')
            : `${indent}  - ${yamlValue(x, indent + '  ')}`,
        )
        .join('\n')
    );
  }

  if (v && typeof v === 'object') {
    return (
      '\n' +
      Object.entries(v as Record<string, unknown>)
        .map(([k, x]) => `${indent}  ${k}: ${yamlValue(x, indent + '  ')}`)
        .join('\n')
    );
  }

  return yamlString(String(v));
}

export const fileName = (p: string) => p.split('/').pop()!;

/**
 * @param photoDir 公開後の写真の置き場。例：/photos/works/rakugaki-bon
 * @param today    公開日。テストのために外から渡せるようにしている。
 */
export function toMarkdown(row: PublishRow, photoDir: string, today = new Date()): string {
  const { body, ...rest } = row.data as { body?: string } & Record<string, unknown>;

  const front: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (INTERNAL_KEYS.has(k)) continue;
    // ⚠ 空の項目は書き出さない。lib/schema.ts が optional にしている項目に
    //   空文字を入れると、「分からない」が「空である」に化ける（CLAUDE.md 3-4）。
    if (v === null || v === undefined || v === '') continue;
    if (Array.isArray(v)) {
      const cleaned = v.filter((x) => String(x).trim() !== '');
      if (cleaned.length === 0) continue;
      front[k] = cleaned;
      continue;
    }
    front[k] = v;
  }

  /* ── 写真の並び ────────────────────────────────
     ⚠ 順序は「そのまま残す写真 → 新しく足す写真」。
       直す提案で文章だけ書き換えたとき、一覧に出る写真（1枚目）が
       黙って入れ替わらないようにするため。表紙が勝手に変わるのは、
       投稿者にも読者にも説明のつかない変化である。

     ⚠ keepImages が空で新しい写真も無い＝写真の無いページになる。
       これは事故ではなく指示である（投稿者が全部外した）。
       cover の行そのものが出ず、6-4 のフォールバック表示に切り替わる。 */
  const kept = ((row.data as { keepImages?: KeptImage[] }).keepImages ?? []).map((im) => ({
    src: im.src,
    alt: im.alt || '',
  }));
  const added = (row.images ?? []).map((im) => ({
    src: `${photoDir}/${fileName(im.path)}`,
    alt: im.alt || '',
  }));
  const all = [...kept, ...added];

  // ⚠ 1枚目を cover にする。写真が無ければ cover の行そのものが出ない。
  //   optional のまま保たれ、名前だけの落ち着いた枠に切り替わる（大本資料 6-4）。
  const [first, ...others] = all;
  if (first) front.cover = first;

  if (row.kind === 'work') {
    // ⚠ 公開日は最初に公開した日のまま動かさない。
    //   直す提案のたびに今日の日付へ書き換わると、去年の作品が
    //   毎回「新しく公開されたもの」になり、時系列が読めなくなる。
    //   直す提案では、編集画面が元の publishedAt をそのまま持ち回っている。
    front.publishedAt = front.publishedAt ?? today.toISOString().slice(0, 10);
    if (others.length > 0) front.images = others;
  }

  const lines = Object.entries(front).map(([k, v]) => `${k}: ${yamlValue(v)}`);

  return (
    `---\n` +
    `# このファイルは投稿画面から自動生成されました（投稿ID: ${row.id}）。\n` +
    `# 手で直しても構いませんが、同じ投稿が再度承認されると上書きされます。\n` +
    `${lines.join('\n')}\n` +
    `---\n\n` +
    `${(body ?? '').trim()}\n`
  );
}
