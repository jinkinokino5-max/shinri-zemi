'use client';

import { useCallback, useRef, useState } from 'react';
import { Thumb } from '@/components/Thumb';
import type { Focus } from '@/lib/schema';
import s from './framing.module.css';

/* ══════════════════════════════════════════════════════════════════
   1枚目の写真が、実際にどう出るかを見せて、位置と拡大率を決める
   根拠：draft/デザイン大本資料_v1.md 6-5（朱の乗算）／ 6-4（フォールバック）
        ／ lib/schema.ts の Focus

   ⚠ なぜ要るか
     1枚目（cover）は、出る場所ごとに違う比率へ切り抜かれる。
       一覧カード 4:3 ／ トップの帯 16:10 ／ 部活・PJ 16:9 ／ 作品 3:2
     投稿画面が正方形に近い枠で見せていると、投稿者は「まん中が残る」と
     思ったまま提出する。実際には 16:9 で上下が大きく落ちる。
     顔や題字が切れていることに、公開されてから気づくことになる。

   ⚠ プレビューは components/Thumb.tsx を「そのまま」使う。
     見た目を似せて作り直さない。作り直すと、本体の CSS を直したときに
     ここだけ古いままになり、**嘘のプレビュー**になる。
     嘘のプレビューは、プレビューが無いより悪い（信じて提出するため）。

   ⚠ グレースケールと朱の乗算も、そのまま出る（6-5）。
     ここで色を戻して見せない。「投稿画面ではきれいだったのに」を作らない。

   ⚠ 2枚目以降にはこの調整を出さない。
     作品ページで元の比率のまま出るので、切り抜かれない＝決めることが無い。
   ══════════════════════════════════════════════════════════════════ */

/** 省略時の値。⚠ lib/schema.ts の Focus の default と揃えること。 */
export const DEFAULT_FOCUS: Focus = { x: 50, y: 50, zoom: 1 };

/** サイトの中で、この写真が切り抜かれて出る場所。⚠ 実際の比率と揃えること。
 *  Card.tsx（既定 4/3）／ WorkBelt.tsx（16/10）／ clubs・projects（16/9）
 *  ／ works/[slug]（3/2）を見て決めている。 */
const CONTEXTS = [
  { ratio: '16 / 9', label: '部活・PJのページ', note: 'いちばん大きく切られます' },
  { ratio: '3 / 2', label: '作品のページ' },
  { ratio: '16 / 10', label: 'トップの帯' },
  { ratio: '4 / 3', label: '一覧のカード' },
] as const;

export function PhotoFraming({
  src,
  alt,
  name,
  focus,
  onChange,
  readOnly = false,
}: {
  /** 表示できるURL。署名付きURLでも公開パスでもよい。 */
  src: string;
  alt: string;
  /** 写真が無いときのフォールバックに出る名前。ここでは常に写真がある。 */
  name: string;
  focus: Focus;
  onChange?: (f: Focus) => void;
  /** 承認画面で使うときは true。見せるだけで、動かせない。 */
  readOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const cover = { src, alt, focus };

  return (
    <div className={s.wrap}>
      <p className={s.caption}>
        {readOnly ? 'サイトでの出かた' : 'サイトでは、こう出ます'}
        {/* ⚠ 加工が「かかること」を先に言う。あとから驚かせない。 */}
        <span className={s.captionNote}>
          灰色になって朱がかかるのは、サイト全体の決まりです（写真ごとには変えられません）
        </span>
      </p>

      <ul className={s.contexts}>
        {CONTEXTS.map((c) => (
          <li key={c.ratio} className={s.context}>
            <Thumb cover={cover} name={name} ratio={c.ratio} />
            <p className={s.contextLabel}>
              {c.label}
              <span className={s.contextRatio}>{c.ratio.replace(/ /g, '')}</span>
            </p>
            {'note' in c && c.note && <p className={s.contextNote}>{c.note}</p>}
          </li>
        ))}
      </ul>

      {!readOnly && onChange && (
        <>
          <button type="button" className={s.toggle} onClick={() => setOpen((v) => !v)}>
            {open ? '切り抜きの調整を閉じる' : '切れてしまう場合は、ここで調整できます'}
          </button>
          {open && <FocusEditor src={src} alt={alt} focus={focus} onChange={onChange} />}
        </>
      )}
    </div>
  );
}

/* ── 位置と拡大率を決める ───────────────────────── */

function FocusEditor({
  src,
  alt,
  focus,
  onChange,
}: {
  src: string;
  alt: string;
  focus: Focus;
  onChange: (f: Focus) => void;
}) {
  const areaRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  /** 枠の中の位置から焦点を決める。⚠ 0〜100 に収める。 */
  const setFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const el = areaRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
      onChange({
        ...focus,
        x: clamp(((clientX - r.left) / r.width) * 100),
        y: clamp(((clientY - r.top) / r.height) * 100),
      });
    },
    [focus, onChange],
  );

  return (
    <div className={s.editor}>
      {/* ⚠ いちばん切られる 16:9 で調整させる。ここで収まっていれば、
            他の比率でも収まる（16:9 が最も上下を落とすため）。 */}
      <p className={s.editorNote}>
        いちばん大きく切られる <b>16:9</b> で調整します。ここで収まっていれば、
        ほかの場所でも収まります。写真の<b>残したいところを押す</b>か、下のつまみを動かしてください。
      </p>

      <div
        ref={areaRef}
        className={s.area}
        // ⚠ マウスでもタッチでも同じ扱いにする（pointer events）。
        onPointerDown={(e) => {
          dragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging.current) setFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
      >
        {/* ⚠ 調整中だけは加工を外した素の写真を出す。
              灰色＋朱のままだと、何が写っているか判別しづらく、
              「どこを残すか」を決められない。決めた結果は上のプレビューで確かめる。 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className={s.areaImg}
          src={src}
          alt={alt}
          style={{
            objectPosition: `${focus.x}% ${focus.y}%`,
            transformOrigin: `${focus.x}% ${focus.y}%`,
            transform: focus.zoom > 1 ? `scale(${focus.zoom})` : undefined,
          }}
        />
        {/* いま中心にしている場所。⚠ 色だけの目印にしない。輪で形も示す。 */}
        <span
          className={s.crosshair}
          style={{ left: `${focus.x}%`, top: `${focus.y}%` }}
          aria-hidden="true"
        />
      </div>

      {/* ⚠ つまみ（range）は飾りではない。押す操作だけにすると、
            キーボードだけで使う人が調整できなくなる（06資料 2章）。 */}
      <div className={s.sliders}>
        <Slider
          label="横の位置"
          min={0}
          max={100}
          step={1}
          value={focus.x}
          onChange={(x) => onChange({ ...focus, x })}
          format={(v) => (v === 50 ? 'まん中' : v < 50 ? `左寄り ${50 - v}` : `右寄り ${v - 50}`)}
        />
        <Slider
          label="縦の位置"
          min={0}
          max={100}
          step={1}
          value={focus.y}
          onChange={(y) => onChange({ ...focus, y })}
          format={(v) => (v === 50 ? 'まん中' : v < 50 ? `上寄り ${50 - v}` : `下寄り ${v - 50}`)}
        />
        <Slider
          label="拡大"
          min={1}
          max={3}
          step={0.05}
          value={focus.zoom}
          onChange={(zoom) => onChange({ ...focus, zoom })}
          // ⚠ 拡大しすぎると画像が荒れる。数字だけでなく言葉でも伝える。
          format={(v) =>
            v <= 1.001 ? 'そのまま' : `${v.toFixed(2)}倍${v > 2 ? '（粗く見えることがあります）' : ''}`
          }
        />
      </div>

      <button
        type="button"
        className={s.reset}
        onClick={() => onChange({ ...DEFAULT_FOCUS })}
        disabled={focus.x === 50 && focus.y === 50 && focus.zoom === 1}
      >
        まん中・等倍に戻す
      </button>
    </div>
  );
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  format,
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
}) {
  return (
    <label className={s.slider}>
      <span className={s.sliderLabel}>
        {label}
        {/* ⚠ 現在値を数字だけで出さない。「まん中」「左寄り」と言葉でも出す。 */}
        <span className={s.sliderValue}>{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}
