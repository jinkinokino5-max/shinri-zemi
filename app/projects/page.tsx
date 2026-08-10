import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { getProjects } from '@/lib/content';

export const metadata: Metadata = {
  title: 'PJ',
  description:
    '学生が自分のやりたいことを実現する場です。起業・事業立ち上げ・研究など自由度が高く、成果は目的が達成できているかで見ています。',
};

export default function ProjectsPage() {
  const all = getProjects();
  const active = all.filter((p) => p.status === 'active');
  const done = all.filter((p) => p.status === 'done');

  return (
    <>
      <SiteNav current="/projects/" />
      <section className="section">
        <div className="wrap">
          <p className="label">Project</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>PJ</h1>
          <p className="body">
            学生が自分のやりたいことを実現する場です。起業・事業立ち上げ・研究など自由度が高く、
            成果は「目的が達成できているか」で見ています。
          </p>

          <h2 className="h3" style={{ marginTop: 'var(--sp-12)' }}>進行中 {active.length}</h2>
          <List items={active} />

          {done.length > 0 && (
            <>
              <h2 className="h3" style={{ marginTop: 'var(--sp-12)' }}>
                これまでにやったこと {done.length}
              </h2>
              <List items={done} done />
            </>
          )}
        </div>
      </section>
    </>
  );
}

function List({ items, done }: { items: ReturnType<typeof getProjects>; done?: boolean }) {
  return (
    <ul className="rows" style={{ marginTop: 'var(--sp-4)' }}>
      {items.map((p) => (
        <li key={p.slug} className="row">
          <Link className="row__link" href={`/projects/${p.slug}/`}>
            <span className="row__name" style={done ? { color: 'var(--sub-on-light)' } : undefined}>
              {p.name}
            </span>
            {/* ⚠ 状態は色ではなく文字で示す。期間は未回答のため出さない。 */}
            <span className="row__meta">{done ? '終了' : '進行中'}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
