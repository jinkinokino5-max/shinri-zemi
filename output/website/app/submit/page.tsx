import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { SubmitApp } from '@/components/submit/SubmitApp';
import type { BelongsToOption } from '@/components/submit/FieldInput';
import { getClubs, getEvents, getProjects } from '@/lib/content';

/* ══════════════════════════════════════════════════════════════════
   投稿画面
   根拠：draft/ロードマップ.md フェーズ6 6-C

   ⚠ このページだけがクライアント側で動く。ほかの29ページは今までどおり
     ビルド時に固まった静的HTMLのまま（output:'export' を外していない）。
     投稿機能のために、既存のページを1つも作り替えていない。

   ⚠ 検索結果には出さない。投稿はメンバーがURLを知って来る場所であって、
     検索から入ってくる場所ではない。
   ══════════════════════════════════════════════════════════════════ */

export const metadata: Metadata = {
  title: '投稿する',
  description:
    '北大心理ゼミのメンバーが、作品・部活・PJ・イベントの情報を投稿する画面です。投稿後、代表が確認してから公開されます。',
  robots: { index: false, follow: false },
};

export default function SubmitPage() {
  // ⚠ 「どの部活／PJ／イベントのものか」は自由入力にしない（6-1）。
  //   ビルド時点の一覧を渡す。新しい部活が増えたら再ビルドで追随する。
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
          <p className="label">SUBMIT</p>
          <h1 className="h2">投稿する</h1>
          <SubmitApp options={options} />
        </div>
      </section>
    </>
  );
}
