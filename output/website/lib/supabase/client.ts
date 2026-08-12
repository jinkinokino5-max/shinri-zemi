'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/* ══════════════════════════════════════════════════════════════════
   Supabase クライアント（ブラウザ専用）
   根拠：draft/ロードマップ.md フェーズ6 6-B

   ⚠ なぜブラウザだけで完結させているか
     サイトは output:'export'（静的書き出し）のまま。サーバーが無い。
     投稿画面だけをクライアント側で動かすことで、
     既存の29ページ・GitHub Pages・8月公開に一切手を触れずに済む。

   ⚠ ここで使う anon key は公開してよい鍵である。
     これは「誰でも何でもできる鍵」ではない。何ができるかは
     supabase/migrations/0001_submissions.sql の RLS が決める。
     service_role key は絶対にここへ書かない（あれは全権限を持つ）。
   ══════════════════════════════════════════════════════════════════ */

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** 設定が入っているか。未設定なら投稿画面は「準備中」を出す。 */
export const isConfigured = Boolean(url && anonKey);

let cached: SupabaseClient | null = null;

/**
 * 設定済みならクライアントを返す。未設定なら null。
 *
 * ⚠ null を返す設計にしている理由：環境変数が無いときに例外を投げると、
 *   .env を持たない人（＝これから引き継ぐ後輩）がビルドすらできなくなる。
 *   「動かないが壊れない」を既定にする。
 */
export function getSupabase(): SupabaseClient | null {
  if (!isConfigured) return null;
  cached ??= createClient(url!, anonKey!, {
    auth: {
      // Googleログインから戻ってきたURLのトークンを自動で回収する。
      detectSessionInUrl: true,
      persistSession: true,
      autoRefreshToken: true,
    },
  });
  return cached;
}

/** Edge Function `publish` のURL。 */
export const PUBLISH_FUNCTION_URL = url ? `${url}/functions/v1/publish` : '';
