import { FIELDS, needsConsent, type Field, type Kind, type Op } from './fields';

/* ══════════════════════════════════════════════════════════════════
   入力内容の検証
   根拠：draft/ロードマップ.md 6-1 ／ lib/schema.ts

   ⚠ ここは「親切のための検証」であって、「安全のための検証」ではない。
     安全は RLS（0001_submissions.sql）と Edge Function が担保する。
     画面の検証だけに頼ると、APIを直接叩かれたときに素通りする。

   ⚠ 形式は lib/schema.ts の正規表現と一致させている。
     ここを緩めると、承認したのに Markdown が Zod で弾かれてビルドが落ちる。
     落ちる場所が「投稿の瞬間」から「公開の瞬間」にずれるだけで、誰も得しない。
   ══════════════════════════════════════════════════════════════════ */

export type SubmissionData = Record<string, unknown>;

/** 項目キー → 日本語のエラー文。空なら問題なし。 */
export type Errors = Record<string, string>;

const YEAR_MONTH = /^\d{4}-\d{2}$/;   // lib/schema.ts と同じ
const DATE = /^\d{4}-\d{2}-\d{2}$/;   // lib/schema.ts と同じ

/** 空欄か。0 と false は「空」ではないので注意。 */
function isEmpty(v: unknown): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (Array.isArray(v)) return v.filter((x) => String(x).trim() !== '').length === 0;
  if (typeof v === 'object') return Object.keys(v).length === 0;
  return false;
}

function checkFormat(f: Field, v: unknown): string | null {
  switch (f.type) {
    case 'yearMonth':
      return YEAR_MONTH.test(String(v)) ? null : '「2026-04」のように、年-月の形で書いてください。';

    case 'date':
      return DATE.test(String(v)) ? null : '「2026-09-04」のように、年-月-日の形で書いてください。';

    case 'year': {
      const n = Number(v);
      return Number.isInteger(n) && n >= 2000 && n <= 2100
        ? null
        : '2000〜2100 の範囲の西暦を、数字だけで書いてください。';
    }

    case 'number': {
      const n = Number(v);
      // ⚠ 0 を弾く。lib/schema.ts が positive() にしているのと同じ理由で、
      //   分からない数字を 0 で埋めさせないため（CLAUDE.md 3-4）。
      return Number.isInteger(n) && n > 0
        ? null
        : '1以上の整数を書いてください。分からないときは、空のままにしてください。';
    }

    case 'url':
      try {
        const u = new URL(String(v));
        return u.protocol === 'https:' || u.protocol === 'http:'
          ? null
          : 'https:// から始まるURLを書いてください。';
      } catch {
        return 'URLの形になっていません。https:// から始まる形で書いてください。';
      }

    case 'status':
      return v === 'active' || v === 'done' ? null : '状態を選んでください。';

    case 'belongsTo': {
      const b = v as { kind?: string; slug?: string };
      return b?.kind && b?.slug ? null : '一覧から選んでください。';
    }

    default:
      return null;
  }
}

/**
 * 提出できるかを調べる。
 *
 * @param consent 作品のときだけ見る。掲載への同意／写真に写る他人の許可。
 * @param op      何をする投稿か。⚠ 消す提案は入力欄そのものが違う。
 */
export function validate(
  kind: Kind,
  data: SubmissionData,
  consent: { publish: boolean; portrait: boolean },
  op: Op = 'create',
  deleteReason = '',
): Errors {
  const errors: Errors = {};

  // ⚠ 消す提案では、中身の項目を見ない。見る意味がないうえ、
  //   「消したいだけなのに本文の字数を直せ」と言われるのは理不尽である。
  //   代わりに理由を必須にする。理由のない削除は、あとから誰も検証できない。
  if (op === 'delete') {
    if (deleteReason.trim() === '') {
      errors.deleteReason = 'なぜ消すのかを書いてください。代表が判断できません。';
    }
    return errors;
  }

  for (const f of FIELDS[kind]) {
    const v = data[f.key];

    if (isEmpty(v)) {
      if (f.required) errors[f.key] = `${f.label}は必ず入力してください。`;
      // 任意項目が空なのは正しい状態。形式は見ない。
      continue;
    }

    const msg = checkFormat(f, v);
    if (msg) errors[f.key] = msg;
  }

  // ⚠ 終了年月は、設立年月より前にできない。
  const founded = data.foundedYearMonth;
  const ended = data.endedYearMonth;
  if (typeof founded === 'string' && typeof ended === 'string' && ended < founded) {
    errors.endedYearMonth = '終了が設立より前になっています。';
  }

  // ⚠ 最終日は開催日より前にできない。
  const date = data.date;
  const endDate = data.endDate;
  if (typeof date === 'string' && typeof endDate === 'string' && endDate < date) {
    errors.endDate = '最終日が開催日より前になっています。';
  }

  // ⚠ 状態が「終了」なのに終了年月が無い場合。止めはしないが、伝える。
  //   （分からない日付を捏造させるほうが有害なため、必須にはしない）

  if (needsConsent(kind, op)) {
    if (!consent.publish) errors.consent_publish = 'サイトへの掲載に同意が必要です。';
    if (!consent.portrait) {
      errors.consent_portrait = '写真に他の人が写っている場合、その人の許可が必要です。';
    }
  }

  return errors;
}

export const hasErrors = (e: Errors) => Object.keys(e).length > 0;
