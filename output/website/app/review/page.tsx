import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { ReviewApp } from '@/components/submit/ReviewApp';
import type { BelongsToOption } from '@/components/submit/FieldInput';
import { getClubs, getEvents, getProjects } from '@/lib/content';
import { getDependents, getPublishedEntries } from '@/lib/submission/published';

/* ══════════════════════════════════════════════════════════════════
   代表による公開前レビューの画面
   根拠：draft/ロードマップ.md フェーズ6 6-D ／ F-8

   ⚠ 権限はこのページの存在で守られていない。守っているのは
     supabase/migrations/0001_submissions.sql の RLS と、
     Edge Function 側の役割確認である。
     「URLを知られていないから安全」は安全ではない。
   ══════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: '投稿の確認',
  description: '代表が、提出された投稿を確認して公開する画面です。',
  robots: { index: false, follow: false },
};

export default function ReviewPage() {
  // ⚠ 「作品」の投稿を代表がその場で直すとき、所属先(belongsTo)の
  //   選択肢が要る。/submit と同じ一覧をビルド時点から渡す。
  const options: BelongsToOption[] = [
    ...getClubs().map((c) => ({ kind: 'club' as const, slug: c.slug, name: c.name })),
    ...getProjects().map((p) => ({ kind: 'project' as const, slug: p.slug, name: p.name })),
    ...getEvents().map((e) => ({ kind: 'event' as const, slug: e.slug, name: e.name })),
  ];

  return (
    <>
      <SiteNav />
      <section className="sheet">
        <div className="wrap">
          <p className="label">REVIEW</p>
          <h1 className="h2">投稿の確認</h1>
          {/* ⚠ 「変更前の内容」と「消すと行き場を失う作品」は、ビルド時に
                content/*.md から数えて渡す。代表のブラウザに調べさせない。
                調べさせると、調べない日が必ず来る（5-C-0：確認の形骸化）。 */}
          <ReviewApp
            entries={getPublishedEntries()}
            dependents={getDependents()}
            options={options}
          />
        </div>
      </section>
    </>
  );
}
