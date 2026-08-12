'use client';

import { useId } from 'react';
import type { Field } from '@/lib/submission/fields';
import s from './form.module.css';

/* ══════════════════════════════════════════════════════════════════
   入力欄1つ
   根拠：draft/ロードマップ.md 6-1 の4つの表 ／ 06資料 2章（アクセシビリティ）

   ⚠ label と入力欄は必ず id で結ぶ。placeholder をラベル代わりにしない。
     入力を始めた瞬間に何の欄か分からなくなる（06資料が指摘している失敗）。
   ⚠ エラーは色だけで示さない。文章で出し、aria-describedby で結ぶ。
   ══════════════════════════════════════════════════════════════════ */

export type BelongsToOption = { kind: 'club' | 'project' | 'event'; slug: string; name: string };

type Props = {
  field: Field;
  value: unknown;
  error?: string;
  onChange: (v: unknown) => void;
  /** belongsTo 型のときだけ使う。既存の部活・PJ・イベント。 */
  options?: BelongsToOption[];
};

export function FieldInput({ field, value, error, onChange, options = [] }: Props) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errId = `${id}-err`;
  const describedBy = [field.hint ? hintId : '', error ? errId : ''].filter(Boolean).join(' ');

  return (
    <div className={s.field}>
      <label className={s.label} htmlFor={id}>
        {field.label}
        {field.required ? (
          <span className={s.required}>必須</span>
        ) : (
          <span className={s.optional}>任意</span>
        )}
      </label>

      {field.hint && (
        <p className={s.hint} id={hintId}>
          {field.hint}
        </p>
      )}

      <Control
        id={id}
        field={field}
        value={value}
        onChange={onChange}
        options={options}
        describedBy={describedBy || undefined}
        invalid={Boolean(error)}
      />

      {error && (
        <p className={s.error} id={errId} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function Control({
  id,
  field,
  value,
  onChange,
  options,
  describedBy,
  invalid,
}: {
  id: string;
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
  options: BelongsToOption[];
  describedBy?: string;
  invalid: boolean;
}) {
  const common = {
    id,
    className: invalid ? `${s.input} ${s.inputInvalid}` : s.input,
    'aria-describedby': describedBy,
    'aria-invalid': invalid || undefined,
  };

  switch (field.type) {
    case 'textarea':
      return (
        <textarea
          {...common}
          className={`${common.className} ${s.textarea}`}
          rows={10}
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case 'status':
      // ⚠ ラジオにしている。選択式（select）だと「いま何が選ばれているか」が
      //   閉じている間わからず、終了に切り替えたつもりが切り替わっていない事故が起きる。
      return (
        <fieldset className={s.radioSet} id={id} aria-describedby={describedBy}>
          {(['active', 'done'] as const).map((v) => (
            <label key={v} className={s.radio}>
              <input
                type="radio"
                name={id}
                checked={value === v}
                onChange={() => onChange(v)}
              />
              {field.statusLabels?.[v] ?? v}
            </label>
          ))}
        </fieldset>
      );

    case 'belongsTo': {
      const cur = value as { kind?: string; slug?: string } | undefined;
      const key = cur?.kind && cur?.slug ? `${cur.kind}:${cur.slug}` : '';
      return (
        <select
          {...common}
          value={key}
          onChange={(e) => {
            const [kind, slug] = e.target.value.split(':');
            onChange(kind ? { kind, slug } : undefined);
          }}
        >
          <option value="">選んでください</option>
          {(['club', 'project', 'event'] as const).map((k) => {
            const group = options.filter((o) => o.kind === k);
            if (group.length === 0) return null;
            const label = k === 'club' ? '部活' : k === 'project' ? 'PJ' : 'イベント';
            return (
              <optgroup key={k} label={label}>
                {group.map((o) => (
                  <option key={`${k}:${o.slug}`} value={`${k}:${o.slug}`}>
                    {o.name}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      );
    }

    case 'list':
    case 'tags':
      return (
        <ListInput
          id={id}
          value={(value as string[]) ?? []}
          onChange={onChange}
          describedBy={describedBy}
          invalid={invalid}
          addLabel={field.type === 'tags' ? 'タグを追加' : '欄を追加'}
        />
      );

    case 'number':
    case 'year':
      return (
        <input
          {...common}
          className={`${common.className} ${s.short}`}
          type="number"
          inputMode="numeric"
          value={value === undefined || value === null ? '' : String(value)}
          // ⚠ 空欄は undefined にする。0 にしてはいけない（CLAUDE.md 3-4）。
          onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        />
      );

    case 'date':
      return (
        <input
          {...common}
          className={`${common.className} ${s.short}`}
          type="date"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    case 'yearMonth':
      return (
        <input
          {...common}
          className={`${common.className} ${s.short}`}
          type="month"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    case 'url':
      return (
        <input
          {...common}
          type="url"
          inputMode="url"
          placeholder="https://"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );

    default:
      return (
        <input
          {...common}
          type="text"
          value={String(value ?? '')}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}

/** 複数追加できるテキスト（制作者名・タグ）。 */
function ListInput({
  id,
  value,
  onChange,
  describedBy,
  invalid,
  addLabel,
}: {
  id: string;
  value: string[];
  onChange: (v: string[]) => void;
  describedBy?: string;
  invalid: boolean;
  addLabel: string;
}) {
  const rows = value.length > 0 ? value : [''];

  const set = (i: number, v: string) => {
    const next = [...rows];
    next[i] = v;
    onChange(next);
  };

  return (
    <div className={s.list}>
      {rows.map((v, i) => (
        <div className={s.listRow} key={i}>
          <input
            id={i === 0 ? id : undefined}
            aria-describedby={i === 0 ? describedBy : undefined}
            aria-invalid={i === 0 && invalid ? true : undefined}
            aria-label={`${i + 1}つめ`}
            className={invalid && i === 0 ? `${s.input} ${s.inputInvalid}` : s.input}
            value={v}
            onChange={(e) => set(i, e.target.value)}
          />
          {rows.length > 1 && (
            <button
              type="button"
              className={s.linkBtn}
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              消す
            </button>
          )}
        </div>
      ))}
      <button type="button" className={s.linkBtn} onClick={() => onChange([...rows, ''])}>
        ＋ {addLabel}
      </button>
    </div>
  );
}
