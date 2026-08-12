-- ══════════════════════════════════════════════════════════════════
--  権限判定の補助関数を、公開APIから見えない場所へ移す
--  根拠：Supabase セキュリティ検査（database-linter 0028 / 0029）
--
--  ⚠ なぜ必要か
--    0001 では my_role() / is_rep() / may_submit() を public スキーマに
--    置いていた。public スキーマの関数は PostgREST が自動で公開するため、
--    ログインしていない人でも /rest/v1/rpc/is_rep のように直接呼べる。
--    実際に検査が6件の警告を出した（EXTERNAL facing / WARN）。
--
--    この3つが漏らすのは「呼んだ本人の役割」だけなので実害は小さい。
--    それでも塞ぐ理由は、代表が毎年替わるから：
--    「小さいから放っておいた警告」は、次の代に引き継ぐと
--    「昔からある警告」に変わり、本物の警告と見分けがつかなくなる。
--    警告は0件で引き継ぐ。
--
--  ⚠ private スキーマは PostgREST の公開対象に入っていない。
--    RLS のポリシーからは今までどおり呼べるが、外からは呼べなくなる。
-- ══════════════════════════════════════════════════════════════════

create schema if not exists private;

-- ⚠ ポリシーから呼ぶために、実行権限そのものは要る。
--   公開されなくなるのは「経路」であって「権限」ではない。
grant usage on schema private to authenticated, anon;

/* ── 関数を private に作り直す ─────────────────────── */

create or replace function private.my_role() returns member_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.members where user_id = auth.uid()), 'member');
$$;

create or replace function private.is_rep() returns boolean
language sql stable security definer set search_path = public as $$
  select private.my_role() = 'rep';
$$;

create or replace function private.may_submit(k submission_kind, slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when private.my_role() = 'rep' then true
    when k = 'work'    then true
    when k = 'event'   then private.my_role() = 'staff'
    -- ⚠ 配列に対する any。`slug = any (select club_slugs …)` とは書けない
    --   （副問い合わせが返すのは配列という1つの値で、値の集合ではないため）。
    when k = 'club'    then private.my_role() = 'leader'
                           and exists (select 1 from public.members m
                                        where m.user_id = auth.uid()
                                          and slug = any (m.club_slugs))
    when k = 'project' then private.my_role() = 'leader'
                           and exists (select 1 from public.members m
                                        where m.user_id = auth.uid()
                                          and slug = any (m.project_slugs))
    else false
  end;
$$;

/* ── ポリシーを貼り直す ─────────────────────────────
   ⚠ 中身は 0001 と同一。参照先が public.* から private.* に変わるだけ。
     権限の内容を変えていないことを、差分で確かめられるようにしてある。 */

drop policy if exists members_select      on public.members;
drop policy if exists members_insert_self on public.members;
drop policy if exists members_update_self on public.members;
drop policy if exists members_admin       on public.members;

create policy members_select on public.members for select
  using (user_id = auth.uid() or private.is_rep());

create policy members_insert_self on public.members for insert
  with check (user_id = auth.uid() and role = 'member'
              and club_slugs = '{}' and project_slugs = '{}');

create policy members_update_self on public.members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = private.my_role());

create policy members_admin on public.members for all
  using (private.is_rep()) with check (private.is_rep());

drop policy if exists subs_select     on public.submissions;
drop policy if exists subs_insert     on public.submissions;
drop policy if exists subs_update_own on public.submissions;
drop policy if exists subs_delete_own on public.submissions;
drop policy if exists subs_admin      on public.submissions;

create policy subs_select on public.submissions for select
  using (author = auth.uid() or private.is_rep());

create policy subs_insert on public.submissions for insert
  with check (author = auth.uid() and private.may_submit(kind, target_slug));

create policy subs_update_own on public.submissions for update
  using (author = auth.uid() and state in ('draft', 'returned'))
  with check (author = auth.uid() and state in ('draft', 'pending'));

create policy subs_delete_own on public.submissions for delete
  using (author = auth.uid() and state in ('draft', 'returned'));

create policy subs_admin on public.submissions for all
  using (private.is_rep()) with check (private.is_rep());

drop policy if exists sub_images_rw on storage.objects;

create policy sub_images_rw on storage.objects for all to authenticated
  using (bucket_id = 'submissions'
         and (private.is_rep() or (storage.foldername(name))[1] = auth.uid()::text))
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = auth.uid()::text);

/* ── 公開スキーマ側を消す ───────────────────────────
   ⚠ ポリシーを貼り直した後でないと、依存関係で落ちる。順序を変えないこと。 */

drop function if exists public.may_submit(submission_kind, text);
drop function if exists public.is_rep();
drop function if exists public.my_role();
