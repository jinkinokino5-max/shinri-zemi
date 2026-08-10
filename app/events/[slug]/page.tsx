import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { getEvents } from '@/lib/content';
import { ORG } from '@/lib/org';

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getEvents().map((e) => ({ slug: e.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const ev = getEvents().find((e) => e.slug === slug);
  if (!ev) return {};
  return { title: ev.name, description: `${ev.date.replace(/-/g, '.')} 開催。${ORG.name}のイベント。` };
}

export default async function EventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const ev = getEvents().find((e) => e.slug === slug);
  if (!ev) notFound();

  return (
    <>
      <SiteNav current="/events/" />
      <section className="section">
        <div className="wrap">
          <p className="label">Event</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{ev.name}</h1>

          <dl className="figures" style={{ marginBottom: 'var(--sp-8)' }}>
            <Fig
              label="Date"
              value={`${ev.date.replace(/-/g, '.')}${ev.endDate ? `–${ev.endDate.slice(8)}` : ''}`}
            />
            {/* ⚠ 運営部か企画部かは未確認。対象者・参加人数も未集計。「––」のまま。 */}
            <Fig label="Organizer" value={ev.organizer ?? '––'} />
            <Fig label="Audience" value={ev.audience ?? '––'} />
            <Fig
              label="Participants"
              value={ev.participantCount ? String(ev.participantCount) : '––'}
            />
          </dl>

          {ev.body ? <div className="body">{ev.body}</div> : <p className="cap">詳細は準備中です。</p>}
        </div>
      </section>
    </>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="fig">
      <dt>{label}</dt>
      <dd className={value === '––' ? 'is-unknown' : 'num'} style={{ fontSize: 20 }}>{value}</dd>
    </div>
  );
}
