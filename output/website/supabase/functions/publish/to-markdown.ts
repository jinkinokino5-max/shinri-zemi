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

/** 枠の中で写真のどこを見せるか。⚠ lib/schema.ts の Focus と揃えること。 */
type Focus = { x: number; y: number; zoom: number };

export type PublishRow = {
  id: string;
  kind: 'work' | 'club' | 'project' | 'event';
  target_slug: string;
  data: Record<string, unknown>;
  images: { path: string; alt: string; focus?: Focus }[];
};

/**
 * 焦点を書き出すか決める。
 *
 * ⚠ まん中・等倍（＝既定）なら書き出さない。
 *   すべての写真に `focus: {x: 50, y: 50, zoom: 1}` が並ぶと、
 *   .md を人が読んだときに「何か指定されている」と誤解する。
 *   指定していないことは、書かないことで表す（CLAUDE.md 3-4 と同じ考え）。
 */
function focusOrNothing(f?: Focus): Focus | undefined {
  if (!f) return undefined;
  if (f.x === 50 && f.y === 50 && f.zoom === 1) return undefined;
  return { x: f.x, y: f.y, zoom: f.zoom };
}

/** 写真1枚を、.md に書く形にする。⚠ focus は既定値なら省く。 */
function imageEntry(src: string, alt: string, focus?: Focus) {
  const f = focusOrNothing(focus);
  return f ? { src, alt: alt || '', focus: f } : { src, alt: alt || '' };
}

/**
 * data の中で、フロントマターに書き出してはいけないキー。
 *
 * ⚠ keepImages は「すでに公開されている写真を、そのまま残す」という
 *   指示であって、コンテンツの項目ではない。書き出すと lib/schema.ts の
 *   Zod が知らない項目として通ってしまい、.md にゴミが残り続ける。
 *   写真そのものは下の toMarkdown が cover / images に組み立て直す。
 */
const INTERNAL_KEYS = new Set(['photos', 'keepImages']);

/**
 * 投稿者が決めた写真の並び。1件目が表紙（cover）、2件目以降が本文中の写真。
 *
 * ⚠ 2026-08-13 に追加。それまでは「残す写真（keepImages）」と
 *   「足す写真（images）」の2本の配列を、この順で連結していた。
 *   そのため、新しく足した写真を表紙にすることができなかった。
 *   さらに投稿画面が2本の配列それぞれの先頭を「1枚目」と呼んでいたため、
 *   どちらが表紙になるのか投稿者に分からなかった（実際に事故になった）。
 *   並びは1本にして、投稿者が決めたとおりに使う。
 *
 * src  … すでに公開されている写真（そのまま残す）
 * path … 新しく上げた写真（Storage のパス。ここで公開URLに直す）
 * ⚠ どちらか一方だけが入る。
 */
type OrderedPhoto = { src?: string; path?: string; alt: string; focus?: Focus };

/** 「そのまま残す」と指示された、公開済みの写真。⚠ 古い下書き用。下の注記を参照。 */
type KeptImage = { src: string; alt: string; focus?: Focus };

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
              //     focus:
              //       x: 40
              //
              // ⚠ 中の値には indent + '    ' を渡すこと。
              //   渡さないと、さらに入れ子になったもの（focus）の字下げが
              //   配列の外まで戻ってしまい、フロントマターが壊れる。
              //   実際、focus を足した時点でこれが起きた（2026-08-13）。
              `${indent}  - ` +
              Object.entries(x as Record<string, unknown>)
                .map(([k, y], i) =>
                  i === 0
                    ? `${k}: ${yamlValue(y, indent + '    ')}`
                    : `\n${indent}    ${k}: ${yamlValue(y, indent + '    ')}`,
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
  const d = row.data as { photos?: OrderedPhoto[]; keepImages?: KeptImage[] };

  const all = d.photos
    ? // ⚠ 投稿者が決めた並びをそのまま使う。ここで並べ替えない。
      d.photos.map((im) =>
        imageEntry(im.src ?? `${photoDir}/${fileName(im.path!)}`, im.alt, im.focus),
      )
    : // ⚠ 古い下書き（photos がまだ無い）への備え。
      //   投稿画面を新しくした時点で保存済みだった下書きが、開いた瞬間に
      //   写真を全部失わないようにする。新しい下書きはここを通らない。
      [
        ...(d.keepImages ?? []).map((im) => imageEntry(im.src, im.alt, im.focus)),
        ...(row.images ?? []).map((im) =>
          imageEntry(`${photoDir}/${fileName(im.path)}`, im.alt, im.focus),
        ),
      ];

  // ⚠ 1枚目を cover にする。写真が無ければ cover の行そのものが出ない。
  //   optional のまま保たれ、名前だけの落ち着いた枠に切り替わる（大本資料 6-4）。
  const [first, ...others] = all;
  if (first) front.cover = first;

  // ⚠ 2枚目以降は、種類にかかわらず書き出す。
  //   2026-08-13 まで、ここは `if (row.kind === 'work')` の中にあった。
  //   そのため部活・PJ・イベントに2枚目を投稿すると、写真ファイルだけが
  //   リポジトリにコミットされ、どのページからも参照されないまま残っていた
  //   （実際に 5ed1e67f.png が孤児になった）。
  //   lib/schema.ts の base に images を足して、置き場を作ってある。
  if (others.length > 0) front.images = others;

  if (row.kind === 'work') {
    // ⚠ 公開日は最初に公開した日のまま動かさない。
    //   直す提案のたびに今日の日付へ書き換わると、去年の作品が
    //   毎回「新しく公開されたもの」になり、時系列が読めなくなる。
    //   直す提案では、編集画面が元の publishedAt をそのまま持ち回っている。
    front.publishedAt = front.publishedAt ?? today.toISOString().slice(0, 10);
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
