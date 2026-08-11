import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';
import { TitleHero } from '@/components/TitleHero';
import { WorkBelt } from '@/components/WorkBelt';
import { getActivities, getCounts, getUpcomingEvent } from '@/lib/content';
import { ORG, figure } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   トップページ
   根拠：draft/mock_flow/02x04_title_flow.html（2026-08-11 に団体が採用）
        draft/mock_top_v2.html（確定した視覚言語）

   2026-08-11 の変更点と、その理由
     以前は1画面目が題字だけで、Mission すらスクロールしないと出てこなかった。
     「最初の引きが弱い／何をしている団体か伝わらない」という指摘を受け、
     ① 題字の背後を活動名が流れる（TitleHero）
     ② その直下に写真の帯（WorkBelt）
     を置いて、1画面目で「団体名」「何をしているか」「Mission」が
     同時に目に入る構成に変えた。
     ⚠ 題字を小さくして解決したのではない。題字は主役の大きさのまま残してある。

     あわせて、それまで未使用だった朱の告知帯を有効にした。
     道東合宿はサイト上で唯一「期限のある情報」であるにもかかわらず、
     トップに出ていなかった。

   ⚠ 数字はすべて lib/content.ts の集計と lib/org.ts から取る。
     ページに直接書かない。書くと更新漏れで矛盾が生まれる。
   ══════════════════════════════════════════════════════════════════ */

export default function HomePage() {
  const activities = getActivities();
  const counts = getCounts();
  // ⚠ 開催済みのイベントを「近日開催」として出さない。
  //   静的書き出しなので「今日」はビルド時点（content.ts の注記を参照）。
  const upcoming = getUpcomingEvent();

  return (
    <>
      <SiteNav />

      {/* ══ 1画面目：題字＋背後を流れる活動名 ══ */}
      <TitleHero activities={activities} />

      {/* ══ 直下：写真の帯 ══ */}
      <WorkBelt activities={activities} />

      {/* ══ 告知帯 ══
          ⚠ サイト上で唯一、期限のある情報。朱の面で最も強く出す。
          ⚠ 朱を使う場所は1画面に1箇所まで。増やすと効果が半減する。
          ⚠ 近日開催が無ければ、帯ごと出さない。空の帯は嘘になる。 */}
      {upcoming ? (
        <section className="section" style={{ paddingBlock: 'var(--sp-12)' }}>
          <div className="wrap">
            <Link className="notice" href={`/events/${upcoming.slug}/`}>
              <span className="notice__label">Next event</span>
              <span className="notice__name">{upcoming.name}</span>
              <span className="notice__date">
                {upcoming.date.replace(/-/g, '.')}
                {upcoming.endDate ? ` – ${upcoming.endDate.slice(5).replace('-', '.')}` : ''}
              </span>
            </Link>
          </div>
        </section>
      ) : null}

      {/* ══ Vision ══ */}
      <section className="section" style={{ paddingBlock: 'var(--sp-8)' }}>
        <div className="wrap">
          <p className="label">Vision</p>
          {/* ⚠ Vision：原文どおり */}
          <h2 className="mvv mvv--md" style={{ marginTop: 'var(--sp-2)' }}>
            {ORG.vision}
          </h2>
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
      <section className="sheet" style={{ marginTop: 'var(--sp-8)' }}>
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
