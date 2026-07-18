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
});
