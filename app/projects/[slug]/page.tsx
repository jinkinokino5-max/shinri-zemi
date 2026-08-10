import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { getProjects } from '@/lib/content';
import { ORG } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   PJの個別ページ
   URL：/projects/<slug>/   ⚠ 部活と同じく案A採用 ＝ 1PJ 1URL。

   ⚠ PJも独自にデザインしたページを持てる（2026-08-10 整理）。
     元の要望は「PJや部活」であり、PJも最初から対象だった。
     独自ページを作った場合、それがそのままこのURLの中身になる（案A）。
     JavaScript は禁止（R-1）。最上部の帯は団体側が差し込み消せない（R-2）。

   ⚠ PJは終了しても消えない（status: 'done'）。
     終了したPJの独自ページは、そのまま活動の記録として残る。
     Value「過去から学ぶことを忘れない」に対応する。
   ══════════════════════════════════════════════════════════════════ */

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getProjects().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const pj = getProjects().find((p) => p.slug === slug);
  if (!pj) return {};
  // ⚠ body が空文字だと slice も空文字になり、?? では拾えない（?? は null/undefined だけ）。
  //   description が消えると SEO 上の損失になるため、必ず既定文へ落とす。
  const summary = pj.purpose || pj.body.slice(0, 100) || `${ORG.name}のプロジェクト「${pj.name}」。`;
  return { title: pj.name, description: summary };
}

export default async function ProjectPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const pj = getProjects().find((p) => p.slug === slug);
  if (!pj) notFound();

  return (
    <>
      <SiteNav current="/projects/" />
      <section className="section">
        <div className="wrap">
          <p className="label">Project</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>{pj.name}</h1>

          <dl className="figures" style={{ marginBottom: 'var(--sp-8)' }}>
            <Fig label="Status" value={pj.status === 'done' ? '終了' : '進行中'} />
            <Fig label="Period" value={pj.period ?? '––'} />
            {/* ⚠ 基本情報に「成果は目的が達成できているか」とあるため、目的の明示が重要。
                  未回答なので「––」のまま。推測で書かない。 */}
            <Fig label="Purpose" value={pj.purpose ?? '––'} />
            <Fig
              label="Members"
              value={pj.memberDisplayNames.length ? String(pj.memberDisplayNames.length) : '––'}
            />
          </dl>

          {pj.body ? <div className="body">{pj.body}</div> : <p className="cap">紹介文は準備中です。</p>}
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
