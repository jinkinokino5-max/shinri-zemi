import Link from 'next/link';
import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { getClubs } from '@/lib/content';

export const metadata: Metadata = {
  title: '部活',
  description:
    '大学生が自分の興味を部活として立ち上げ、他者と共有しながら継続的に活動しています。北大心理ゼミの部活一覧。',
};

/* ══════════════════════════════════════════════════════════════════
   部活一覧
   ⚠ 終了した部活も消さずに載せる（Value「過去から学ぶことを忘れない」）。
     ただし活動中と混ぜず、下にまとめる。
     散らして混ぜると「一部が止まっている」ように見えるが、
     まとめると積み重ねに見える。事実は1文字も変えていない。
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
          <p className="label">Club</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-6)' }}>
            部活
          </h1>
          {/* 原文どおり（学生団体基本情報.txt 2章）を崩さずに1文にまとめている。
              ⚠ 「」で囲んでいない。囲むと引用＝団体がそう言ったことになる。 */}
          <p className="body">
            大学生が自分の興味を部活として立ち上げ、他者と共有しながら継続的に活動しています。
            成果指標は「部長の満足度」です。
          </p>

          <h2 className="h3" style={{ marginTop: 'var(--sp-12)' }}>
            活動中 {active.length}
          </h2>
          <ClubList items={active} />

          {done.length > 0 && (
            <>
              <h2 className="h3" style={{ marginTop: 'var(--sp-12)' }}>
                これまでにやったこと {done.length}
              </h2>
              <ClubList items={done} done />
            </>
          )}
        </div>
      </section>
    </>
  );
}

function ClubList({
  items,
  done,
}: {
  items: ReturnType<typeof getClubs>;
  done?: boolean;
}) {
  return (
    <ul className="rows" style={{ marginTop: 'var(--sp-4)' }}>
      {items.map((c) => (
        <li key={c.slug} className="row">
          <Link className="row__link" href={`/clubs/${c.slug}/`}>
            <span className="row__name" style={done ? { color: 'var(--sub-on-light)' } : undefined}>
              {c.name}
            </span>
            <span className="row__meta">
              {/* ⚠ 状態は色ではなく文字で示す。 */}
              {done
                ? `${fmt(c.foundedYearMonth)} – ${fmt(c.endedYearMonth)} ／ 終了`
                : `${fmt(c.foundedYearMonth)} – ／ 活動中`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** ⚠ 未確定は「––」。推測で埋めない。 */
function fmt(ym?: string) {
  return ym ? ym.replace('-', '.') : '––';
}
