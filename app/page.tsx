import { Logomark } from '@/components/Logomark';
import { SiteNav } from '@/components/SiteNav';
import { Chip, ChipField } from '@/components/Chip';
import { getClubs, getProjects, getEvents, getCounts } from '@/lib/content';
import { ORG, figure } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   トップページ
   根拠：draft/mock_top_v2.html（確定した視覚言語）
        ① 整列 ALIGNMENT       ② 額装の入れ子  ③ 朱の乗算

   ⚠ 数字はすべて lib/content.ts の集計と lib/org.ts から取る。
     ページに直接書かない。書くと更新漏れで矛盾が生まれる。
   ══════════════════════════════════════════════════════════════════ */

const STATUS_LABEL = { active: '活動中', done: '終了' } as const;
const PJ_STATUS_LABEL = { active: '進行中', done: '終了' } as const;

export default function HomePage() {
  const clubs = getClubs();
  const projects = getProjects();
  const events = getEvents();
  const counts = getCounts();

  // 画面で朱にするのは1枚だけ。⚠ 朱を2箇所に使うと効果が半減する。
  const highlightSlug = events[0]?.slug;

  return (
    <>
      <SiteNav />

      {/* ══ ヒーロー：額装 第3層 ══ */}
      <section className="sheet" style={{ paddingBlock: 'var(--sp-12) var(--sp-16)' }}>
        <div className="wrap">
          <p className="label">2026 — VOL.01</p>

          <p style={{ maxWidth: 1040, marginBlock: 'var(--sp-4) var(--sp-8)' }}>
            <Logomark />
          </p>

          {/* ⚠ Mission：原文どおり。句読点の追加・語尾の変更・要約はしない。
                <span> は文字を1字も増減させていない（囲んでいるだけ）。 */}
          <h1 className="h1 has-kenten">
            大学生の溢れ出す<span className="kenten">妄想</span>を形にする
          </h1>
        </div>
      </section>

      {/* ══ 整列 ALIGNMENT ══ */}
      <section className="section">
        <div className="wrap">
          <p className="label">Vision</p>
          {/* ⚠ Vision：原文どおり */}
          <h2 className="mvv mvv--md" style={{ marginTop: 'var(--sp-2)' }}>
            {ORG.vision}
          </h2>

          <ChipField>
            {clubs.map((c) => (
              <Chip
                key={c.slug}
                href={`/clubs/${c.slug}/`}
                name={c.name}
                meta={`Club / ${STATUS_LABEL[c.status]}`}
                done={c.status === 'done'}
              />
            ))}

            {events.map((e) => (
              <Chip
                key={e.slug}
                href={`/events/${e.slug}/`}
                name={e.name}
                meta={`Event / ${e.date.replace(/-/g, '.')}`}
                highlight={e.slug === highlightSlug}
              />
            ))}

            {projects.map((p) => (
              <Chip
                key={p.slug}
                href={`/projects/${p.slug}/`}
                name={p.name}
                meta={`Project / ${PJ_STATUS_LABEL[p.status]}`}
                done={p.status === 'done'}
              />
            ))}
          </ChipField>
        </div>
      </section>

      {/* ══ 数字 ══
          ⚠ 未確定は「––」のまま。推測で埋めない（CLAUDE.md 3-4）。 */}
      <section style={{ paddingBlock: 'var(--sp-8)' }}>
        <div className="wrap">
          <dl className="figures">
            <Figure label="Established" value={ORG.establishedLabel} />
            <Figure label="Members" value={String(ORG.memberCount)} unit="名" />
            <Figure
              label="Club / Active"
              value={String(counts.clubsActive)}
              unit={counts.clubsDone > 0 ? `（終了 ${counts.clubsDone}）` : undefined}
            />
            <Figure
              label="Project / Active"
              value={String(counts.projectsActive)}
              unit={counts.projectsDone > 0 ? `（終了 ${counts.projectsDone}）` : undefined}
            />
            <Figure label="Events / Year" value={figure(ORG.eventsPerYear)} />
          </dl>
        </div>
      </section>

      {/* ══ Value：額装 第3層 ══ */}
      <section className="sheet">
        <div className="wrap">
          <p className="label">Value</p>
          {/* ⚠ Value：2つとも原文どおり */}
          {ORG.values.map((v) => (
            <p key={v} className="mvv mvv--md" style={{ marginTop: 'var(--sp-2)' }}>
              {v}
            </p>
          ))}
        </div>
      </section>
    </>
  );
}

function Figure({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const unknown = value === '––';
  return (
    <div className="fig">
      <dt>{label}</dt>
      <dd className={unknown ? 'is-unknown' : 'num'}>
        {value}
        {unit ? <small>{unit}</small> : null}
      </dd>
    </div>
  );
}
