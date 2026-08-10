import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { getCounts } from '@/lib/content';
import { ORG, figure } from '@/lib/org';

export const metadata: Metadata = {
  title: '団体紹介',
  description: `${ORG.mission}。${ORG.establishedLabel}設立、${ORG.memberCount}名。${ORG.affiliationNotice}`,
};

/* ══════════════════════════════════════════════════════════════════
   団体紹介
   ⚠ 非公認である旨は、フッターだけでなくこのページにも置く。
     スポンサーが最初に確認したい情報であり、最下部だけだと見落とされる。
   ⚠ MVV・目的はすべて lib/org.ts 経由。原文どおり。
   ══════════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  const counts = getCounts();

  return (
    <>
      <SiteNav current="/about/" />
      <section className="section">
        <div className="wrap">
          <p className="label">About</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>団体紹介</h1>

          {/* ⚠ ここに置くのは意図的。消さないこと。 */}
          <p className="body" style={{ color: 'var(--sub-on-light)' }}>
            {ORG.affiliationNotice}
          </p>

          <dl className="figures" style={{ margin: 'var(--sp-8) 0' }}>
            <Fig label="Established" value={ORG.establishedLabel} />
            <Fig label="Members" value={String(ORG.memberCount)} />
            <Fig label="Club / Active" value={String(counts.clubsActive)} />
            <Fig label="Project / Active" value={String(counts.projectsActive)} />
            <Fig label="Events / Year" value={figure(ORG.eventsPerYear)} />
          </dl>

          <h2 className="label" style={{ marginTop: 'var(--sp-12)' }}>Mission</h2>
          <p className="mvv mvv--md">{ORG.mission}</p>

          <h2 className="label" style={{ marginTop: 'var(--sp-8)' }}>Vision</h2>
          <p className="mvv mvv--md">{ORG.vision}</p>

          <h2 className="label" style={{ marginTop: 'var(--sp-8)' }}>Value</h2>
          {ORG.values.map((v) => (
            <p key={v} className="mvv mvv--md">{v}</p>
          ))}

          <h2 className="h3" style={{ marginTop: 'var(--sp-12)' }}>目的</h2>
          <ul className="purpose" style={{ marginTop: 'var(--sp-4)' }}>
            {ORG.purposes.map((p, i) => (
              <li key={p}>
                <span className="purpose__n">{String(i + 1).padStart(2, '0')}</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}

function Fig({ label, value }: { label: string; value: string }) {
  return (
    <div className="fig">
      <dt>{label}</dt>
      <dd className={value === '––' ? 'is-unknown' : 'num'}>{value}</dd>
    </div>
  );
}
