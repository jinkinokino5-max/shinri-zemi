-- ══════════════════════════════════════════════════════════════════
--  公開済みのものを「直す」「消す」提案を、投稿と同じ道に載せる
--  根拠：draft/ロードマップ.md 6-1（誰が何をできるか）／ F-8（公開の可否は代表）
--
--  ⚠ 何が変わるか
--    これまで submissions は「新しく載せる」だけを運べた。
--    ここから、公開済みの content/*.md に対する
--      ・内容を直す提案（update）
--      ・消す提案（delete）
--    も同じテーブル・同じ承認画面を通る。
--
--  ⚠ 変わらないこと（ここが重要）
--    実際に直る／消えるのは、代表が承認した瞬間だけ。
--    提案は誰にも見えない下書きと同じで、サイトは1文字も変わらない。
--    「提案できる」と「実行できる」を分けたのが、この変更の全部である。
--
--  ⚠ 提案は種類の制限をかけない（新規投稿とは扱いが違う）
--    新規投稿は「部活を作れるのは部長だけ」のように絞っている。
--    直す・消すの提案は、メンバーなら誰でも出せるようにする。理由：
--      ① 間違いに気づくのは、たいてい書いた本人ではない
--      ② 提案が実行されないので、絞る必要がない（絞ると誤りが放置される）
--      ③ 絞ると「言える人」を探す手間が生まれ、結局は誰も言わなくなる
--    荒らしへの備えは、ログイン必須であることと、代表の承認である。
-- ══════════════════════════════════════════════════════════════════

-- ── 何をする投稿か ─────────────────────────────────
create type submission_op as enum ('create', 'update', 'delete');

-- ⚠ default 'create'。既存の行は全部これまでどおり「新しく載せる」になる。
alter table public.submissions
  add column op submission_op not null default 'create';

comment on column public.submissions.op is
  'create=新しく載せる / update=公開済みを直す / delete=公開済みを消す。実行できるのは代表の承認後だけ。';

-- 消す提案のときだけ使う。投稿者が書き、代表と本人に見える。
alter table public.submissions
  add column delete_reason text;

comment on column public.submissions.delete_reason is
  '消す提案の理由。⚠ 理由のない削除は承認できない（何を消したのか後から誰も分からなくなるため）。';


-- ── 直す・消すには、対象が要る ─────────────────────
-- ⚠ target_slug が無い update/delete は「何を直すのか分からない提案」で、
--   承認画面まで進むと代表が判断できない。ここで入れないようにする。
alter table public.submissions
  add constraint change_needs_target check (op = 'create' or target_slug is not null);

-- ⚠ 消す提案には理由を必須にする。
--   draft は書きかけなので免除する（書いている途中に弾かれると入力が消える）。
alter table public.submissions
  add constraint delete_needs_reason check (
    op <> 'delete'
    or state = 'draft'
    or length(trim(coalesce(delete_reason, ''))) > 0
  );


-- ── 同意チェックの対象を整理する ───────────────────
-- ⚠ 「消す提案」に掲載同意を求めるのは筋が通らない（載せる話ではない）。
--   直す提案には引き続き求める。直した内容がそのまま公開されるため。
alter table public.submissions drop constraint work_requires_consent;

alter table public.submissions add constraint work_requires_consent check (
  kind <> 'work'
  or op = 'delete'
  or state = 'draft'
  or (consent_publish and consent_portrait)
);


-- ══════════════════════════════════════════════════════════════════
--  権限（RLS）
--  ⚠ 画面で隠すのは権限ではない。ここが唯一の権限である。
-- ══════════════════════════════════════════════════════════════════

/** その投稿を、いまのユーザーが出してよいか。
 *
 *  create : これまでどおり private.may_submit（種類ごとの制限あり）
 *  update : ログイン済みメンバーなら誰でも提案できる
 *  delete : 同上
 *
 *  ⚠ ここで true になっても、公開されるわけではない。
 *    公開は Edge Function `publish` が、改めて role='rep' を確かめてから行う。
 */
create or replace function private.may_propose(
  o    submission_op,
  k    submission_kind,
  slug text
) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when o = 'create' then private.may_submit(k, slug)
    -- ⚠ auth.uid() の確認はここでは書かない。呼び出し側のポリシーが
    --   author = auth.uid() を必ず併記しているため、二重に書くと
    --   「どちらが本当の条件か」が読めなくなる。
    else slug is not null
  end;
$$;

drop policy if exists subs_insert on public.submissions;

create policy subs_insert on public.submissions for insert
  with check (author = auth.uid() and private.may_propose(op, kind, target_slug));

/* ⚠ 「提出したあとに op が化けないようにするトリガー」を、いったん書いてから消した。
     記録として理由を残す。

     心配したのはこういう筋書きだった：
       代表が「直す提案」として読んでいるあいだに、投稿者が「消す提案」へ
       書き換え、代表が中身を確かめないまま公開ボタンを押してしまう。

     これは 0001 の subs_update_own が既に塞いでいる。
       using (author = auth.uid() and state in ('draft', 'returned'))
     提出済み（pending）の行は、投稿者にはもう書き換えられない。

     一方でトリガーを足すと、実害のある副作用が出た。
     下書きを開き直して「直す」から「消す」へ気が変わっただけで、
     保存が例外で落ちる。書きかけの入力が消える。

     ⚠ RLS が既に守っていることを、トリガーで二重に書かない。
       二重に書くと「どちらが本当の条件か」が読めなくなり、
       片方だけ直したときに、守っているつもりの穴ができる。 */
