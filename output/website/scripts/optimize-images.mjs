// ══════════════════════════════════════════════════════════════════
//  書き出した写真を軽くする（ビルド後）
//  根拠：reference/design-research/06資料 3章
//        「学生の未加工写真が最大の負荷。ビルド時に自動最適化すること」
//        ／ draft/ロードマップ.md R-d
//        「人に依存するルールは必ず守られなくなる。仕組みで解決する」
//
//  ⚠ このスクリプトは「約束の実装」である。
//    投稿画面（components/submit/PhotoInput.tsx）は、学生にこう言っている：
//      「加工しないでそのまま入れてください。軽くする処理はサイト側で行います」
//    その処理がこれ。無いと、この一文が嘘になる。
//    嘘になると、次に起きるのは「やっぱり自分で縮めてください」という
//    お願いであり、それは必ず守られなくなる（R-d）。
//
//  ⚠ 触るのは out/（書き出し結果）だけ。public/ の元画像には手を触れない。
//    理由：元の解像度は二度と戻らない。リポジトリには原寸を残し、
//    配信するものだけを縮める。印刷や再利用のときに効いてくる。
//    （supabase/functions/publish/index.ts のコメントと同じ約束）
//
//  ⚠ 拡張子とファイル名を変えない。
//    content/*.md が "/photos/works/xxx/1.jpg" のように直接指しているため、
//    .webp へ変えると、そのすべてが 404 になる。
//    フォーマット変換をするなら、.md 側と <picture> の対応が先に要る
//    （next.config.mjs のコメントにある srcset 対応は、まだ入っていない）。
//
//  npm の postbuild として自動実行される。
// ══════════════════════════════════════════════════════════════════

import { readdir, stat, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = join(root, 'out', 'photos');

/** 長辺の上限。⚠ 本サイトの最大表示幅（--measure 相当の2倍）で足りる。
 *  これ以上は画面に出ないうえ、通信量だけが増える。 */
const MAX_EDGE = 1600;

/** 画質。⚠ 80 を下回ると、作品写真の階調が目に見えて荒れる。
 *  ここは「軽さ」より「作品の見え方」を優先する（作品サイトなので）。 */
const QUALITY = 82;

const EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

async function walk(dir) {
  const out = [];
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    const st = await stat(p);
    if (st.isDirectory()) out.push(...(await walk(p)));
    else if (EXT.has(extname(name).toLowerCase())) out.push(p);
  }
  return out;
}

/** 元の形式のまま、長辺だけ縮めて詰め直す。 */
async function encode(image, ext) {
  switch (ext) {
    case '.png':
      return image.png({ compressionLevel: 9, palette: true }).toBuffer();
    case '.webp':
      return image.webp({ quality: QUALITY }).toBuffer();
    case '.avif':
      return image.avif({ quality: QUALITY }).toBuffer();
    default:
      // ⚠ mozjpeg を使う。同じ画質でも素の jpeg より2割ほど小さい。
      return image.jpeg({ quality: QUALITY, mozjpeg: true }).toBuffer();
  }
}

if (!existsSync(target)) {
  console.log('ℹ 写真がありません（out/photos が無い）。何もしません。');
  process.exit(0);
}

const files = await walk(target);
let before = 0;
let after = 0;
let shrunk = 0;

for (const file of files) {
  const original = await readFile(file);
  before += original.length;

  try {
    const image = sharp(original, { failOn: 'none' });
    const meta = await image.metadata();
    const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0);

    const pipeline =
      longEdge > MAX_EDGE
        ? image.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
        : image;

    // ⚠ 撮影機材・位置情報などのメタデータは引き継がない（sharp の既定）。
    //   縮小と同時に落ちるのは副作用ではなく、望ましい結果である。
    //   ただし向き（EXIF Orientation）は sharp が画素へ焼き込むので、
    //   写真が横倒しになることはない。
    const out = await encode(pipeline, extname(file).toLowerCase());

    // ⚠ 大きくなったら書かない。すでに最適化済みの画像を詰め直すと、
    //   まれに元より重くなる。そのときは元のほうが正しい。
    if (out.length < original.length) {
      await writeFile(file, out);
      after += out.length;
      shrunk++;
    } else {
      after += original.length;
    }
  } catch (e) {
    // ⚠ 1枚の失敗でビルドを落とさない。落とすと、写真1枚のせいで
    //   サイト全体が公開されなくなる。縮まなかった写真は原寸のまま出る
    //   （重いだけで、壊れてはいない）。
    after += original.length;
    console.warn(`⚠ ${file.replace(root, '')} は処理できませんでした：${e.message}`);
  }
}

const mb = (n) => (n / 1024 / 1024).toFixed(2);

if (files.length === 0) {
  console.log('ℹ 写真がありません。何もしませんでした。');
} else {
  console.log(
    `✅ 写真 ${files.length} 枚のうち ${shrunk} 枚を軽くしました：` +
      `${mb(before)}MB → ${mb(after)}MB（長辺 ${MAX_EDGE}px 上限）`,
  );
}
