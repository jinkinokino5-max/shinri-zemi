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

    // ⚠ 2026-08-12：一度ここを外していた。app/works/[slug]/page.tsx が無く、
    //   404 になるURLを sitemap に載せていたため（投稿機能の通し確認で発覚）。
    //   同日に詳細ページを作ったので戻した。
    //   ⚠ この行と app/works/[slug]/ は必ずセットで扱うこと。
    //     片方だけ消すと、検索エンジンに存在しないページを申告する状態に戻る。
    //     いまは scripts/check-content.mjs が sitemap の全URLの実在を検査するので、
    //     間違えればデプロイが止まる。
    ...getWorks().map((w) => ({ url: url(`/works/${w.slug}/`), priority: 0.7 })),
  ];
}
