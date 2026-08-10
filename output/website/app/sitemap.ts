import type { MetadataRoute } from 'next';
import { getClubs, getProjects, getEvents, getWorks } from '@/lib/content';
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
    ...getWorks().map((w) => ({ url: url(`/works/${w.slug}/`), priority: 0.7 })),
  ];
}
