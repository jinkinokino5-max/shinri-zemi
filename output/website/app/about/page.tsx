import type { Metadata } from 'next';
import { SiteNav } from '@/components/SiteNav';
import { getCounts } from '@/lib/content';
import { ORG } from '@/lib/org';
import { count } from '@/lib/format';

export const metadata: Metadata = {
  title: '団体紹介',
  description: `${ORG.mission}。${ORG.establishedLabel}設立、${ORG.memberCount}名。${ORG.affiliationNotice}`,
};

/* ══════════════════════════════════════════════════════════════════
   団体紹介
   層：妄想／地は墨（大本資料 3章）。新聞紙面ブロック（7-6）で組む。

   ▸ なぜ新聞紙面か：Foljeton（デンマークのニュースサイト）が実際の紙面を
     再現していた（02資料）。団体紹介を新聞にすると、退屈な「会社概要ページ」
     ではなく紙面になる。スポンサー向けの信頼感とアーティスティックさが
     同時に成立する数少ない解。

   ⚠ 非公認である旨は、フッターだけでなくこのページの上部にも置く。
     スポンサーが最初に確認したい情報であり、最下部だけだと見落とされる。
   ⚠ 数字は必ず lib/content.ts の集計と lib/org.ts から取る。手で書かない。
   ⚠ 未確定の数字は「––」。0 で埋めない。
   ══════════════════════════════════════════════════════════════════ */

export default function AboutPage() {
  const c = getCounts();

  return (
    <>
      <SiteNav current="/about/" />

      {/* ══ 墨地の紙面。地の反転だけで層を切り替える（別の装飾を足さない）══ */}
      <section className="paper">
        <div className="wrap">
          {/* 新聞の題字部分 */}
          <div className="paper__head">
            <p className="paper__title">{ORG.name}</p>
            <p className="paper__sub num">
              {ORG.romaji} ／ EST. {ORG.establishedLabel}
            </p>
          </div>

          <h1 className="paper__lead mvv">{ORG.mission}</h1>

          {/* ⚠ 上部に置くのは意図的。消さないこと。 */}
          <p className="paper__notice">{ORG.affiliationNotice}</p>

          {/* ══ 3段組の紙面（大本資料 7-6）══ */}
          <div className="cols">
            <div className="col">
              <h2 className="col__head">Mission / Vision / Value</h2>
              {/* ⚠ 一字一句、原文どおり。要約も「」囲みも禁止（大本資料 0-1）。 */}
              <p className="col__label">Mission</p>
              <p className="col__mvv mvv">{ORG.mission}</p>
              <p className="col__label">Vision</p>
              <p className="col__mvv mvv">{ORG.vision}</p>
              <p className="col__label">Value</p>
              {ORG.values.map((v) => (
                <p key={v} className="col__mvv mvv">
                  {v}
                </p>
              ))}
            </div>

            <div className="col">
              <h2 className="col__head">組織</h2>
              <dl className="org">
                <dt>代表・副代表</dt>
                <dd>組織の成果最大化／組織を持続させる</dd>
                <dd className="org__note">任期：新歓終了の5月末まで</dd>
                <dt>運営部</dt>
                <dd>心理ゼミ全体の運営／コミュニケーション改善／Notionによる情報整理／組織文化の維持</dd>
                <dt>企画部</dt>
                <dd>各部活の運営／イベント企画の実行／部長の満足度向上</dd>
                <dt>プロジェクトチーム</dt>
                <dd>個人の挑戦を実現する場／目的達成が成果指標</dd>
              </dl>

              <h2 className="col__head" style={{ marginTop: 'var(--sp-8)' }}>
                目的
              </h2>
              <ul className="purpose purpose--dark">
                {ORG.purposes.map((p, i) => (
                  <li key={p}>
                    <span className="purpose__n">{String(i + 1).padStart(2, '0')}</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="col">
              <h2 className="col__head">数字</h2>
              <dl className="stats">
                <Stat label="設立" value={ORG.establishedLabel} />
                <Stat label="会員" value={`${ORG.memberCount}`} unit="名" />
                <Stat label="部活" value={count(c.clubsActive)} unit={`（終了 ${c.clubsDone}）`} />
                <Stat label="PJ" value={count(c.projectsActive)} unit={`（終了 ${c.projectsDone}）`} />
                {/* ⚠ 年間の企画数は増え続けるため確定不能。固定値を載せない。 */}
                <Stat label="年間の企画" value={count(ORG.eventsPerYear)} />
                <Stat label="作品" value={count(c.works)} />
              </dl>

              <h2 className="col__head" style={{ marginTop: 'var(--sp-8)' }}>
                連絡先
              </h2>
              <p style={{ marginTop: 'var(--sp-2)' }}>
                <a href={`mailto:${ORG.email}`}>{ORG.email}</a>
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  const unknown = value === '––';
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd className={unknown ? 'is-unknown' : 'num'}>
        {value}
        {unit && !unknown ? <small>{unit}</small> : null}
      </dd>
    </div>
  );
}
