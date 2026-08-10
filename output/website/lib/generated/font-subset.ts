// ⚠ 自動生成ファイル。手で編集しないこと。
// 生成元：scripts/build-font-subset.mjs（npm run dev / build の前に必ず走る）
// 生成日時は書かない（差分がノイズになるため）。

/** Shippori Mincho のサブセットURL。⚠ 収録字は下の SERIF_SUBSET_CHARS だけ。 */
export const SERIF_SUBSET_URL =
  'https://fonts.googleapis.com/css2?family=Shippori+Mincho&text=%E3%81%84%E3%81%8A%E3%81%8B%E3%81%8C%E3%81%8D%E3%81%91%E3%81%93%E3%81%99%E3%81%9B%E3%81%A7%E3%81%A8%E3%81%AA%E3%81%AB%E3%81%AE%E3%81%B6%E3%81%BE%E3%82%82%E3%82%89%E3%82%8B%E3%82%8C%E3%82%8D%E3%82%92%E5%87%BA%E5%8C%97%E5%8E%BB%E5%95%8F%E5%A0%B4%E5%A4%A7%E5%A6%84%E5%AD%A6%E5%B9%B8%E5%BD%A2%E5%BF%98%E6%83%B3%E6%89%80%E6%9C%80%E6%BA%A2%E7%94%9F%E7%B6%9A%E8%AA%B0%E9%81%8E%E9%87%8F&display=swap';

/** サブセットに収録されている文字（42字）。
 *  ⚠ この範囲外の文字に --font-serif を当てると、その文字だけ別書体になる。 */
export const SERIF_SUBSET_CHARS = 'いおかがきけこすせでとなにのぶまもらるれろを出北去問場大妄学幸形忘想所最溢生続誰過量';

/** 開発時の検査用。--font-serif を当てる文字列が範囲内か確かめる。 */
export function isCoveredBySerifSubset(s: string): boolean {
  return [...s].every((c) => SERIF_SUBSET_CHARS.includes(c));
}
