-- ══════════════════════════════════════════════════════════════════
--  フェーズ6：投稿機能のデータベース
--  根拠：draft/ロードマップ.md フェーズ6（6-B / 6-C / 6-D）
--
--  ⚠ この設計の前提（案A：Markdown書き戻し）
--    ここに溜まるのは「まだ公開されていない投稿」だけ。
--    代表が承認すると Edge Function が content/*.md を GitHub に書き、
--    既存の自動デプロイでサイトに出る。
--    → 公開済みの正は、いまも昔も content/*.md（Git）である。
--      データベースが壊れても、サイトは1文字も失われない。
--
--  ⚠ 本名を保存しない（必要情報更新 B-1：本人選択制）
--    members.display_name はログイン後に本人が入力する「サイトに出す名前」。
--    Googleアカウントの氏名を自動で入れてはならない。
--    保存しなければ漏れない。これは実装上の都合ではなく約束である。
-- ══════════════════════════════════════════════════════════════════

-- ── 型 ─────────────────────────────────────────────
create type submission_kind  as enum ('work', 'club', 'project', 'event');
create type submission_state as enum ('draft', 'pending', 'returned', 'published');

-- 誰が何をできるか（ロードマップ 6-1「誰が何をできるか」の表をそのまま型にする）
--   member : 作品だけ
--   leader : ＋ 自分の部活・自分のPJ
--   staff  : ＋ イベント（運営部・企画部）
--   rep    : ＋ 全部 ＋ 公開の可否
create type member_role as enum ('member', 'leader', 'staff', 'rep');


-- ── メンバー ───────────────────────────────────────
create table public.members (
  user_id       uuid primary key references auth.users on delete cascade,

  -- ⚠ サイトに出す名前。本名でもニックネームでも本人が選ぶ（B-1）。
  --   Googleの氏名を既定値にしないこと。
  display_name  text not null check (length(trim(display_name)) between 1 and 40),

  role          member_role not null default 'member',

  -- leader が編集できる対象。代表が入れる。
  club_slugs    text[] not null default '{}',
  project_slugs text[] not null default '{}',

  created_at    timestamptz not null default now()
);

comment on column public.members.display_name is
  'サイトに出す表示名。本名は保存しない（必要情報更新 B-1 本人選択制）。';


-- ── 投稿 ───────────────────────────────────────────
create table public.submissions (
  id          uuid primary key default gen_random_uuid(),
  kind        submission_kind  not null,
  state       submission_state not null default 'draft',

  -- 既存のものを更新する投稿なら、その slug。新規なら null。
  -- ⚠ 新規のとき slug は代表の承認時に確定させる（公開後に変わらないようにするため）。
  target_slug text check (target_slug ~ '^[a-z0-9-]+$'),

  author      uuid not null references auth.users on delete cascade,

  -- 入力内容。形の検証はアプリ側（lib/submission/validate.ts）と
  -- Edge Function の両方で行う。ここでは中身に踏み込まない。
  data        jsonb not null default '{}'::jsonb,

  -- [{ "path": "submissions/<id>/1.jpg", "alt": "…" }]
  -- 実体は Storage の submissions バケット。
  images      jsonb not null default '[]'::jsonb,

  -- ⚠ 作品投稿では両方 true でないと提出できない（ロードマップ 6-1 ①）。
  --   チェックボックスは「外せない」＝ false のまま pending にできない、で実装する。
  consent_publish  boolean not null default false,
  consent_portrait boolean not null default false,

  -- 差し戻しの理由。代表が書く。投稿者に見える。
  review_note text,
  reviewed_by uuid references auth.users,
  reviewed_at timestamptz,

  published_at     timestamptz,
  published_commit text,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- ⚠ 作品は同意なしに提出できない。データベースの側で担保する。
  --   画面のチェックボックスだけに頼ると、APIを直接叩かれたときに素通りする。
  constraint work_requires_consent check (
    kind <> 'work'
    or state = 'draft'
    or (consent_publish and consent_portrait)
  )
);

create index submissions_state_idx  on public.submissions (state, updated_at desc);
create index submissions_author_idx on public.submissions (author, updated_at desc);

-- updated_at の自動更新
-- ⚠ set search_path を明示する。省くと Supabase のセキュリティ検査が
--   「search_path が可変の関数」として警告する（実際に検出される）。
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = public as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger submissions_touch
  before update on public.submissions
  for each row execute function public.touch_updated_at();


-- ══════════════════════════════════════════════════════════════════
--  権限（RLS）
--  ⚠ 画面で隠すのは権限ではない。ここが唯一の権限である。
-- ══════════════════════════════════════════════════════════════════

-- security definer で members を読む。
-- ⚠ ポリシーの中から members を直接 select すると、members 自身のポリシーが
--   再帰的に評価されて無限再帰になる。これを避けるための関数。
create function public.my_role() returns member_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.members where user_id = auth.uid()), 'member');
$$;

create function public.is_rep() returns boolean
language sql stable security definer set search_path = public as $$
  select public.my_role() = 'rep';
$$;

/** その投稿を、いまのユーザーが作ってよいか。ロードマップ 6-1 の表そのもの。 */
create function public.may_submit(k submission_kind, slug text) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when public.my_role() = 'rep' then true
    when k = 'work'    then true                                   -- メンバー全員
    when k = 'event'   then public.my_role() = 'staff'              -- 運営部・企画部
    -- ⚠ club_slugs は配列なので、`slug = any (select club_slugs …)` とは書けない。
    --   副問い合わせが返すのは「配列という1つの値」であって、値の集合ではないため
    --   text = text[] の比較になり、関数の作成時点で落ちる（実際に落ちた）。
    --   exists で1行を取り出し、その行の配列に対して any を使う。
    when k = 'club'    then public.my_role() = 'leader'
                           and exists (select 1 from public.members m
                                        where m.user_id = auth.uid()
                                          and slug = any (m.club_slugs))
    when k = 'project' then public.my_role() = 'leader'
                           and exists (select 1 from public.members m
                                        where m.user_id = auth.uid()
                                          and slug = any (m.project_slugs))
    else false
  end;
$$;

alter table public.members     enable row level security;
alter table public.submissions enable row level security;

-- ── members ──
-- 自分の行は読める。代表は全員読める。
create policy members_select on public.members for select
  using (user_id = auth.uid() or public.is_rep());

-- 初回ログイン時に自分の行を作る。⚠ role は 'member' 固定。自分で昇格できない。
create policy members_insert_self on public.members for insert
  with check (user_id = auth.uid() and role = 'member'
              and club_slugs = '{}' and project_slugs = '{}');

-- 自分で変えてよいのは表示名だけ。role の書き換えは下の with check で弾く。
create policy members_update_self on public.members for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = public.my_role());

create policy members_admin on public.members for all
  using (public.is_rep()) with check (public.is_rep());

-- ── submissions ──
-- 自分の投稿は読める。代表は全部読める。
create policy subs_select on public.submissions for select
  using (author = auth.uid() or public.is_rep());

create policy subs_insert on public.submissions for insert
  with check (author = auth.uid() and public.may_submit(kind, target_slug));

-- ⚠ 提出後（pending）と公開後（published）は投稿者が書き換えられない。
--   代表が読んでいる最中に中身が変わる、公開済みが黙って変わる、を防ぐ。
create policy subs_update_own on public.submissions for update
  using (author = auth.uid() and state in ('draft', 'returned'))
  with check (author = auth.uid() and state in ('draft', 'pending'));

create policy subs_delete_own on public.submissions for delete
  using (author = auth.uid() and state in ('draft', 'returned'));

create policy subs_admin on public.submissions for all
  using (public.is_rep()) with check (public.is_rep());

-- ⚠ 削除ポリシーを代表にも与えているが、画面には削除ボタンを置かない
--   （ロードマップ 6-1：削除すると紐づく作品の所属先が消えてリンク切れになる）。
--   ここで許しているのは「未公開の下書きの掃除」のためだけ。


-- ══════════════════════════════════════════════════════════════════
--  写真の置き場（Storage）
--  ⚠ 非公開バケット。承認されるまで誰にも見えない。
--    公開されるものは Edge Function が public/photos/ へ書き出す。
-- ══════════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('submissions', 'submissions', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

-- 自分のフォルダ（submissions/<自分のuid>/…）だけ触れる。
create policy sub_images_rw on storage.objects for all to authenticated
  using (bucket_id = 'submissions'
         and (public.is_rep() or (storage.foldername(name))[1] = auth.uid()::text))
  with check (bucket_id = 'submissions'
              and (storage.foldername(name))[1] = auth.uid()::text);
