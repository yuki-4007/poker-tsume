// ============================================================
// カテゴリ別統計の集計
// ============================================================
import type { Category, CategoryStats, SrsEntry } from '../types';
import { CATEGORIES } from '../types';
import type { CategoryCounts } from './storage';

/**
 * カテゴリ別の累計回答数・正解数と、現在のSRSエントリ一覧から
 * カテゴリごとの CategoryStats を集計する（純粋関数）。
 * CATEGORIES に含まれる全カテゴリを必ず返す（未回答カテゴリは0埋め）。
 */
export function computeCategoryStats(
  categoryCounts: Readonly<Record<Category, CategoryCounts>>,
  entries: readonly SrsEntry[],
  now: number,
): CategoryStats[] {
  return CATEGORIES.map((category) => {
    const counts = categoryCounts[category];
    const total = counts.total;
    const correct = counts.correct;
    const dueCount = entries.filter(
      (entry) => entry.category === category && entry.dueAt <= now,
    ).length;

    return {
      category,
      total,
      correct,
      accuracy: total === 0 ? 0 : correct / total,
      dueCount,
    };
  });
}
