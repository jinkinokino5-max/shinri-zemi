import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { Card, CardGrid } from '@/components/Card';
import { getClubs } from '@/lib/content';

export const metadata: Metadata = {
  title: '部活',
  description:
    '大学生が自分の興味を部活として立ち上げ、他者と共有しながら継続的に活動しています。北大心理ゼミの部活一覧。',
};

/* ══════════════════════════════════════════════════════════════════
   部活一覧
   層：妄想（大本資料 3章）。アクセント量は最大、動きは中。

   ⚠ 終了した部活も消さずに載せる（Value「過去から学ぶことを忘れない」）。
     ただし活動中と混ぜず、下にまとめる。
     散らして混ぜると「一部が止まっている」ように見えるが、
     「これまでにやったこと」としてまとめると積み重ねに見える。
     事実は1文字も変えていない。
   ══════════════════════════════════════════════════════════════════ */

export default function ClubsPage() {
  const clubs = getClubs();
  const active = clubs.filter((c) => c.status === 'active');
  const done = clubs.filter((c) => c.status === 'done');

  return (
    <>
      <SiteNav current="/clubs/" />

      <section className="section">
        <div className="wrap">
          <div className="two">
            <p className="two__label">部活</p>
            <div>
              <p className="label">Club</p>
              <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>
                {active.length}つの部活が動いています
              </h1>
              {/* 原文（学生団体基本情報.txt 2章）を崩さずに1文にまとめている。
                  ⚠ 「」で囲んでいない。囲むと引用＝団体がそう言ったことになる。 */}
              <p className="body">
                大学生が自分の興味を部活として立ち上げ、他者と共有しながら継続的に活動しています。
                成果指標は「部長の満足度」です。
              </p>

              <h2 className="h3" style={{ margin: 'var(--sp-12) 0 var(--sp-4)' }}>
                活動中 {active.length}
              </h2>
              <CardGrid>
                {active.map((c) => (
                  <Card
                    key={c.slug}
                    href={`/clubs/${c.slug}/`}
                    name={c.name}
                    cover={c.cover}
                    meta={`${fmt(c.foundedYearMonth)} —`}
                    state="活動中"
                  />
                ))}
              </CardGrid>

              {done.length > 0 && (
                <>
                  <h2 className="h3" style={{ margin: 'var(--sp-12) 0 var(--sp-4)' }}>
                    これまでにやったこと {done.length}
                  </h2>
                  <CardGrid>
                    {done.map((c) => (
                      <Card
                        key={c.slug}
                        href={`/clubs/${c.slug}/`}
                        name={c.name}
                        cover={c.cover}
                        meta={`${fmt(c.foundedYearMonth)} – ${fmt(c.endedYearMonth)}`}
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

/** ⚠ 未確定は「––」。推測で埋めない（CLAUDE.md 3-4）。 */
function fmt(ym?: string) {
  return ym ? ym.replace('-', '.') : '––';
}
