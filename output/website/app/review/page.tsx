import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { ReviewApp } from '@/components/submit/ReviewApp';
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
          <ReviewApp entries={getPublishedEntries()} dependents={getDependents()} />
        </div>
      </section>
    </>
  );
}
