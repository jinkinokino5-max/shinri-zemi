import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { Thumb } from '@/components/Thumb';
import { Gallery } from '@/components/Gallery';
import { getEvents, isUpcoming } from '@/lib/content';
import { ORG, SITE_URL } from '@/lib/org';
import { formatEventDate, textOr, count } from '@/lib/format';

/* ══════════════════════════════════════════════════════════════════
   イベントの個別ページ
   URL：/events/<slug>/   ⚠ 案A採用 ＝ 1イベント 1URL。
   独自にデザインしたページを作った場合、それがそのままこのURLの中身になる。

   ⚠ 開催前は「近日開催」として朱の面で強く出す。
     サイト上で唯一、期限のある情報のため。
   ══════════════════════════════════════════════════════════════════ */

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const ev = getEvents().find((e) => e.slug === slug);
  if (!ev) return {};
  const description = ev.body || `${formatEventDate(ev)} 開催。${ORG.name}のイベントです。`;
  return {
    title: ev.name,
    description,
    openGraph: { title: `${ev.name}｜${ORG.name}`, description, type: 'article' },
  };
}

export default async function EventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const ev = getEvents().find((e) => e.slug === slug);
  if (!ev) notFound();

  const upcoming = isUpcoming(ev);

  return (
    <>
      <SiteNav current="/events/" />

      {/* 構造化データ（06資料 4章）。イベントは Event。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Event',
            name: ev.name,
            startDate: ev.date,
            endDate: ev.endDate ?? ev.date,
            eventStatus: 'https://schema.org/EventScheduled',
            organizer: { '@type': 'Organization', name: ORG.name, url: SITE_URL },
            ...(ev.body ? { description: ev.body } : {}),
          }),
        }}
      />

      <section className="section">
        <div className="wrap">
          <p className="label">Event</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>
            {ev.name}
          </h1>

          {/* ⚠ 開催前だけ朱の面。朱は1画面に1箇所まで。 */}
          {upcoming && (
            <p className="notice" style={{ marginBottom: 'var(--sp-8)' }}>
              <span className="notice__label">近日開催</span>
              <span className="notice__date num" style={{ display: 'block' }}>
                {formatEventDate(ev)}
              </span>
            </p>
          )}

          <dl className="figures" style={{ marginBottom: 'var(--sp-8)' }}>
            <Fig label="Date" value={formatEventDate(ev)} />
            {/* ⚠ 主催が運営部か企画部かは未確認。対象者・参加人数も未集計。 */}
            <Fig label="Organizer" value={textOr(ev.organizer)} />
            <Fig label="Audience" value={textOr(ev.audience)} />
            <Fig label="Participants" value={count(ev.participantCount)} />
          </dl>

          <div style={{ marginBottom: 'var(--sp-8)' }}>
            <Thumb cover={ev.cover} name={ev.name} ratio="16/9" />
          </div>

          {ev.body ? (
            <div className="body">{ev.body}</div>
          ) : (
            <p className="cap">詳細は準備中です。</p>
          )}

          {/* ⚠ 2枚目以降。切り抜かずに元の比率のまま並ぶ。 */}
          <Gallery images={ev.images} />
        </div>
      </section>
    </>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="fig">
      <dt>{label}</dt>
      <dd className={value === '––' ? 'is-unknown' : 'num'} style={{ fontSize: 20 }}>
        {value}
      </dd>
    </div>
  );
}
