import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createInitialState,
  createLocalStorageStore,
  createMemoryStore,
  STORAGE_KEY,
} from './storage';

/** テスト用の最小 localStorage 実装 */
class FakeLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

describe('createMemoryStore', () => {
  it('保存した状態をそのまま読み込める（ラウンドトリップ）', () => {
    // Arrange
    const store = createMemoryStore();
    const state = {
      ...createInitialState(),
      entries: {
        q1: {
          questionId: 'q1',
          category: 'preflop' as const,
          box: 2,
          wrongCount: 1,
          correctStreak: 2,
          dueAt: 123,
          lastAnsweredAt: 100,
        },
      },
    };

    // Act
    store.save(state);
    const loaded = store.load();

    // Assert
    expect(loaded).toEqual(state);
  });

  it('初期状態は全カテゴリが0埋めされている', () => {
    // Arrange & Act
    const store = createMemoryStore();
    const loaded = store.load();

    // Assert
    expect(loaded.entries).toEqual({});
    expect(loaded.categoryCounts.preflop).toEqual({ total: 0, correct: 0 });
    expect(loaded.categoryCounts.odds).toEqual({ total: 0, correct: 0 });
    expect(loaded.categoryCounts.pushfold).toEqual({ total: 0, correct: 0 });
  });
});

describe('createLocalStorageStore', () => {
  const originalWindow = (globalThis as { window?: unknown }).window;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (originalWindow === undefined) {
      delete (globalThis as { window?: unknown }).window;
    } else {
      (globalThis as { window?: unknown }).window = originalWindow;
    }
  });

  it('windowが存在しない環境ではconsole.warnの上でインメモリ動作にフォールバックする', () => {
    // Arrange: vitestのデフォルト(node環境)ではwindowが存在しない
    delete (globalThis as { window?: unknown }).window;
    const store = createLocalStorageStore();

    // Act
    const loaded = store.load();

    // Assert: クラッシュせず初期状態が返る
    expect(loaded.entries).toEqual({});
    expect(loaded.version).toBe(1);
  });

  it('windowが存在しない環境でもsave()がクラッシュしない', () => {
    // Arrange
    delete (globalThis as { window?: unknown }).window;
    const store = createLocalStorageStore();
    const state = createInitialState();

    // Act & Assert
    expect(() => store.save(state)).not.toThrow();
  });

  it('保存→読込のラウンドトリップが成立する', () => {
    // Arrange
    (globalThis as { window?: unknown }).window = { localStorage: new FakeLocalStorage() };
    const store = createLocalStorageStore();
    const state = {
      ...createInitialState(),
      categoryCounts: {
        ...createInitialState().categoryCounts,
        preflop: { total: 5, correct: 4 },
      },
    };

    // Act
    store.save(state);
    const loaded = store.load();

    // Assert
    expect(loaded).toEqual(state);
  });

  it('壊れたJSONが保存されている場合はconsole.warnの上で初期状態から開始する', () => {
    // Arrange
    const fakeLs = new FakeLocalStorage();
    fakeLs.setItem(STORAGE_KEY, '{invalid json,,,');
    (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
    const store = createLocalStorageStore();

    // Act
    const loaded = store.load();

    // Assert
    expect(loaded.entries).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
  });

  it('スキーマが一致しないデータの場合はconsole.warnの上で初期状態から開始する', () => {
    // Arrange
    const fakeLs = new FakeLocalStorage();
    fakeLs.setItem(STORAGE_KEY, JSON.stringify({ foo: 'bar' }));
    (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
    const store = createLocalStorageStore();

    // Act
    const loaded = store.load();

    // Assert
    expect(loaded.entries).toEqual({});
    expect(warnSpy).toHaveBeenCalled();
  });

  it('setItemが失敗する場合（容量超過など）はconsole.warnの上でインメモリにフォールバックする', () => {
    // Arrange
    const fakeLs = new FakeLocalStorage();
    vi.spyOn(fakeLs, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
    const store = createLocalStorageStore();
    const state = { ...createInitialState(), categoryCounts: createInitialState().categoryCounts };

    // Act
    store.save(state);
    const loaded = store.load();

    // Assert: 保存は失敗したがインメモリにフォールバックされているので読み込める
    expect(loaded).toEqual(state);
    expect(warnSpy).toHaveBeenCalled();
  });

  it('setItemが一度失敗した後に成功しても、load()は常に最後にsaveした状態を返す（陳腐化バグの回帰テスト）', () => {
    // Arrange: 1回目の書き込みだけ失敗し、2回目以降は成功する localStorage
    const fakeLs = new FakeLocalStorage();
    const setItemSpy = vi.spyOn(fakeLs, 'setItem').mockImplementationOnce(() => {
      throw new DOMException('QuotaExceededError');
    });
    (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
    const store = createLocalStorageStore();
    const stateA = {
      ...createInitialState(),
      categoryCounts: {
        ...createInitialState().categoryCounts,
        preflop: { total: 1, correct: 1 },
      },
    };
    const stateB = {
      ...createInitialState(),
      categoryCounts: {
        ...createInitialState().categoryCounts,
        preflop: { total: 2, correct: 2 },
      },
    };

    // Act: 1回目失敗 → 2回目成功
    store.save(stateA);
    store.save(stateB);
    const loaded = store.load();

    // Assert: 古い stateA ではなく、最後に保存した stateB が返る
    expect(loaded).toEqual(stateB);
    expect(setItemSpy).toHaveBeenCalledTimes(2);
  });

  it('数値範囲が不正なSRSエントリ（box超過・Infinity・負数）はスキーマ不正として初期状態から開始する', () => {
    // Arrange
    const brokenStates = [
      // box が上限超過
      { box: 99, wrongCount: 0, correctStreak: 0, dueAt: 0, lastAnsweredAt: 0 },
      // dueAt が Infinity（JSON.parse('1e400') 相当）
      { box: 1, wrongCount: 0, correctStreak: 0, dueAt: Infinity, lastAnsweredAt: 0 },
      // wrongCount が負数
      { box: 1, wrongCount: -1, correctStreak: 0, dueAt: 0, lastAnsweredAt: 0 },
    ];

    for (const brokenEntry of brokenStates) {
      const fakeLs = new FakeLocalStorage();
      fakeLs.setItem(
        STORAGE_KEY,
        // Infinity は JSON.stringify で null になるため、文字列を直接組み立てる
        `{"version":1,"entries":{"q1":{"questionId":"q1","category":"preflop","box":${brokenEntry.box},"wrongCount":${brokenEntry.wrongCount},"correctStreak":${brokenEntry.correctStreak},"dueAt":${brokenEntry.dueAt === Infinity ? '1e400' : brokenEntry.dueAt},"lastAnsweredAt":${brokenEntry.lastAnsweredAt}}},"categoryCounts":{"preflop":{"total":0,"correct":0},"odds":{"total":0,"correct":0},"pushfold":{"total":0,"correct":0}}}`,
      );
      (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
      const store = createLocalStorageStore();

      // Act
      const loaded = store.load();

      // Assert
      expect(loaded.entries, JSON.stringify(brokenEntry)).toEqual({});
      expect(warnSpy).toHaveBeenCalled();
    }
  });

  it('correct が total を超えるカテゴリ集計はスキーマ不正として初期状態から開始する', () => {
    // Arrange
    const fakeLs = new FakeLocalStorage();
    const broken = {
      ...createInitialState(),
      categoryCounts: {
        ...createInitialState().categoryCounts,
        odds: { total: 1, correct: 5 },
      },
    };
    fakeLs.setItem(STORAGE_KEY, JSON.stringify(broken));
    (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
    const store = createLocalStorageStore();

    // Act
    const loaded = store.load();

    // Assert
    expect(loaded.categoryCounts.odds).toEqual({ total: 0, correct: 0 });
    expect(warnSpy).toHaveBeenCalled();
  });

  describe('カテゴリ拡張（3→5カテゴリ）への移行', () => {
    it('3カテゴリ時代のcategoryCountsを読み込むと、新カテゴリが0埋めで補完され、既存の集計は保持される', () => {
      // Arrange: 3カテゴリ（preflop/odds/pushfold）しか存在しない旧データ形式を模す
      const fakeLs = new FakeLocalStorage();
      const legacyState = {
        version: 1,
        entries: {},
        categoryCounts: {
          preflop: { total: 12, correct: 9 },
          odds: { total: 5, correct: 3 },
          pushfold: { total: 20, correct: 15 },
          // outscount / betsize のキー自体が存在しない（3カテゴリ時代のため）
        },
      };
      fakeLs.setItem(STORAGE_KEY, JSON.stringify(legacyState));
      (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
      const store = createLocalStorageStore();

      // Act
      const loaded = store.load();

      // Assert: 旧データは保持され、新カテゴリは0埋めで補完される（スキーマ不正扱いされない）
      expect(loaded.categoryCounts.preflop).toEqual({ total: 12, correct: 9 });
      expect(loaded.categoryCounts.odds).toEqual({ total: 5, correct: 3 });
      expect(loaded.categoryCounts.pushfold).toEqual({ total: 20, correct: 15 });
      expect(loaded.categoryCounts.outscount).toEqual({ total: 0, correct: 0 });
      expect(loaded.categoryCounts.betsize).toEqual({ total: 0, correct: 0 });
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('3カテゴリ時代のSRSエントリ（新カテゴリのキーを持たないentries）も、クラッシュせず読み込める', () => {
      // Arrange
      const fakeLs = new FakeLocalStorage();
      const legacyState = {
        version: 1,
        entries: {
          'preflop:BTN:AKs': {
            questionId: 'preflop:BTN:AKs',
            category: 'preflop',
            box: 2,
            wrongCount: 1,
            correctStreak: 3,
            dueAt: 1_700_000_000_000,
            lastAnsweredAt: 1_699_999_000_000,
          },
        },
        categoryCounts: {
          preflop: { total: 4, correct: 3 },
          odds: { total: 0, correct: 0 },
          pushfold: { total: 0, correct: 0 },
        },
      };
      fakeLs.setItem(STORAGE_KEY, JSON.stringify(legacyState));
      (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
      const store = createLocalStorageStore();

      // Act
      const loaded = store.load();

      // Assert: 旧SRSエントリがそのまま保持され、全カテゴリが0埋めで揃っている
      expect(loaded.entries['preflop:BTN:AKs']).toEqual(legacyState.entries['preflop:BTN:AKs']);
      expect(loaded.categoryCounts.outscount).toEqual({ total: 0, correct: 0 });
      expect(loaded.categoryCounts.betsize).toEqual({ total: 0, correct: 0 });
    });

    it('現行CATEGORIESに存在しないカテゴリのSRSエントリは、console.warnの上で読み捨てられる（他のエントリは保持される）', () => {
      // Arrange: 将来カテゴリが削除された場合を模した「亡霊カテゴリ」エントリ
      const fakeLs = new FakeLocalStorage();
      const stateWithGhostCategory = {
        version: 1,
        entries: {
          'preflop:BTN:AKs': {
            questionId: 'preflop:BTN:AKs',
            category: 'preflop',
            box: 1,
            wrongCount: 0,
            correctStreak: 1,
            dueAt: 0,
            lastAnsweredAt: 0,
          },
          'oldcat:ghost:1': {
            questionId: 'oldcat:ghost:1',
            category: 'oldcat', // CATEGORIESに存在しない
            box: 0,
            wrongCount: 1,
            correctStreak: 0,
            dueAt: 0,
            lastAnsweredAt: 0,
          },
        },
        categoryCounts: createInitialState().categoryCounts,
      };
      fakeLs.setItem(STORAGE_KEY, JSON.stringify(stateWithGhostCategory));
      (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
      const store = createLocalStorageStore();

      // Act
      const loaded = store.load();

      // Assert: 不明カテゴリのエントリだけが読み捨てられ、正常なエントリは残る
      expect(loaded.entries['preflop:BTN:AKs']).toBeDefined();
      expect(loaded.entries['oldcat:ghost:1']).toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });

    it('未知のカテゴリキーを含むcategoryCountsは、既知カテゴリのみ受理し未知キーは無視する', () => {
      // Arrange
      const fakeLs = new FakeLocalStorage();
      const stateWithUnknownCategoryKey = {
        version: 1,
        entries: {},
        categoryCounts: {
          ...createInitialState().categoryCounts,
          preflop: { total: 3, correct: 2 },
          oldcat: { total: 100, correct: 100 }, // CATEGORIESに存在しないキー
        },
      };
      fakeLs.setItem(STORAGE_KEY, JSON.stringify(stateWithUnknownCategoryKey));
      (globalThis as { window?: unknown }).window = { localStorage: fakeLs };
      const store = createLocalStorageStore();

      // Act
      const loaded = store.load();

      // Assert: 既知カテゴリの値は保持され、未知キーはスキーマ不正扱いにもならず単に無視される
      expect(loaded.categoryCounts.preflop).toEqual({ total: 3, correct: 2 });
      expect((loaded.categoryCounts as Record<string, unknown>).oldcat).toBeUndefined();
    });
  });
});
