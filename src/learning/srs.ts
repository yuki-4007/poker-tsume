// ============================================================
// Leitner方式の間隔反復（SRS）ロジック
//
// すべて純粋関数。状態を受け取り、新しい状態を返す（ミューテーション禁止）。
// ============================================================
import type { Category, SrsEntry } from '../types';

/** ボックス番号の最大値（0が最頻出、5が最も間隔が長い） */
export const MAX_BOX = 5;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * ボックス番号(0..5)ごとの復習間隔（ミリ秒）。
 * index = box番号。box0は「即時再出題」を意味する。
 */
export const BOX_INTERVALS_MS: readonly number[] = [
  0,
  10 * MINUTE_MS,
  1 * HOUR_MS,
  1 * DAY_MS,
  3 * DAY_MS,
  7 * DAY_MS,
];

/** box番号に対応する復習間隔を取得する。範囲外は例外を投げる（ロジックの不整合を早期検知するため）。 */
function getIntervalMsForBox(box: number): number {
  const interval = BOX_INTERVALS_MS[box];
  if (interval === undefined) {
    throw new Error(`不正なボックス番号です: ${box}`);
  }
  return interval;
}

/**
 * 回答結果を1件のSRSエントリに適用し、新しいエントリを返す（純粋関数）。
 *
 * - 正解: box+1（上限 MAX_BOX）、dueAt = now + 新boxの間隔、correctStreak+1
 * - 不正解: box=0、dueAt = now（即時再出題対象）、wrongCount+1、correctStreak=0
 * - 初回回答（existingがundefined）も同じルールで扱う（currentBox=0として計算）
 */
export function applyAnswer(
  existing: SrsEntry | undefined,
  questionId: string,
  category: Category,
  correct: boolean,
  now: number,
): SrsEntry {
  const currentBox = existing?.box ?? 0;
  const wrongCount = existing?.wrongCount ?? 0;
  const correctStreak = existing?.correctStreak ?? 0;

  if (correct) {
    const nextBox = Math.min(currentBox + 1, MAX_BOX);
    return {
      questionId,
      category,
      box: nextBox,
      wrongCount,
      correctStreak: correctStreak + 1,
      dueAt: now + getIntervalMsForBox(nextBox),
      lastAnsweredAt: now,
    };
  }

  return {
    questionId,
    category,
    box: 0,
    wrongCount: wrongCount + 1,
    correctStreak: 0,
    dueAt: now,
    lastAnsweredAt: now,
  };
}

/**
 * 復習優先度による比較関数（Array.prototype.sort に渡す用途）。
 * box昇順（頻出のものを先に）、同boxならdueAt昇順（古いものを先に）。
 */
export function compareByReviewPriority(a: SrsEntry, b: SrsEntry): number {
  if (a.box !== b.box) {
    return a.box - b.box;
  }
  return a.dueAt - b.dueAt;
}
