/** @type {import('next').NextConfig} */

// ══════════════════════════════════════════════════════════════════
//  ⚠ 静的書き出し（output: 'export'）にしている理由
//
//  ロードマップ 1-1 のとおり、8月の公開先は GitHub Pages。
//  GitHub Pages は静的ファイルしか置けないため、サーバー機能を使わない。
//
//    P4（2026年8月） 静的書き出し → GitHub Pages     ← 表示のみ
//    P6（1年以内）   同じコードを Cloudflare Pages へ ← 投稿機能が動く
//
//  移行時に書き直す必要はない。この行を消して adapter を足すだけ。
// ══════════════════════════════════════════════════════════════════

// ⚠ GitHub Pages は https://<ユーザー名>.github.io/<リポジトリ名>/ で配信される。
//   このサブディレクトリを basePath に指定しないと、CSSも画像もリンクも全部404になる。
//   独自ドメインを設定したら不要になるため、環境変数で切り替えられるようにしている。
//     独自ドメイン運用   → BASE_PATH を空にする（既定）
//     github.io で確認   → BASE_PATH=/リポジトリ名
const basePath = process.env.BASE_PATH ?? '';

const nextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath || undefined,

  // ⚠ basePath は <Link> と next/image には自動で付くが、
  //   .md に書いた "/photos/..." のような素の文字列には付かない。
  //   lib/asset.ts がこの値を使って自分で付ける。
  //   これが無いと GitHub Pages で写真が1枚も表示されない。
  env: { NEXT_PUBLIC_BASE_PATH: basePath },

  // 静的書き出しでは末尾スラッシュ付きのディレクトリ出力にする。
  // /clubs/dokusho/ → out/clubs/dokusho/index.html
  // ⚠ これを false にすると GitHub Pages で URL が 404 になる場合がある。
  trailingSlash: true,

  images: {
    // ⚠ 重要な制約（2026-08-10 判明）
    //   output:'export' では next/image の最適化サーバーが存在しないため、
    //   unoptimized: true が必須。つまり next/image に任せた
    //   WebP/AVIF 変換・srcset 生成は「効かない」。
    //
    //   しかし 06資料 3章は「学生の未加工写真が最大の負荷。
    //   ビルド時に自動最適化すること」を必須としている。
    //   → 代替として scripts/optimize-images.mjs（sharp）で
    //     ビルド前に変換・複数サイズ生成を行い、
    //     components/Picture.tsx が <picture> + srcset を出力する。
    //   詳細は draft/ロードマップ.md 1-5 を参照。
    unoptimized: true,
  },

  // 型エラーやビルドエラーを握り潰さない。
  // ⚠ 代表が毎年替わる前提なので、壊れたまま公開されるのを仕組みで防ぐ。
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
