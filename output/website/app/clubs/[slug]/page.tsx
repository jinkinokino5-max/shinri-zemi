import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { Thumb } from '@/components/Thumb';
import { getClubs } from '@/lib/content';
import { yearMonth, count, textOr } from '@/lib/format';
import { ORG } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   部活の個別ページ
   URL：/clubs/<slug>/   ⚠ 案A採用（2026-08-10）＝ 1部活 1URL。

   ⚠ 部活が独自にデザインしたページを作った場合、それが「そのままこのURLの
     中身になる」。共通ページと並立させない（URLが2つあると、どちらが本物か
     分からなくなり、片方が更新されずに古い情報が残る）。
     独自ページの受け入れ口は P5 で実装する。JavaScript は禁止（R-1）。

   ⚠ 最上部の帯（団体名／一覧へ戻る）は団体側が差し込み、部活は消せない（R-2）。
   ══════════════════════════════════════════════════════════════════ */

type Params = { slug: string };

export function generateStaticParams(): Params[] {
  return getClubs().map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = getClubs().find((c) => c.slug === slug);
  if (!club) return {};
  return {
    // ⚠ ページごとに固有の title（06資料 4章）
    title: club.name,
    description: club.body
      ? club.body.slice(0, 100)
      : `${ORG.name}の部活「${club.name}」の紹介ページ。`,
  };
}

export default async function ClubPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const club = getClubs().find((c) => c.slug === slug);
  if (!club) notFound();

  const done = club.status === 'done';

  return (
    <>
      <SiteNav current="/clubs/" />

      <section className="section">
        <div className="wrap">
          <p className="label">Club</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>
            {club.name}
          </h1>

          <dl className="figures" style={{ marginBottom: 'var(--sp-8)' }}>
            <Fig label="Status" value={done ? '終了' : '活動中'} />
            <Fig label="Founded" value={yearMonth(club.foundedYearMonth)} />
            {done && <Fig label="Ended" value={yearMonth(club.endedYearMonth)} />}
            {/* ⚠ 未回答は「––」。0 で埋めない。 */}
            <Fig label="Organizers" value={count(club.organizerCount)} />
            <Fig label="Meeting" value={textOr(club.meetingInfo)} />
          </dl>

          <div style={{ marginBottom: 'var(--sp-8)' }}>
            <Thumb cover={club.cover} name={club.name} done={done} ratio="16/9" />
          </div>

          {club.body ? (
            <div className="body">{club.body}</div>
          ) : (
            /* ⚠ 紹介文が未提出でもページは成立する（6-4 の考え方）。
                  空欄を隠さず、まだ無いことを正直に示す。 */
            <p className="cap">紹介文は準備中です。</p>
          )}
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

