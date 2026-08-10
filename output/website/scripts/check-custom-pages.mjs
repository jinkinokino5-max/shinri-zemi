// ══════════════════════════════════════════════════════════════════
//  独自ページの自動検査
//  根拠：draft/ロードマップ.md 5-C（独自ページのルール R-1〜R-6）
//
//  部活・PJ・イベント・作品は、それぞれ自分でデザインしたHTMLを置ける。
//  置き場所： custom/<種類>/<slug>/index.html （＋同じフォルダ内の画像・CSS）
//
//  ⚠ このスクリプトの目的は「代表の確認を楽にすること」。
//    公開前の確認は代表1人が行い、任期は1年。作品は件数に上限が無いため、
//    人の目だけに頼ると必ず形骸化する。形骸化した確認は、無いより危険。
//    → 機械で判定できることは全部ここで落とし、
//      代表には「人にしか判断できないこと」だけを残す。
//
//  機械が見る       ：JS混入・外部参照・容量・戻る帯・h1・alt
//  人（代表）が見る ：写っている人の許可、拾い画像、掲載ポリシー、内容の是非
// ══════════════════════════════════════════════════════════════════

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CUSTOM = join(root, 'custom');

/** 対象の種類とURLの対応。⚠ 4種すべてが対象（2026-08-10 決定）。 */
const KINDS = {
  clubs: '/clubs/',
  projects: '/projects/',
  events: '/events/',
  works: '/works/',
};

const MAX_BYTES = 10 * 1024 * 1024; // R-5：1つあたり10MBを上限とする
const ALLOWED_EXT = new Set([
  '.html', '.css',
  '.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif', '.svg',
]);

const errors = [];
const notes = [];

function dirSize(dir) {
  return readdirSync(dir).reduce((sum, f) => {
    const p = join(dir, f);
    const s = statSync(p);
    return sum + (s.isDirectory() ? dirSize(p) : s.size);
  }, 0);
}

function allFiles(dir, base = dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? allFiles(p, base) : [p.slice(base.length + 1)];
  });
}

if (!existsSync(CUSTOM)) {
  console.log('\n独自ページはまだ提出されていません（custom/ が空）。\n');
  process.exit(0);
}

let count = 0;

for (const kind of Object.keys(KINDS)) {
  const kindDir = join(CUSTOM, kind);
  if (!existsSync(kindDir)) continue;

  for (const slug of readdirSync(kindDir)) {
    const dir = join(kindDir, slug);
    if (!statSync(dir).isDirectory()) continue;
    count += 1;
    const where = `custom/${kind}/${slug}`;

    // ── index.html があるか ──────────────────────────
    const indexPath = join(dir, 'index.html');
    if (!existsSync(indexPath)) {
      errors.push(`${where}：index.html がありません`);
      continue;
    }
    const html = readFileSync(indexPath, 'utf8');

    // ── R-5：容量 ────────────────────────────────────
    const bytes = dirSize(dir);
    if (bytes > MAX_BYTES) {
      errors.push(
        `${where}：容量が ${(bytes / 1024 / 1024).toFixed(1)}MB。上限は10MBです` +
          `（写真を減らすか、小さくしてください）`,
      );
    }

    // ── 置いてよいファイル種別か ─────────────────────
    for (const f of allFiles(dir)) {
      if (!ALLOWED_EXT.has(extname(f).toLowerCase())) {
        errors.push(`${where}：置けない種類のファイル ${f}（HTML・CSS・画像のみ）`);
      }
    }

    // ── R-1：JavaScript 禁止 ─────────────────────────
    //   ⚠ 同一ドメイン配下は同じ出所として扱われる。投稿機能を作った後、
    //     ここのJSが本サイトの認証情報を読める危険がある。
    if (/<script[\s>]/i.test(html)) {
      errors.push(`${where}：<script> は使えません（JavaScript は禁止です）`);
    }
    const onAttr = html.match(/\son[a-z]+\s*=/gi);
    if (onAttr) {
      errors.push(`${where}：${onAttr[0].trim()} のような属性は使えません（JavaScript は禁止です）`);
    }
    if (/javascript:/i.test(html)) {
      errors.push(`${where}：javascript: で始まるリンクは使えません`);
    }

    // ── R-3：外部参照の禁止 ──────────────────────────
    //   外部CDNやよそのサイトの画像は、相手が消すと表示が崩れる。
    //   さらに閲覧者のIPが外部に渡るため、プライバシー上も避ける。
    for (const m of html.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/([^"']+)["']/gi)) {
      // 本サイト内へのリンクは許可（/ で始まるもの）
      errors.push(`${where}：外部サイトの読み込みは禁止です → ${m[0].slice(0, 60)}`);
    }
    if (/@import\s+url\(\s*["']?https?:/i.test(html)) {
      errors.push(`${where}：外部CSSの @import は禁止です`);
    }

    // ── R-2：一覧へ戻る帯 ────────────────────────────
    //   ⚠ 実際の差し込みはビルド側で行う（作った側が消せないようにするため）。
    //     ここでは「自前で書いた帯が二重にならないか」だけを注意として出す。
    if (html.includes('北大心理ゼミ') && /一覧へ戻る|一覧に戻る/.test(html)) {
      notes.push(`${where}：戻る帯を自分で書いているようです。帯は自動で入るので不要です`);
    }

    // ── 読みやすさの最低限 ───────────────────────────
    if (!/<h1[\s>]/i.test(html)) {
      errors.push(`${where}：<h1> がありません（ページの見出しを1つ入れてください）`);
    }
    for (const img of html.match(/<img[^>]*>/gi) ?? []) {
      if (!/\salt\s*=/i.test(img)) {
        errors.push(`${where}：alt の無い <img> があります（画像の説明を入れてください）`);
      }
    }
    if (!/<meta[^>]+charset\s*=\s*["']?utf-8/i.test(html)) {
      errors.push(`${where}：<meta charset="UTF-8"> がありません（日本語が文字化けします）`);
    }
    if (!/<html[^>]*lang\s*=\s*["']ja/i.test(html)) {
      notes.push(`${where}：<html lang="ja"> を入れると読み上げの精度が上がります`);
    }
  }
}

console.log(`\n独自ページ：${count} 件を検査しました`);
notes.forEach((n) => console.log(`　ℹ ${n}`));

if (errors.length > 0) {
  errors.forEach((e) => console.error(`❌ ${e}`));
  console.error(`\n${errors.length} 件、直す必要があります。\n`);
  process.exit(1);
}

if (count > 0) {
  console.log('✅ 機械で見られる項目は問題ありません。');
  console.log('   このあと代表が、以下を目で確認してください：');
  console.log('     ・写っている人の許可は取れているか');
  console.log('     ・拾い画像や他人の著作物が入っていないか');
  console.log('     ・掲載ポリシー（B-1〜B-5）に反していないか');
  console.log('     ・内容が団体として出して問題ないか\n');
}
