/* ══════════════════════════════════════════════════════════════════
   表示用の整形
   ⚠ 未確定の値は必ず「––」にする。0 や空文字で埋めない（CLAUDE.md 3-4）。
   ══════════════════════════════════════════════════════════════════ */

/** 未確定を表す表示。⚠ この文字列は check-content.mjs も参照する。 */
export const UNKNOWN = '––';

/** 'YYYY-MM' → 'YYYY.MM'。未指定なら '––'。 */
export function yearMonth(ym?: string): string {
  return ym ? ym.replace('-', '.') : UNKNOWN;
}

/** 数値。未確定は '––'。⚠ 0 で埋めない。 */
export function count(n?: number | null): string {
  return n === null || n === undefined ? UNKNOWN : String(n);
}

/** 任意の文字列。未指定は '––'。⚠ 空文字も未確定として扱う。 */
export function textOr(s?: string): string {
  return s && s.trim() !== '' ? s : UNKNOWN;
}

/**
 * イベントの日付。
 * 同じ月内なら '2026.09.04–06'、月をまたぐなら '2026.09.30–10.02'。
 */
export function formatEventDate(e: { date: string; endDate?: string }): string {
  const start = e.date.replace(/-/g, '.');
  if (!e.endDate) return start;
  const [sy, sm] = e.date.split('-');
  const [ey, em, ed] = e.endDate.split('-');
  if (sy === ey && sm === em) return `${start}–${ed}`;
  if (sy === ey) return `${start}–${em}.${ed}`;
  return `${start}–${e.endDate.replace(/-/g, '.')}`;
}
