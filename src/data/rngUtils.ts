// ============================================================
// 乱数まわりの共通ユーティリティ
//
// rng は [0,1) を返す関数を想定する（テスト時に固定できるよう
// Math.random() を直接呼ばず、必ず引数で受け取る）。
// ============================================================

/** 学習効果のため「レンジ境界付近」を出やすくする既定の重み。 */
export const DEFAULT_BOUNDARY_WEIGHT = 0.6;

/** 配列から rng に基づいて1件を選ぶ。空配列は throw。 */
export function pickRandom<T>(items: readonly T[], rng: () => number): T {
  if (items.length === 0) {
    throw new Error('空の配列からは選択できません');
  }
  const idx = Math.min(items.length - 1, Math.max(0, Math.floor(rng() * items.length)));
  const item = items[idx];
  if (item === undefined) {
    throw new Error('乱数による選択に失敗しました（内部エラー）');
  }
  return item;
}

/**
 * 境界重視サンプリング。boundaryWeight の確率で boundaryPool から、
 * それ以外は fullPool から選ぶ。boundaryPool が空なら常に fullPool から選ぶ。
 *
 * 注意: 非境界側（1 - boundaryWeight の確率）で選ぶ fullPool には境界要素も
 * そのまま含まれているため、境界要素はそちらでも再度当選しうる。そのため
 * 実際に境界要素が選ばれる実効確率は、名目上の boundaryWeight（既定60%）
 * よりも高くなる（fullPool 中の境界要素の割合ぶん上乗せされる）。
 */
export function pickWeighted<T>(
  fullPool: readonly T[],
  boundaryPool: readonly T[],
  boundaryWeight: number,
  rng: () => number,
): T {
  const useBoundary = boundaryPool.length > 0 && rng() < boundaryWeight;
  return pickRandom(useBoundary ? boundaryPool : fullPool, rng);
}
