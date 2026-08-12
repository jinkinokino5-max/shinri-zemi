import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SiteNav } from '@/components/SiteNav';
import { Thumb } from '@/components/Thumb';
import { getWorks, resolveBelongsTo } from '@/lib/content';
import { ORG, SITE_URL } from '@/lib/org';
import { asset } from '@/lib/asset';
import s from './work.module.css';

/* ══════════════════════════════════════════════════════════════════
   作品の個別ページ
   URL：/works/<slug>/   ⚠ 案A採用 ＝ 1作品 1URL。
   独自にデザインしたページ（custom/works/<slug>/）を置いた場合、
   それがそのままこのURLの中身になる。

   層：静謐／地は白（tokens.css の --white「作品集のみ。作品の色を正しく見せるため」）

   ⚠ このページは徹底して引く。大本資料 原理2：
       「作品集とPJページは、逆に極限まで引く。装飾ゼロ、余白最大、
         色は墨と生成りだけ。
         ▸ なぜ：学生の作品は色も雰囲気もバラバラだから、
           サイト側が主張すると全部が濁る」
     朱をここで使わない。動きも付けない。**主役は作品であって、サイトではない。**

   ⚠ ロードマップ 5-C-0 の線引き
     原理2 は一覧（/works/）に強く効かせ、個別ページは作者本人の表現の場として
     自由にする、と決めた。この既定テンプレートは、独自ページを作らなかった人の
     ためのもの。だから「静かで、何を置いても邪魔にならない」ことを狙う。

   ⚠ 制作者は displayNames をそのまま出す。本名かどうかは本人が選んでいる
     （B-1 本人選択制）。サイト側は選ばれた表記しか持っていない。
   ══════════════════════════════════════════════════════════════════ */

type Params = { slug: string };

/* ⚠ 作品が0件のときの置き石。
   ═══════════════════════════════════════════════════════════════
   output:'export' には「動的ルートは最低1件を生成しなければならない」
   という制約があり、generateStaticParams() が空配列を返すとビルドが落ちる。

     Error: Page "/works/[slug]" returned an empty array from
            "generateStaticParams()". With "output: export",
            at least one route must be generated.

   ⚠ これは机上の懸念ではない。2026年8月の公開時点で作品は0件であり、
     この分岐が無いと **サイト全体がビルドできず、公開が止まる**
     （2026-08-12、実際に落ちた）。

   部活・PJ・イベントは中身があるのでこの問題に当たらない。作品だけが当たる。

   ⚠ この置き石のURLは、どこからもリンクせず sitemap にも載せない。
     開かれても 404 の画面になる（下の notFound()）。
     作品が1件でも入れば、この分岐は自動的に使われなくなる。 */
const PLACEHOLDER = 'none';

export function generateStaticParams(): Params[] {
  const works = getWorks();
  if (works.length === 0) return [{ slug: PLACEHOLDER }];
  return works.map((w) => ({ slug: w.slug }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { slug } = await params;
  const work = getWorks().find((w) => w.slug === slug);
  if (!work) return {};

  // ⚠ 06資料 4章：各ページの title / description はすべて固有。使い回さない。
  const description =
    work.body.replace(/\s+/g, ' ').slice(0, 110) ||
    `${work.displayNames.join('・')}による作品「${work.title}」（${work.year}年）。`;

  // ⚠ 06資料 4章：「作品ページのOGP画像は作品画像そのもの」。
  //   写真が無ければ指定しない（サイト既定にフォールバックする）。
  const ogImage = work.cover ? `${SITE_URL}${asset(work.cover.src)}` : undefined;

  return {
    title: work.title,
    description,
    openGraph: {
      title: `${work.title}｜${ORG.name}`,
      description,
      type: 'article',
      ...(ogImage ? { images: [{ url: ogImage, alt: work.cover!.alt }] } : {}),
    },
  };
}

export default async function WorkPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const work = getWorks().find((w) => w.slug === slug);
  if (!work) notFound();

  const origin = resolveBelongsTo(work.belongsTo);

  return (
    <>
      <SiteNav current="/works/" />

      {/* 構造化データ（06資料 4章）。作品は CreativeWork。
          ⚠ author に出すのは表示名だけ。本名は保存していない（B-1）。 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CreativeWork',
            name: work.title,
            dateCreated: String(work.year),
            author: work.displayNames.map((n) => ({ '@type': 'Person', name: n })),
            ...(work.body ? { description: work.body } : {}),
            ...(work.cover ? { image: `${SITE_URL}${asset(work.cover.src)}` } : {}),
            ...(work.externalUrl ? { url: work.externalUrl } : {}),
            isPartOf: { '@type': 'Organization', name: ORG.name, url: SITE_URL },
          }),
        }}
      />

      {/* ══ 白の面。作品の色が地の色に混ざらないようにする ══ */}
      <section className="plate">
        <div className="wrap">
          <p className="label">Works</p>
          <h1 className={s.title}>{work.title}</h1>

          {/* ⚠ 制作者と年だけを見出しの直下に置く。
                この2つは作品を特定するための情報で、装飾ではない。 */}
          <p className={s.by}>
            {work.displayNames.join('・')}
            <span className={s.year}>{work.year}</span>
          </p>

          {work.cover && (
            <figure className={s.hero}>
              <Thumb cover={work.cover} name={work.title} ratio="3/2" />
              {/* ⚠ alt は写真の内容、figcaption は読む人への説明。役割が違う。
                    同じ文をそのまま繰り返さない（読み上げで二重に読まれる）。 */}
            </figure>
          )}

          {work.body && <div className={`body ${s.text}`}>{work.body}</div>}

          {/* ⚠ 2枚目以降。1枚目は上のヒーローに出している。 */}
          {work.images.length > 0 && (
            <ul className={s.gallery}>
              {work.images.map((im) => (
                <li key={im.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset(im.src)}
                    alt={im.alt}
                    loading="lazy"
                    // ⚠ 寸法が分からないと読み込み時に画面が飛ぶ（CLS）。
                    //   1-E の自動最適化ができるまでは CSS の比率で押さえる。
                    className={s.galleryImg}
                  />
                </li>
              ))}
            </ul>
          )}

          <dl className={s.meta}>
            {origin ? (
              <div>
                <dt>{origin.label}</dt>
                <dd>
                  <Link href={origin.href}>{origin.name}</Link>
                </dd>
              </div>
            ) : (
              // ⚠ 所属先が見つからないときはリンクを出さない。
              //   リンク切れを作ると、無関係な場所で公開が止まる。
              null
            )}

            {work.tags.length > 0 && (
              <div>
                <dt>Tags</dt>
                <dd>{work.tags.join('、')}</dd>
              </div>
            )}

            {work.externalUrl && (
              <div>
                <dt>Link</dt>
                <dd>
                  {/* ⚠ 外部リンクには rel を付ける。 */}
                  <a href={work.externalUrl} target="_blank" rel="noopener noreferrer">
                    {work.externalUrl}
                  </a>
                </dd>
              </div>
            )}
          </dl>

          <p className={s.back}>
            <Link href="/works/">← 作品集へ戻る</Link>
          </p>
        </div>
      </section>
    </>
  );
}
