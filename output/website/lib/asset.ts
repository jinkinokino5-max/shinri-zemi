/* ══════════════════════════════════════════════════════════════════
   画像などのパスに basePath を付ける

   ⚠ なぜ必要か
     GitHub Pages は https://<ユーザー>.github.io/shinri-zemi/ で配信される。
     Next.js の <Link> や next/image には basePath が自動で付くが、
     .md ファイルに書いた "/photos/clubs/dokusho/1.jpg" のような
     素の文字列には付かない。そのままだと写真が1枚も表示されない。

   ⚠ 独自ドメインに移したら BASE_PATH が空になり、この関数は素通しになる。
     コードを直す必要はない。
   ══════════════════════════════════════════════════════════════════ */

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export function asset(path: string): string {
  // 外部URL（https://…）や data: はそのまま返す。
  if (/^(https?:)?\/\//.test(path) || path.startsWith('data:')) return path;
  if (!path.startsWith('/')) return path;
  return `${BASE}${path}`;
}
