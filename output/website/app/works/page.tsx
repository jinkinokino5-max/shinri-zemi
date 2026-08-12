import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';
import { getWorks } from '@/lib/content';

export const metadata: Metadata = {
  title: '作品集',
  description: '北大心理ゼミの学生がつくったものを集めています。',
};

/* ══════════════════════════════════════════════════════════════════
   作品集
   ⚠ 2026年8月の公開時点で作品は0件。
     空のグリッドを出すより、準備中と明示した1画面のほうが誠実で、
     見た目も破綻しない（ロードマップ P2-F の判断）。
     1件でも登録されれば、自動的に一覧表示に切り替わる。
   ══════════════════════════════════════════════════════════════════ */

export default function WorksPage() {
  const works = getWorks();

  return (
    <>
      <SiteNav current="/works/" />
      <section className="section">
        <div className="wrap">
          <p className="label">Works</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>作品集</h1>

          {works.length === 0 ? (
            <p className="body">
              学生がつくったものを、これから集めていきます。準備中です。
            </p>
          ) : (
            <ul className="rows" style={{ marginTop: 'var(--sp-8)' }}>
              {/* ⚠ 一覧は静かに保つ（大本資料 原理2）。写真を並べない。
                    サムネイルを敷き詰めると、作品同士の色が干渉して全部が濁る。
                    賑やかさは個別ページ側に置く（ロードマップ 5-C-0 の線引き）。 */}
              {works.map((w) => (
                <li key={w.slug} className="row">
                  <Link href={`/works/${w.slug}/`} className="row__link">
                    <span className="row__name">{w.title}</span>
                    <span className="row__meta">
                      {w.year} ／ {w.displayNames.join('・')}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
