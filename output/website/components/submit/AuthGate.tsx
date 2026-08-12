'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMember, type Member, type MemberState } from '@/lib/submission/useMember';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   ログインの入口
   根拠：draft/ロードマップ.md 6-B

   投稿画面と承認画面の両方が、この中に包まれる。
   ⚠ 「未設定」「未ログイン」「表示名がまだ」の3つを、
     どれも行き止まりにしないこと。行き止まりの画面は、
     引き継いだ後輩が最初につまずく場所になる。
   ══════════════════════════════════════════════════════════════════ */

export function AuthGate({
  children,
  requireRep = false,
}: {
  children: (ctx: { member: Member; accessToken: string; signOut: () => void }) => React.ReactNode;
  requireRep?: boolean;
}) {
  const { state, signIn, signOut, register } = useMember();

  if (state.status === 'unconfigured') return <Unconfigured />;
  if (state.status === 'loading') return <p className={s.note}>読み込んでいます…</p>;
  if (state.status === 'signedOut') return <SignedOut onSignIn={signIn} />;
  if (state.status === 'needsName') return <NameForm onSubmit={register} onCancel={signOut} />;

  if (requireRep && state.member.role !== 'rep') return <NotRep onSignOut={signOut} state={state} />;

  return (
    <>
      <div className={s.who}>
        <span>
          {state.member.display_name}
          <span className={s.role}>{ROLE_JA[state.member.role]}</span>
        </span>
        <button type="button" className={s.linkBtn} onClick={signOut}>
          ログアウト
        </button>
      </div>
      {children({
        member: state.member,
        accessToken: state.session.access_token,
        signOut,
      })}
    </>
  );
}

const ROLE_JA = {
  member: 'メンバー',
  leader: '部長・PJリーダー',
  staff: '運営部・企画部',
  rep: '代表',
} as const;

/* ── 設定が入っていないとき ────────────────────────
   ⚠ ここが「準備中」と出るのは正常な状態である。
     8月の公開時点では投稿機能はまだ動かない（ロードマップ フェーズ4）。 */
function Unconfigured() {
  return (
    <div className={s.panel}>
      <p className={s.panelTitle}>この機能は、まだ準備中です。</p>
      <p className={s.note}>
        投稿機能はフェーズ6の作業です。動かすには、接続先の設定（Supabase）が必要です。
        手順は <code>draft/フェーズ6_セットアップ手順.md</code> にあります。
      </p>
      <p className={s.note}>
        設定が入っていなくても、サイトの表示は何も変わりません。
        <Link href="/">トップへ戻る</Link>
      </p>
    </div>
  );
}

function SignedOut({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className={s.panel}>
      <p className={s.panelTitle}>ログインしてください。</p>
      {/* ⚠ 6-B：パスワードを自前で持たない。この一文は理由の説明であって、
            言い訳ではない。消さないこと。 */}
      <p className={s.note}>
        パスワードは作りません。この団体はパスワードを預からない方針です（持たなければ漏れません）。
      </p>
      <button type="button" className={s.primary} onClick={onSignIn}>
        Googleでログイン
      </button>
    </div>
  );
}

/* ── 初回：表示名を決める ──────────────────────────
   ⚠ B-1 本人選択制。Googleの氏名を初期値に入れてはならない。
     入れた瞬間、大半の人が本名のまま送信する。 */
function NameForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (name: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  return (
    <form
      className={s.panel}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr('');
        try {
          await onSubmit(name);
        } catch (x) {
          setErr(x instanceof Error ? x.message : String(x));
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className={s.panelTitle}>サイトに出す名前を決めてください。</p>
      <p className={s.note}>
        本名でも、ニックネームでもかまいません。<b>選んだほうだけが保存されます。</b>
        本名を選ばなかった場合、このサイトはあなたの本名を保存しません。あとから変えられます。
      </p>
      <input
        className={s.input}
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        required
        aria-label="サイトに出す名前"
        placeholder="例：みずき / 田中太郎 / Mizuki"
      />
      {err && <p className={s.error}>{err}</p>}
      <div className={s.row}>
        <button className={s.primary} disabled={busy || name.trim() === ''}>
          {busy ? '登録しています…' : 'この名前ではじめる'}
        </button>
        <button type="button" className={s.linkBtn} onClick={onCancel}>
          やめる
        </button>
      </div>
    </form>
  );
}

function NotRep({ onSignOut, state }: { onSignOut: () => void; state: MemberState }) {
  const name = state.status === 'ready' ? state.member.display_name : '';
  return (
    <div className={s.panel}>
      <p className={s.panelTitle}>この画面は代表だけが使えます。</p>
      <p className={s.note}>
        {name} さんでログインしています。承認の権限は代表にだけあります（F-8）。
        <Link href="/submit/">投稿画面へ</Link>
      </p>
      <button type="button" className={s.linkBtn} onClick={onSignOut}>
        別のアカウントでログインし直す
      </button>
    </div>
  );
}
