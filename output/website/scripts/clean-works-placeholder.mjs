// ══════════════════════════════════════════════════════════════════
//  作品が0件のときにできる「置き石」を、ビルド後に取り除く
//  根拠：app/works/[slug]/page.tsx の PLACEHOLDER のコメント
//
//  ⚠ なぜこれが要るのか（順に読んでください）
//
//    1. output:'export' は「動的ルートは最低1件を生成すること」を要求する。
//       generateStaticParams() が空配列だとビルドが落ちる。
//    2. 作品は2026年8月の公開時点で0件。つまり /works/[slug] は空になる。
//       → この置き石が無いと、サイト全体がビルドできない（実際に落ちた）。
//    3. 置き石は notFound() を呼ぶが、静的書き出しでは
//       <html id="__next_error__"> という簡易シェルが出力される。
//       これは lang も h1 も持たないため、scripts/check-content.mjs が落とす。
//
//  ⚠ ここで「検査の例外にする」という直し方を選ばなかった理由。
//    検査に穴を開けると、その穴は二度と塞がれない。
//    実際 sitemap.xml が検査対象外だったせいで、404のURLを公開している
//    ことに誰も気づかなかった（2026-08-12）。
//    **出力しないほうを選ぶ。** 検査は厳しいまま保つ。
//
//  ⚠ 作品が1件でも入れば、置き石はそもそも生成されない。
//    このスクリプトは何もしなくなる。消し忘れの心配は要らない。
//
//  npm の postbuild として自動実行される。
// ══════════════════════════════════════════════════════════════════

import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ⚠ app/works/[slug]/page.tsx の PLACEHOLDER と揃えること。
const PLACEHOLDER = 'none';

const contentDir = join(root, 'content', 'works');
const target = join(root, 'out', 'works', PLACEHOLDER);

const workCount = existsSync(contentDir)
  ? readdirSync(contentDir).filter((f) => f.endsWith('.md')).length
  : 0;

// ⚠ 作品が1件でもあるなら、out/works/none は「none という slug の実在する作品」
//   かもしれない。その場合は絶対に消さない。件数で判定するのはこのため。
if (workCount > 0) {
  process.exit(0);
}

if (existsSync(target)) {
  rmSync(target, { recursive: true, force: true });
  console.log('🧹 作品0件のため、置き石 /works/none/ を取り除きました。');
}
