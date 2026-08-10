import Link from 'next/link';
import { SiteNav } from '@/components/SiteNav';

export const metadata = { title: 'ページが見つかりません' };

export default function NotFound() {
  return (
    <>
      <SiteNav />
      <section className="section">
        <div className="wrap">
          <p className="label">404</p>
          <h1 className="h1" style={{ margin: 'var(--sp-2) 0 var(--sp-4)' }}>
            ページが見つかりません
          </h1>
          <p className="body">
            お探しのページは移動したか、削除された可能性があります。
          </p>
          <p style={{ marginTop: 'var(--sp-6)' }}>
            <Link href="/">トップへ戻る</Link>
          </p>
        </div>
      </section>
    </>
  );
}
