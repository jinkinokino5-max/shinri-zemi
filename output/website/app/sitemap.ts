import type { MetadataRoute } from 'next';
import { getClubs, getProjects, getEvents } from '@/lib/content';
import { SITE_URL } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   sitemap.xml（06資料 4章）
   ⚠ 最優先読者はスポンサー・外部の大人であり、検索でたどり着く可能性が高い。
     SEOは「配慮」ではなく目的達成の手段。
   ══════════════════════════════════════════════════════════════════ */

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const url = (path: string) => `${SITE_URL}${path}`;

  return [
    { url: url('/'), priority: 1 },
    { url: url('/works/'), priority: 0.8 },
    { url: url('/events/'), priority: 0.8 },
    { url: url('/clubs/'), priority: 0.8 },
    { url: url('/projects/'), priority: 0.8 },
    { url: url('/about/'), priority: 0.9 },
    ...getClubs().map((c) => ({ url: url(`/clubs/${c.slug}/`), priority: 0.6 })),
    ...getProjects().map((p) => ({ url: url(`/projects/${p.slug}/`), priority: 0.6 })),
    ...getEvents().map((e) => ({ url: url(`/events/${e.slug}/`), priority: 0.6 })),

    // ⚠ 作品の詳細ページ（/works/<slug>/）は、まだ route が存在しない。
    //   ロードマップ 2-F で「作品集は枠だけ。9月から中身を入れる」と決めたため。
    //
    //   ここで getWorks() を並べると、404 になるURLを sitemap に載せてしまう。
    //   実際に載せた（2026-08-12、投稿機能の通し確認で発覚）。
    //   ⚠ 検索エンジンに「存在しないページ」を申告するのは、
    //     最優先読者がスポンサー＝検索から来る本件では実害がある。
    //
    //   app/works/[slug]/page.tsx を作ったら、次の1行を戻すこと。
    //     ...getWorks().map((w) => ({ url: url(`/works/${w.slug}/`), priority: 0.7 })),
    //   戻し忘れても壊れない（sitemap に載らないだけ）。逆は壊れる。
  ];
}
