// ============================================================
// learning モジュール 公開API
//
// export する関数シグネチャは src/types.ts の契約に厳密に従うこと。
// ============================================================
import type { Category, CategoryStats, SrsEntry } from '../types';
import { applyAnswer, compareByReviewPriority } from './srs';
import type { PersistedProgressV1, ProgressStore } from './storage';
import { createInitialState, createLocalStorageStore } from './storage';
import { computeCategoryStats } from './stats';

/** learning モジュールの公開APIをまとめたインターフェース（テスト用ファクトリの戻り値型） */
export interface Learning {
  recordAnswer(questionId: string, category: Category, correct: boolean, now?: number): void;
  getDueEntries(now?: number): SrsEntry[];
  getStats(now?: number): CategoryStats[];
  resetProgress(): void;
  removeEntry(questionId: string): void;
}

/**
 * 任意の ProgressStore を注入して Learning インスタンスを作る factory 関数。
 * テストではインメモリストアを注入することで Date.now() や localStorage に依存せずに検証できる。
 */
export function createLearning(store: ProgressStore): Learning {
  function recordAnswer(
    questionId: string,
    category: Category,
    correct: boolean,
    now: number = Date.now(),
  ): void {
    const state = store.load();
    const existing = state.entries[questionId];
    const nextEntry = applyAnswer(existing, questionId, category, correct, now);

    const prevCounts = state.categoryCounts[category];
    const nextCategoryCounts = {
      ...state.categoryCounts,
      [category]: {
        total: prevCounts.total + 1,
        correct: prevCounts.correct + (correct ? 1 : 0),
      },
    };

    const nextState: PersistedProgressV1 = {
      ...state,
      entries: { ...state.entries, [questionId]: nextEntry },
      categoryCounts: nextCategoryCounts,
    };

    store.save(nextState);
  }

  function getDueEntries(now: number = Date.now()): SrsEntry[] {
    const state = store.load();
    return Object.values(state.entries)
      .filter((entry) => entry.dueAt <= now)
      .sort(compareByReviewPriority);
  }

  function getStats(now: number = Date.now()): CategoryStats[] {
    const state = store.load();
    return computeCategoryStats(state.categoryCounts, Object.values(state.entries), now);
  }

  function resetProgress(): void {
    store.save(createInitialState());
  }

  /**
   * 指定したquestionIdのSRSエントリを削除する。
   * 主な用途: buildQuestionFromIdで再構築不能になった「亡霊エントリ」の掃除
   * （データ定義変更などでIDが指す問題が存在しなくなった場合、削除しないと
   * 　getDueEntriesに永久にdueのまま残り続けてしまう）。存在しないIDは無視する。
   */
  function removeEntry(questionId: string): void {
    const state = store.load();
    if (!(questionId in state.entries)) {
      return;
    }

    const nextEntries = Object.fromEntries(
      Object.entries(state.entries).filter(([id]) => id !== questionId),
    );

    const nextState: PersistedProgressV1 = {
      ...state,
      entries: nextEntries,
    };

    store.save(nextState);
  }

  return { recordAnswer, getDueEntries, getStats, resetProgress, removeEntry };
}

// ------------------------------------------------------------
// デフォルトインスタンス（本番用: localStorage 永続化）
// ------------------------------------------------------------

let activeLearning: Learning = createLearning(createLocalStorageStore());

/**
 * テスト専用: デフォルトインスタンスが使う store を差し替える。
 * 本番コードから呼び出さないこと。
 */
export function _configureForTest(store: ProgressStore): void {
  activeLearning = createLearning(store);
}

export function recordAnswer(
  questionId: string,
  category: Category,
  correct: boolean,
  now?: number,
): void {
  activeLearning.recordAnswer(questionId, category, correct, now);
}

export function getDueEntries(now?: number): SrsEntry[] {
  return activeLearning.getDueEntries(now);
}

export function getStats(now?: number): CategoryStats[] {
  return activeLearning.getStats(now);
}

export function resetProgress(): void {
  activeLearning.resetProgress();
}

export function removeEntry(questionId: string): void {
  activeLearning.removeEntry(questionId);
}
