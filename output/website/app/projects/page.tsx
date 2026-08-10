import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Card, CardGrid } from '@/components/Card';
import { getProjects } from '@/lib/content';

export const metadata: Metadata = {
  title: 'PJ',
  description:
    '学生が自分のやりたいことを実現する場です。起業・事業立ち上げ・研究など自由度が高く、成果は目的が達成できているかで見ています。',
};

/* ══════════════════════════════════════════════════════════════════
   PJ一覧
   層：静謐（大本資料 3章）。アクセント量は小、動きは最小。
   ⚠ 部活一覧より意図的に静かにしている。読ませるページのため。
   ══════════════════════════════════════════════════════════════════ */

export default function ProjectsPage() {
  const all = getProjects();
  const active = all.filter((p) => p.status === 'active');
  const done = all.filter((p) => p.status === 'done');

  return (
    <>
      <SiteNav current="/projects/" />

      <section className="section">
        <div className="wrap">
          <div className="two">
            <p className="two__label">PJ</p>
            <div>
              <p className="label">Project</p>
              <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>
                やりたいことを、やってみる
              </h1>
              <p className="body">
                学生が自分のやりたいことを実現する場です。起業・事業立ち上げ・研究など自由度が高く、
                成果は「目的が達成できているか」で見ています。
              </p>

              <h2 className="h3" style={{ margin: 'var(--sp-12) 0 var(--sp-4)' }}>
                進行中 {active.length}
              </h2>
              <CardGrid>
                {active.map((p) => (
                  <Card
                    key={p.slug}
                    href={`/projects/${p.slug}/`}
                    name={p.name}
                    cover={p.cover}
                    meta={p.period ?? '––'}
                    state="進行中"
                  />
                ))}
              </CardGrid>

              {done.length > 0 && (
                <>
                  <h2 className="h3" style={{ margin: 'var(--sp-12) 0 var(--sp-4)' }}>
                    これまでにやったこと {done.length}
                  </h2>
                  <CardGrid>
                    {done.map((p) => (
                      <Card
                        key={p.slug}
                        href={`/projects/${p.slug}/`}
                        name={p.name}
                        cover={p.cover}
                        meta={p.period ?? '––'}
                        state="終了"
                        done
                      />
                    ))}
                  </CardGrid>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
