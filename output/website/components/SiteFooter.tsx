import { Logomark } from './Logomark';
import { ORG } from '@/lib/org';

/* ══════════════════════════════════════════════════════════════════
   フッター
   根拠：draft/デザイン大本資料_v1.md 7-1（連絡先はフッターに集約）／ 0-0

   ⚠ 「北海道大学の公認サークルではありません」は削除・弱化してはならない。
     北大心理ゼミは「未来開拓倶楽部」の傘下プロジェクトであり非公認。
     スポンサーが最も気にする点であり、実態と違う書き方は本件で最大のリスク。
     投稿画面からも編集できない仕様にする（ロードマップ 6-1）。
   ══════════════════════════════════════════════════════════════════ */

export function SiteFooter() {
  return (
    <footer className="foot">
      <div className="wrap">
        <p className="foot__logo">
          <Logomark />
        </p>

        <div className="foot__grid">
          <div>
            <p className="label">Contact</p>
            <p style={{ marginTop: 'var(--sp-1)' }}>
              <a href={`mailto:${ORG.email}`}>{ORG.email}</a>
            </p>
          </div>
          <div>
            <p className="label">Social</p>
            <ul style={{ marginTop: 'var(--sp-1)' }}>
              {ORG.social.map((s) => (
                <li key={s.href}>
                  {/* 外部リンク。⚠ rel を付ける */}
                  <a href={s.href} target="_blank" rel="noopener noreferrer">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="label">Established</p>
            <p className="num" style={{ marginTop: 'var(--sp-1)' }}>
              {ORG.establishedLabel}
            </p>
          </div>
        </div>

        {/* ⚠ この一文を消さないこと（上のコメント参照） */}
        <p className="foot__note">{ORG.affiliationNotice}</p>
      </div>
    </footer>
  );
}
