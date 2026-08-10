import type { Metadata } from 'next';
import { LogomarkDefs } from '@/components/Logomark';
import { SiteFooter } from '@/components/SiteFooter';
import { SERIF_SUBSET_URL } from '@/lib/generated/font-subset';
import { ORG, SITE_URL } from '@/lib/org';
import '@/styles/tokens.css';
import '@/styles/base.css';

/* ══════════════════════════════════════════════════════════════════
   全ページ共通のレイアウト
   根拠：draft/デザイン大本資料_v1.md 6-1（額装）／ 4-2（書体）
        reference/design-research/06_アクセシビリティ・パフォーマンス/
   ══════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: {
    default: `${ORG.name}｜${ORG.mission}`,
    // ⚠ 各ページは固有の title を持つ（06資料 4章）。使い回さない。
    template: `%s｜${ORG.name}`,
  },
  description: `${ORG.mission}。${ORG.name}のウェブサイト。`,
  // ⚠ OGP画像を絶対URLにするために必須。未設定だとSNSでカードが出ない。
  //   独自ドメイン取得後は lib/org.ts の SITE_URL を書き換えるだけでよい。
  metadataBase: new URL(SITE_URL),
  openGraph: {
    type: 'website',
    siteName: ORG.name,
    locale: 'ja_JP',
  },
  twitter: { card: 'summary_large_image' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />

        {/* 本文・UI（全字）＋ ラベル用モノスペース。
            ⚠ ウェイトは Regular と Bold の2つまで。
              全字読み込みの日本語Webフォントは1ウェイト約150〜300KB（実測）。
              3つ目を足すと写真1枚分が丸ごと増える。 */}
        <link
          href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />

        {/* MVV専用の明朝。42字だけのサブセット（実測 11,980 bytes ／ 約95%削減）。
            ⚠ URLは scripts/build-font-subset.mjs が自動生成する。手で書かない。
              MVVの文言を変えると自動で追随し、原文と食い違えばビルドが止まる。 */}
        <link href={SERIF_SUBSET_URL} rel="stylesheet" />

        {/* 欧文。和欧混植の先頭に置くため、英数字だけがこの書体になる。 */}
        <link
          href="https://api.fontshare.com/v2/css?f[]=switzer@400,700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {/* 構造化データ（06資料 4章）。団体は Organization。
            ⚠ 非公認であることを偽らないため、大学との所属関係は書かない。 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: ORG.name,
              alternateName: ORG.romaji,
              url: SITE_URL,
              email: ORG.email,
              foundingDate: ORG.established,
              slogan: ORG.mission,
              description: ORG.affiliationNotice,
              sameAs: ORG.social.map((s) => s.href),
            }),
          }}
        />

        {/* 題字SVGの定義。ページ先頭で1回だけ。 */}
        <LogomarkDefs />

        {/* ══ 額装 第2層：生成りの紙 ══
            body（墨）が第1層、この main が第2層、各ページの .sheet が第3層。 */}
        <main className="frame">
          {children}
          <SiteFooter />
        </main>
      </body>
    </html>
  );
}
