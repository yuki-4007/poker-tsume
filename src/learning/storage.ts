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

/**
 * SRSエントリの「形」を検証する（categoryの値がCATEGORIESに含まれるかどうかは問わない）。
 *
 * category の受理範囲チェックをここで行わないのは、カテゴリ体系が変化した場合
 * （例: 3→5カテゴリ拡張、将来的なカテゴリ削除）に、そのエントリ1件だけを
 * 読み捨てて残りの進捗を保持できるようにするため。数値レンジなど他のフィールドが
 * 壊れている場合は、データ全体の信頼性が疑わしいためスキーマ不正として扱う。
 */
function isValidSrsEntryShape(value: unknown): value is RawSrsEntry {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.questionId === 'string' &&
    typeof v.category === 'string' &&
    isNonNegativeInt(v.box) &&
    v.box <= MAX_BOX &&
    isNonNegativeInt(v.wrongCount) &&
    isNonNegativeInt(v.correctStreak) &&
    isNonNegativeFinite(v.dueAt) &&
    isNonNegativeFinite(v.lastAnsweredAt)
  );
}

/** JSONから読み込んだ直後のSRSエントリ。category はまだ Category に絞り込まれていない生の文字列。 */
interface RawSrsEntry {
  readonly questionId: string;
  readonly category: string;
  readonly box: number;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly dueAt: number;
  readonly lastAnsweredAt: number;
}

/**
 * カテゴリ別集計を検証する。既知カテゴリ（CATEGORIES）のキーが存在すればその値の
 * 妥当性を厳密にチェックし、存在しない既知カテゴリは許容する（load時に0埋めで補完する）。
 * CATEGORIES にない未知のキーは無視する（検証対象にしない）。
 */
function isValidCategoryCountsPartial(
  value: unknown,
): value is Readonly<Partial<Record<Category, CategoryCounts>>> {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return CATEGORIES.every((category) => {
    if (!(category in v)) {
      return true;
    }
    const entry = v[category];
    if (typeof entry !== 'object' || entry === null) {
      return false;
    }
    const e = entry as Record<string, unknown>;
    return isNonNegativeInt(e.total) && isNonNegativeInt(e.correct) && e.correct <= e.total;
  });
}

/** isValidPersistedState を通過した直後の、まだ正規化前の生の永続状態。 */
interface RawPersistedState {
  readonly version: 1;
  readonly entries: Readonly<Record<string, RawSrsEntry>>;
  readonly categoryCounts: Readonly<Partial<Record<Category, CategoryCounts>>>;
}

/** 読み込んだ生JSONがスキーマに一致するかを検証する（壊れたデータからの回復に使う）。 */
function isValidPersistedState(value: unknown): value is RawPersistedState {
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
  const entriesOk = Object.values(v.entries as Record<string, unknown>).every(
    isValidSrsEntryShape,
  );
  if (!entriesOk) {
    return false;
  }
  return isValidCategoryCountsPartial(v.categoryCounts);
}

/**
 * 検証済みの生エントリ集合から、カテゴリ体系の変更に追従できない
 * （現在の CATEGORIES に存在しないカテゴリを指す）エントリを読み捨てて正規化する。
 * 該当エントリがある場合は console.warn で通知する（無言で消さない）。
 */
function normalizeEntries(rawEntries: Readonly<Record<string, RawSrsEntry>>): Record<string, SrsEntry> {
  const result: Record<string, SrsEntry> = {};
  for (const [questionId, entry] of Object.entries(rawEntries)) {
    if (!(CATEGORIES as readonly string[]).includes(entry.category)) {
      console.warn(
        `[learning/storage] 不明なカテゴリのSRSエントリを読み捨てます: questionId=${questionId}, category=${entry.category}`,
      );
      continue;
    }
    result[questionId] = { ...entry, category: entry.category as Category };
  }
  return result;
}

/**
 * 検証済みのカテゴリ別集計から、現行の CATEGORIES 全件を持つ完全な集計へ正規化する。
 * 保存データに存在しないカテゴリ（例: 3カテゴリ時代のデータに存在しない新カテゴリ）は
 * {total: 0, correct: 0} で補完する。これにより、カテゴリ拡張前の旧データを読み込んでも
 * 進捗が消去されずに引き継がれる。
 */
function normalizeCategoryCounts(
  raw: Readonly<Partial<Record<Category, CategoryCounts>>>,
): Record<Category, CategoryCounts> {
  return CATEGORIES.reduce<Record<Category, CategoryCounts>>((acc, category) => {
    return { ...acc, [category]: raw[category] ?? { total: 0, correct: 0 } };
  }, {} as Record<Category, CategoryCounts>);
}

/** 検証済みの生状態を、現行スキーマ（全カテゴリ0埋め済み）の状態へ正規化する。 */
function normalizeState(raw: RawPersistedState): PersistedProgressV1 {
  return {
    version: 1,
    entries: normalizeEntries(raw.entries),
    categoryCounts: normalizeCategoryCounts(raw.categoryCounts),
  };
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
        // 既知カテゴリの欠落（旧カテゴリ体系からの移行）を0埋めで補完し、
        // 現行の CATEGORIES に存在しないカテゴリのエントリを読み捨てて正規化する。
        return normalizeState(parsed);
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
