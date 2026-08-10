import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { getEvents } from '@/lib/content';

export const metadata: Metadata = {
  title: 'イベント',
  description: '複数人・外部を巻き込む企画です。北大心理ゼミのイベント一覧。',
};

export default function EventsPage() {
  const events = getEvents();
  return (
    <>
      <SiteNav current="/events/" />
      <section className="section">
        <div className="wrap">
          <p className="label">Event</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>イベント</h1>
          <p className="body">
            複数人・外部を巻き込む企画です。テーマは多様で、運営部が企画・調整を担当しています。
          </p>

          <ul className="rows" style={{ marginTop: 'var(--sp-8)' }}>
            {events.map((e) => (
              <li key={e.slug} className="row">
                <Link className="row__link" href={`/events/${e.slug}/`}>
                  <span className="row__name">{e.name}</span>
                  <span className="row__meta">
                    {e.date.replace(/-/g, '.')}
                    {e.endDate ? `–${e.endDate.slice(8)}` : ''}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
