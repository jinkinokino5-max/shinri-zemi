import Link from 'next/link';

/* ══════════════════════════════════════════════════════════════════
   グローバルナビ
   根拠：draft/デザイン大本資料_v1.md 7-1 ／ 3章（タブ構成）

   ⚠ 並び順の根拠：最優先読者はスポンサー。彼らが最初に知りたいのは
     「何を生み出しているか（成果物）」であり、組織図ではない。
     よって作品集を先頭、団体紹介を最後に置く。
     一方で新入生は「どんな活動があるか」から入るため、
     イベント／部活／PJ を中央に3つ並べて対等に見せる。

   ⚠ CTAボタンは置かない（大本資料 決定事項12）。連絡先はフッターに集約。
   ⚠ ブランド名にキルゴUを使わない。16pxでは字が潰れる（4-2-1）。
   ══════════════════════════════════════════════════════════════════ */

export const NAV_ITEMS = [
  { href: '/works/', ja: '作品集', en: 'Works' },
  { href: '/events/', ja: 'イベント', en: 'Event' },
  { href: '/clubs/', ja: '部活', en: 'Club' },
  { href: '/projects/', ja: 'PJ', en: 'Project' },
  { href: '/about/', ja: '団体紹介', en: 'About' },
] as const;

/** @param current 現在地のパス。'/clubs/' のように末尾スラッシュ付きで渡す。 */
export function SiteNav({ current }: { current?: string }) {
  return (
    <header className="nav">
      <Link className="nav__brand" href="/">
        <b>北大心理ゼミ</b>
        {/* ⚠ 心理学とは無関係の団体なので PSYCHOLOGY と英訳しない。
              ローマ字転写のみを使う（2026-08-10 確定）。 */}
        <span className="label">HOKUDAI SHINRI ZEMI</span>
      </Link>
      <nav aria-label="サイト内">
        <ul className="nav__list">
          {NAV_ITEMS.map((item) => (
            <li
              key={item.href}
              className="nav__item"
              aria-current={current === item.href ? 'page' : undefined}
            >
              <Link className="nav__link" href={item.href}>
                <span className="nav__ja">{item.ja}</span>
                <span className="nav__en">{item.en}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
