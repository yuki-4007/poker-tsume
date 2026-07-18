// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

// CATEGORY_LABELS に危険文字列が混入した場合でもUI層が正しくエスケープすることを
// 確認するための回帰テスト（home.test.tsと同様の意図）。
vi.mock('../../types', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../types')>();
  return {
    ...actual,
    CATEGORY_LABELS: {
      preflop: '<script>alert(1)</script>',
      odds: '"onmouseover=alert(1) x="',
      pushfold: actual.CATEGORY_LABELS.pushfold,
    },
  };
});

import { _configureForTest, recordAnswer } from '../../learning';
import { createMemoryStore } from '../../learning/storage';
import { CATEGORY_LABELS } from '../../types';
import { renderStats } from './stats';

const NOW = 1_700_000_000_000;

function findStatsRow(root: HTMLElement, label: string): Element | undefined {
  return Array.from(root.querySelectorAll('.stats-row')).find((row) =>
    row.textContent?.includes(label),
  );
}

describe('renderStats のHTMLエスケープ', () => {
  afterEach(() => {
    _configureForTest(createMemoryStore());
    vi.restoreAllMocks();
  });

  it('CATEGORY_LABELSに危険文字列が含まれてもscript要素として解釈されず、属性注入も起きない', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderStats(root);

    // Assert
    expect(root.querySelector('script')).toBeNull();
    // クォートがエスケープされているため、実DOM上のどの要素にもonmouseover属性が注入されない
    const hasInjectedAttribute = Array.from(root.querySelectorAll('*')).some((el) =>
      el.hasAttribute('onmouseover'),
    );
    expect(hasInjectedAttribute).toBe(false);
    expect(root.textContent).toContain('<script>alert(1)</script>');
    expect(root.textContent).toContain('"onmouseover=alert(1) x="');
  });

  it('カテゴリ数ぶんの成績行とリセットボタンが描画される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderStats(root);

    // Assert
    expect(root.querySelectorAll('.stats-row')).toHaveLength(3);
    expect(root.querySelector('.reset-button')).not.toBeNull();
  });

  it('累計回答数が3未満のカテゴリは「正答率0%」ではなく「学習中」と表示され、バーは描画されない', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    recordAnswer('pushfold:test:1', 'pushfold', false, NOW);
    const root = document.createElement('div');

    // Act
    renderStats(root);

    // Assert
    const row = findStatsRow(root, CATEGORY_LABELS.pushfold);
    expect(row?.querySelector('.stats-row__accuracy')?.textContent).toBe('学習中');
    expect(row?.querySelector('.stats-bar')).toBeNull();
  });

  it('累計回答数が3以上のカテゴリは正答率%とバーが表示される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    recordAnswer('pushfold:test:1', 'pushfold', true, NOW);
    recordAnswer('pushfold:test:2', 'pushfold', true, NOW);
    recordAnswer('pushfold:test:3', 'pushfold', true, NOW);
    const root = document.createElement('div');

    // Act
    renderStats(root);

    // Assert
    const row = findStatsRow(root, CATEGORY_LABELS.pushfold);
    expect(row?.querySelector('.stats-row__accuracy')?.textContent).toBe('100%');
    expect(row?.querySelector('.stats-bar')).not.toBeNull();
  });
});
