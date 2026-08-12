// ══════════════════════════════════════════════════════════════════
//  Edge Function `publish`
//  承認された投稿を content/*.md として GitHub に書き込む。
//  根拠：draft/ロードマップ.md フェーズ6 6-D
//
//  ⚠ この関数が、案A（Markdown書き戻し）の心臓部である。
//
//    投稿 ──→ Supabase(pending) ──→ 代表が承認 ──→ [この関数]
//                                                      │
//                              content/<種類>/<slug>.md を1コミット
//                                                      │
//                              既存の GitHub Actions が再ビルド → 公開
//
//  ⚠ 公開済みの「正」は Git であって、このデータベースではない。
//    データベースが消えてもサイトは1文字も失われない。これは事故対策ではなく、
//    代表が毎年替わる団体に対して、履歴が読める形で残すための設計である。
//
//  ⚠ GitHub のトークンはここにしか存在しない。ブラウザには絶対に置かない。
//    置いた瞬間、誰でもリポジトリに書けるようになる。
//
//  必要な環境変数（Supabase のダッシュボードで設定する）
//    GITHUB_TOKEN   contents:write だけを持つ Fine-grained token
//    GITHUB_REPO    例：jinkinokino5-max/shinri-zemi
//    GITHUB_BRANCH  既定 main
//    REPO_SUBDIR    サイトのコードの位置。既定 output/website
// ══════════════════════════════════════════════════════════════════

import { createClient } from 'jsr:@supabase/supabase-js@2';
// ⚠ Markdown の組み立ては切り出してある。単体で試せるようにするため。
//   scripts/check-publish-markdown.mjs が、この出力を実際に Zod へ通して確かめる。
import { fileName, toMarkdown, type PublishRow } from './to-markdown.ts';

const GITHUB_API = 'https://api.github.com';

const env = (k: string, fallback?: string) => Deno.env.get(k) ?? fallback ?? '';

const REPO = env('GITHUB_REPO');
const BRANCH = env('GITHUB_BRANCH', 'main');
const SUBDIR = env('REPO_SUBDIR', 'output/website');
const TOKEN = env('GITHUB_TOKEN');

const COLLECTION: Record<string, string> = {
  work: 'works',
  club: 'clubs',
  project: 'projects',
  event: 'events',
};

const KIND_JA: Record<string, string> = {
  work: '作品',
  club: '部活',
  project: 'PJ',
  event: 'イベント',
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  });

/* ── GitHub ─────────────────────────────────────── */

async function gh(path: string, init?: RequestInit) {
  const res = await fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: 'application/vnd.github+json',
      'content-type': 'application/json',
      'user-agent': 'shinri-zemi-publish',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status} ${await res.text()}`);
  return res.json();
}

type FileToCommit = { path: string; content: string; encoding: 'utf-8' | 'base64' };

/**
 * 複数ファイルを1コミットで書く。
 *
 * ⚠ 1ファイルずつ Contents API で書かない。途中で失敗すると
 *   「Markdown はあるが写真が無い」中途半端な状態がコミットされ、
 *   ビルドが落ちる（lib/content.ts が、指定された写真の不在で止める）。
 *   Git Data API なら、木ごと1回で差し替わる。
 */
async function commitFiles(files: FileToCommit[], message: string): Promise<string> {
  const ref = await gh(`/repos/${REPO}/git/ref/heads/${BRANCH}`);
  const baseSha: string = ref.object.sha;
  const baseCommit = await gh(`/repos/${REPO}/git/commits/${baseSha}`);

  const blobs = await Promise.all(
    files.map(async (f) => {
      const blob = await gh(`/repos/${REPO}/git/blobs`, {
        method: 'POST',
        body: JSON.stringify({ content: f.content, encoding: f.encoding }),
      });
      return { path: f.path, mode: '100644', type: 'blob', sha: blob.sha };
    }),
  );

  const tree = await gh(`/repos/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: blobs }),
  });

  const commit = await gh(`/repos/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [baseSha] }),
  });

  await gh(`/repos/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return commit.sha;
}

/* ── 本体 ───────────────────────────────────────── */

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST のみ' }, 405);

  try {
    const authorization = req.headers.get('Authorization') ?? '';
    if (!authorization) return json({ error: 'ログインが必要です' }, 401);

    // ⚠ service_role キーを使う。RLS を飛び越えられるので、
    //   この下で「本当に代表か」を必ず自分で確かめること。
    const admin = createClient(
      env('SUPABASE_URL'),
      env('SUPABASE_SERVICE_ROLE_KEY'),
      { auth: { persistSession: false } },
    );

    const { data: userData } = await admin.auth.getUser(authorization.replace('Bearer ', ''));
    const user = userData?.user;
    if (!user) return json({ error: 'ログインが確認できません' }, 401);

    const { data: me } = await admin
      .from('members')
      .select('role')
      .eq('user_id', user.id)
      .single();

    // ⚠ 公開できるのは代表だけ（ロードマップ 6-1 の表／F-8）。
    if (me?.role !== 'rep') return json({ error: '公開できるのは代表だけです' }, 403);

    if (!TOKEN || !REPO) {
      return json({ error: 'GITHUB_TOKEN / GITHUB_REPO が未設定です' }, 500);
    }

    const { submission_id } = await req.json();
    if (!submission_id) return json({ error: 'submission_id がありません' }, 400);

    const { data: row, error } = await admin
      .from('submissions')
      .select('*')
      .eq('id', submission_id)
      .single();
    if (error || !row) return json({ error: '投稿が見つかりません' }, 404);
    if (row.state !== 'pending') return json({ error: 'この投稿は提出中ではありません' }, 409);
    if (!row.target_slug) return json({ error: 'URLになる名前（slug）が未設定です' }, 400);

    const collection = COLLECTION[row.kind];
    const photoDir = `/photos/${collection}/${row.target_slug}`;
    const files: FileToCommit[] = [];

    // 写真を Storage から取り出して、リポジトリに入れる。
    // ⚠ 加工はしない。ビルド前の scripts/optimize-images.mjs（sharp）が担当する。
    //   ここで縮めると、元の解像度が永久に失われる。
    for (const im of (row.images ?? []) as { path: string; alt: string }[]) {
      const { data: blob, error: dlErr } = await admin.storage.from('submissions').download(im.path);
      if (dlErr || !blob) throw new Error(`写真を取り出せません：${im.path}`);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = '';
      for (let i = 0; i < bytes.length; i += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      }
      files.push({
        path: `${SUBDIR}/public${photoDir}/${fileName(im.path)}`,
        content: btoa(binary),
        encoding: 'base64',
      });
    }

    files.push({
      path: `${SUBDIR}/content/${collection}/${row.target_slug}.md`,
      content: toMarkdown(row as PublishRow, photoDir),
      encoding: 'utf-8',
    });

    // ⚠ コミットメッセージに投稿IDと承認者を残す。
    //   代表が毎年替わるので、「誰がいつ何を通したか」は git log 側にも要る。
    const sha = await commitFiles(
      files,
      `${KIND_JA[row.kind] ?? row.kind}「${row.data?.title ?? row.data?.name ?? row.target_slug}」を公開\n\n投稿ID: ${row.id}\n承認: ${user.id}`,
    );

    await admin
      .from('submissions')
      .update({
        state: 'published',
        published_at: new Date().toISOString(),
        published_commit: sha,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', row.id);

    return json({ ok: true, commit: sha, path: `/${collection}/${row.target_slug}/` });
  } catch (e) {
    // ⚠ 失敗しても投稿は pending のまま残る。消えない。もう一度押せばよい。
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});
