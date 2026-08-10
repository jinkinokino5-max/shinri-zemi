import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Thumb } from '@/components/Thumb';
import { getEvents, isUpcoming } from '@/lib/content';
import { formatEventDate } from '@/lib/format';

export const metadata: Metadata = {
  title: 'イベント',
  description: '複数人・外部を巻き込む企画です。北大心理ゼミのイベント一覧。',
};

/* ══════════════════════════════════════════════════════════════════
   イベント一覧
   ⚠ 開催前のイベントは「告知」として最上部に大きく出す。
     サイト上で唯一、期限のある情報のため。
   ⚠ 開催日が過ぎたら自動的に通常の一覧へ落ちる。
     ただし静的書き出しなので「今日」はビルド時点。
     開催後に見た目を切り替えるには再ビルドが要る（P5の運用事項）。
   ══════════════════════════════════════════════════════════════════ */

export default function EventsPage() {
  const events = getEvents();
  // ⚠ filter(isUpcoming) と書くと第2引数の index が today に渡ってしまう。必ず包む。
  const upcoming = events.filter((e) => isUpcoming(e));
  const past = events.filter((e) => !isUpcoming(e));

  return (
    <>
      <SiteNav current="/events/" />

      <section className="section">
        <div className="wrap">
          <p className="label">Event</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>
            イベント
          </h1>
          <p className="body">
            複数人・外部を巻き込む企画です。テーマは多様で、運営部が企画・調整を担当しています。
          </p>

          {upcoming.length > 0 && (
            <div style={{ marginTop: 'var(--sp-12)' }}>
              <h2 className="h3" style={{ marginBottom: 'var(--sp-4)' }}>
                近日開催 {upcoming.length}
              </h2>
              {upcoming.map((e) => (
                <Link key={e.slug} href={`/events/${e.slug}/`} className="notice">
                  <div className="notice__body">
                    <p className="notice__label">近日開催</p>
                    <p className="notice__name">{e.name}</p>
                    <p className="notice__date num">{formatEventDate(e)}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}

          {past.length > 0 && (
            <>
              <h2 className="h3" style={{ margin: 'var(--sp-12) 0 var(--sp-4)' }}>
                これまでのイベント {past.length}
              </h2>
              <ul className="cards-2">
                {past.map((e) => (
                  <li key={e.slug}>
                    <Link className="card-plain" href={`/events/${e.slug}/`}>
                      <Thumb cover={e.cover} name={e.name} ratio="16/9" />
                      <p className="card-plain__name">{e.name}</p>
                      <p className="card-plain__meta num">{formatEventDate(e)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}
