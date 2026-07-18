// ============================================================
// 進捗の永続化
//
// ProgressStore インターフェースを定義し、
// - localStorage 実装（本番用）
// - インメモリ実装（テスト用）
// を提供する。
// ============================================================
import type { Category, SrsEntry } from '../types';
import { CATEGORIES } from '../types';
import { MAX_BOX } from './srs';

/** カテゴリ別の累計回答数・正解数（SRSエントリとは独立して積算する） */
export interface CategoryCounts {
  readonly total: number;
  readonly correct: number;
}

/** localStorage に保存する永続状態のスキーマ（バージョン1） */
export interface PersistedProgressV1 {
  readonly version: 1;
  /** questionId をキーとしたSRSエントリの集合 */
  readonly entries: Readonly<Record<string, SrsEntry>>;
  readonly categoryCounts: Readonly<Record<Category, CategoryCounts>>;
}

export const STORAGE_KEY = 'poker-tsume:v1';

/** 進捗ストアの抽象インターフェース。localStorage実装とインメモリ実装が両方これに従う。 */
export interface ProgressStore {
  load(): PersistedProgressV1;
  save(state: PersistedProgressV1): void;
}

/** 初期状態（進捗なし）を生成する。 */
export function createInitialState(): PersistedProgressV1 {
  const categoryCounts = CATEGORIES.reduce<Record<Category, CategoryCounts>>(
    (acc, category) => {
      return { ...acc, [category]: { total: 0, correct: 0 } };
    },
    {} as Record<Category, CategoryCounts>,
  );

  return {
    version: 1,
    entries: {},
    categoryCounts,
  };
}

/** 0以上の整数か（NaN/Infinity/負数/非整数を弾く） */
function isNonNegativeInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

/** 0以上の有限数か（epoch ms 用。NaN/Infinity/負数を弾く） */
function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function isValidSrsEntry(value: unknown): value is SrsEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.questionId === 'string' &&
    typeof v.category === 'string' &&
    (CATEGORIES as readonly string[]).includes(v.category) &&
    isNonNegativeInt(v.box) &&
    v.box <= MAX_BOX &&
    isNonNegativeInt(v.wrongCount) &&
    isNonNegativeInt(v.correctStreak) &&
    isNonNegativeFinite(v.dueAt) &&
    isNonNegativeFinite(v.lastAnsweredAt)
  );
}

function isValidCategoryCounts(value: unknown): value is Record<Category, CategoryCounts> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return CATEGORIES.every((category) => {
    const entry = v[category];
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }
    const e = entry as Record<string, unknown>;
    return isNonNegativeInt(e.total) && isNonNegativeInt(e.correct) && e.correct <= e.total;
  });
}

/** 読み込んだ生JSONがスキーマに一致するかを検証する（壊れたデータからの回復に使う）。 */
function isValidPersistedState(value: unknown): value is PersistedProgressV1 {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (v.version !== 1) {
    return false;
  }
  if (typeof v.entries !== 'object' || v.entries === null) {
    return false;
  }
  const entriesOk = Object.values(v.entries as Record<string, unknown>).every(isValidSrsEntry);
  if (!entriesOk) {
    return false;
  }
  return isValidCategoryCounts(v.categoryCounts);
}

/**
 * localStorage を使った ProgressStore 実装。
 * - localStorage が使えない環境（SecurityErrorなど）や容量超過は catch して
 *   console.warn の上でインメモリ動作にフォールバックする（クラッシュさせない）。
 * - 壊れたJSON・スキーマ不一致は console.warn の上で初期状態から開始する。
 */
export function createLocalStorageStore(): ProgressStore {
  // セッション内キャッシュ兼インメモリフォールバック。
  // save() のたびに必ず最新状態へ更新することで、localStorage への書き込みが
  // 一時的に失敗→後で成功した場合でも load() が古い状態を返さないことを保証する。
  let memoryFallback: PersistedProgressV1 | null = null;

  function safeGetLocalStorage(): Storage | null {
    try {
      if (typeof window === 'undefined' || !window.localStorage) {
        return null;
      }
      return window.localStorage;
    } catch (error) {
      console.warn(
        '[learning/storage] localStorage にアクセスできないため、インメモリ動作にフォールバックします',
        error,
      );
      return null;
    }
  }

  return {
    load(): PersistedProgressV1 {
      if (memoryFallback !== null) {
        return memoryFallback;
      }

      const ls = safeGetLocalStorage();
      if (ls === null) {
        memoryFallback = createInitialState();
        return memoryFallback;
      }

      try {
        const raw = ls.getItem(STORAGE_KEY);
        if (raw === null) {
          return createInitialState();
        }
        const parsed: unknown = JSON.parse(raw);
        if (!isValidPersistedState(parsed)) {
          console.warn(
            '[learning/storage] 保存データのスキーマが不正なため、初期状態から開始します',
            parsed,
          );
          return createInitialState();
        }
        return parsed;
      } catch (error) {
        console.warn(
          '[learning/storage] 保存データの読み込みに失敗したため、初期状態から開始します',
          error,
        );
        return createInitialState();
      }
    },

    save(state: PersistedProgressV1): void {
      // 書き込みの成否にかかわらずセッション内キャッシュは常に最新へ更新する
      // （成功時に更新しないと、過去の書き込み失敗でセットされた古い状態を
      //   load() が返し続け、進捗が静かに巻き戻るバグになる）
      memoryFallback = state;

      const ls = safeGetLocalStorage();
      if (ls === null) {
        return;
      }

      try {
        ls.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch (error) {
        console.warn(
          '[learning/storage] localStorage への保存に失敗しました（容量超過などの可能性）。セッション内では動作を継続しますが、リロードすると失われる可能性があります',
          error,
        );
      }
    },
  };
}

/** テスト用のインメモリ ProgressStore 実装。localStorage に一切触れない。 */
export function createMemoryStore(initial?: PersistedProgressV1): ProgressStore {
  let state: PersistedProgressV1 = initial ?? createInitialState();

  return {
    load(): PersistedProgressV1 {
      return state;
    },
    save(next: PersistedProgressV1): void {
      state = next;
    },
  };
}
