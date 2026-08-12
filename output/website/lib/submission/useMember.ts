'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isConfigured } from '@/lib/supabase/client';

/* ══════════════════════════════════════════════════════════════════
   ログイン状態と、そのメンバー情報
   根拠：draft/ロードマップ.md 6-B

   ⚠ パスワードを自前で持たない（6-B）。Googleログインだけを使う。
     持たなければ漏れない。学生団体が自前でパスワードを守り続けるのは、
     代表が毎年替わる前提では現実的でない。
   ══════════════════════════════════════════════════════════════════ */

export type Role = 'member' | 'leader' | 'staff' | 'rep';

export type Member = {
  user_id: string;
  display_name: string;
  role: Role;
  club_slugs: string[];
  project_slugs: string[];
};

export type MemberState =
  | { status: 'unconfigured' }                         // .env が無い
  | { status: 'loading' }
  | { status: 'signedOut' }
  | { status: 'needsName'; session: Session }          // 初回。表示名を決めてもらう
  | { status: 'ready'; session: Session; member: Member };

export function useMember() {
  const [state, setState] = useState<MemberState>(
    isConfigured ? { status: 'loading' } : { status: 'unconfigured' },
  );

  const load = useCallback(async (session: Session | null) => {
    const supabase = getSupabase();
    if (!supabase) return setState({ status: 'unconfigured' });
    if (!session) return setState({ status: 'signedOut' });

    const { data } = await supabase
      .from('members')
      .select('user_id, display_name, role, club_slugs, project_slugs')
      .eq('user_id', session.user.id)
      .maybeSingle();

    // ⚠ Googleの氏名を display_name の既定値にしない（B-1 本人選択制）。
    //   本人が入力するまで、名前は保存されていない状態のままにする。
    setState(data ? { status: 'ready', session, member: data as Member } : { status: 'needsName', session });
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => load(session));
    return () => sub.subscription.unsubscribe();
  }, [load]);

  const signIn = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      // 戻り先はいま見ている画面。/submit/ からログインしたら /submit/ に戻る。
      options: { redirectTo: window.location.href },
    });
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase()?.auth.signOut();
  }, []);

  /** 初回ログイン時に、本人が選んだ表示名で members 行を作る。 */
  const register = useCallback(
    async (displayName: string) => {
      const supabase = getSupabase();
      if (!supabase || state.status !== 'needsName') return;
      // ⚠ role は指定しない。RLS が 'member' 固定を強制する（自分で昇格できない）。
      const { error } = await supabase
        .from('members')
        .insert({ user_id: state.session.user.id, display_name: displayName.trim() });
      if (error) throw new Error(error.message);
      await load(state.session);
    },
    [state, load],
  );

  return { state, signIn, signOut, register, reload: () => {
    getSupabase()?.auth.getSession().then(({ data }) => load(data.session));
  } };
}

/** ロードマップ 6-1「誰が何をできるか」の表を、そのまま関数にしたもの。 */
export function canSubmit(member: Member, kind: 'work' | 'club' | 'project' | 'event'): boolean {
  if (member.role === 'rep') return true;
  if (kind === 'work') return true;                      // メンバー全員
  if (kind === 'event') return member.role === 'staff';  // 運営部・企画部
  if (kind === 'club') return member.role === 'leader' && member.club_slugs.length > 0;
  if (kind === 'project') return member.role === 'leader' && member.project_slugs.length > 0;
  return false;
}
