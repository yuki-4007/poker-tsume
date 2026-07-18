// 少数サンプル時の正答率表示ロジック（home.ts / stats.ts 共通）。
// 累計回答数が少ないカテゴリで「正答率0%」のような誤解を招く表示を避けるための共通ユーティリティ。

/** この回答数未満のカテゴリは正答率を数値表示せず「学習中」として扱う。 */
export const MIN_SAMPLE_FOR_ACCURACY = 3;

export type AccuracyDisplay =
  | { readonly kind: 'none' }
  | { readonly kind: 'learning' }
  | { readonly kind: 'measured'; readonly percent: number };

/** 累計回答数と正答率(0-1)から、表示すべき正答率の状態を判定する（純粋関数）。 */
export function describeAccuracy(total: number, accuracy: number): AccuracyDisplay {
  if (total === 0) {
    return { kind: 'none' };
  }
  if (total < MIN_SAMPLE_FOR_ACCURACY) {
    return { kind: 'learning' };
  }
  return { kind: 'measured', percent: Math.round(accuracy * 100) };
}
