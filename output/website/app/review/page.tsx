import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { ReviewApp } from '@/components/submit/ReviewApp';

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
          <ReviewApp />
        </div>
      </section>
    </>
  );
}
