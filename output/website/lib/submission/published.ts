import { getClubs, getEvents, getProjects, getWorks } from '@/lib/content';
import type { ImageRef } from '@/lib/schema';
import type { Kind } from './fields';

/* ══════════════════════════════════════════════════════════════════
   公開中のものを、投稿フォームが読める形にする
   根拠：draft/ロードマップ.md 6-1 ／ 本ファイルは「直す・消す」提案のために追加

   ⚠ ここはビルド時（サーバー側）でだけ動く。'use client' から呼ばない。
     lib/content.ts と同じ制約である（node:fs を使う）。

   ⚠ なぜデータベースではなく Markdown から作るのか
     公開済みの正は content/*.md（Git）であって、Supabase ではない。
     「いまサイトに出ているもの」を直したいのだから、
     読む先はサイトに出ているもの、つまり Markdown でなければならない。
     データベースを見に行くと、手で直した .md との食い違いが必ず出る。

   ⚠ 一覧はビルド時点のもの。公開直後に別の人が編集画面を開くと、
     再ビルドが終わるまでは古い内容が出る。これは静的サイトの性質で、
     隠さずに画面へ書いてある（「ビルド時点の内容です」）。
   ══════════════════════════════════════════════════════════════════ */

/** 公開中の1件。投稿フォームの初期値としてそのまま使える形。 */
export type PublishedEntry = {
  kind: Kind;
  slug: string;
  /** 画面に出す名前（作品は title、それ以外は name）。 */
  label: string;
  /** 公開後のURL。 */
  href: string;
  /** 投稿フォームの data と同じ形。undefined の項目は入れない。 */
  data: Record<string, unknown>;
  /** すでに公開されている写真。⚠ Storage のパスではなく、公開後の src。 */
  images: ImageRef[];
};

/** undefined を落として詰める。⚠ 空文字を入れない（CLAUDE.md 3-4）。 */
function compact(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    out[k] = v;
  }
  return out;
}

/** cover と images を1本にする。⚠ 順序を保つ。1枚目が cover に戻るため。
 *  ⚠ focus（枠内の位置と拡大率）もそのまま持ち回る。落とすと、
 *    文章を直しただけで切り抜きの位置がまん中へ戻る。 */
function photos(e: { cover?: ImageRef; images?: ImageRef[] }): ImageRef[] {
  return [...(e.cover ? [e.cover] : []), ...(e.images ?? [])];
}

/**
 * 公開中のすべてを、投稿フォームの形にして返す。
 *
 * ⚠ ここで作る data のキーは lib/submission/fields.ts の key と一致させること。
 *   ずれると、編集画面を開いたときに「入っているはずの値が空」になり、
 *   投稿者が気づかずに空のまま提出して、内容が消える。
 */
export function getPublishedEntries(): PublishedEntry[] {
  const works = getWorks().map(
    (w): PublishedEntry => ({
      kind: 'work',
      slug: w.slug,
      label: w.title,
      href: `/works/${w.slug}/`,
      data: compact({
        title: w.title,
        displayNames: w.displayNames,
        belongsTo: w.belongsTo,
        year: w.year,
        body: w.body,
        tags: w.tags,
        externalUrl: w.externalUrl,
        // ⚠ フォームには出さないが、そのまま持ち回る。
        //   落とすと、直すたびに公開日が今日へ書き換わる
        //   （supabase/functions/publish/to-markdown.ts を参照）。
        publishedAt: w.publishedAt,
      }),
      images: photos(w),
    }),
  );

  const clubs = getClubs().map(
    (c): PublishedEntry => ({
      kind: 'club',
      slug: c.slug,
      label: c.name,
      href: `/clubs/${c.slug}/`,
      data: compact({
        name: c.name,
        status: c.status,
        body: c.body,
        meetingInfo: c.meetingInfo,
        leaderDisplayName: c.leaderDisplayName,
        organizerCount: c.organizerCount,
        foundedYearMonth: c.foundedYearMonth,
        endedYearMonth: c.endedYearMonth,
      }),
      images: photos(c),
    }),
  );

  const projects = getProjects().map(
    (p): PublishedEntry => ({
      kind: 'project',
      slug: p.slug,
      label: p.name,
      href: `/projects/${p.slug}/`,
      data: compact({
        name: p.name,
        status: p.status,
        purpose: p.purpose,
        period: p.period,
        memberDisplayNames: p.memberDisplayNames,
        body: p.body,
        outputUrl: p.outputUrl,
      }),
      images: photos(p),
    }),
  );

  const events = getEvents().map(
    (e): PublishedEntry => ({
      kind: 'event',
      slug: e.slug,
      label: e.name,
      href: `/events/${e.slug}/`,
      data: compact({
        name: e.name,
        date: e.date,
        endDate: e.endDate,
        organizer: e.organizer,
        audience: e.audience,
        participantCount: e.participantCount,
        body: e.body,
      }),
      images: photos(e),
    }),
  );

  return [...works, ...clubs, ...projects, ...events];
}

/* ── 消してよいかどうか ─────────────────────────────
   ⚠ ロードマップ 6-1：「削除すると紐づく作品の所属先が消えてリンク切れになる」。
     実際、scripts/check-content.mjs がリンク切れでデプロイを止めるので、
     依存のあるものを消すと、承認した瞬間にサイト全体の公開が止まる。
     それは「消した人が悪い」のではなく、止められる場所で止めなかった側の問題である。
     だから、消す前にここで数えて、代表の画面に出す。 */

/** 「この部活／PJ／イベントを消すと、行き場を失う作品」の一覧。 */
export type DependentMap = Record<string, { slug: string; title: string }[]>;

/** キーは `club:dokusho` のような形。⚠ 作品どうしは依存しないので作品は入らない。 */
export function getDependents(): DependentMap {
  const map: DependentMap = {};
  for (const w of getWorks()) {
    const key = `${w.belongsTo.kind}:${w.belongsTo.slug}`;
    (map[key] ??= []).push({ slug: w.slug, title: w.title });
  }
  return map;
}
