// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';

// CATEGORY_LABELS に危険文字列が混入した場合でもUI層が正しくエスケープすることを
// 確認するための回帰テスト（現在CATEGORY_LABELSは定数だが、将来外部化・多言語化
// されても安全であることを保証する）。
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
import { renderHome } from './home';

const NOW = 1_700_000_000_000;

function findCategoryCard(root: HTMLElement, label: string): Element | undefined {
  return Array.from(root.querySelectorAll('.category-card')).find((card) =>
    card.textContent?.includes(label),
  );
}

describe('renderHome のHTMLエスケープ', () => {
  afterEach(() => {
    _configureForTest(createMemoryStore());
    vi.restoreAllMocks();
  });

  it('CATEGORY_LABELSに危険文字列が含まれてもscript要素として解釈されず、属性注入も起きない', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    expect(root.querySelector('script')).toBeNull();
    // クォートがエスケープされているため、実DOM上のどの要素にもonmouseover属性が注入されない
    const hasInjectedAttribute = Array.from(root.querySelectorAll('*')).some((el) =>
      el.hasAttribute('onmouseover'),
    );
    expect(hasInjectedAttribute).toBe(false);
    // エスケープされたテキストとして表示されている（=描画自体は行われている）
    expect(root.textContent).toContain('<script>alert(1)</script>');
    expect(root.textContent).toContain('"onmouseover=alert(1) x="');
  });

  it('通常のカテゴリカードとミックス出題への導線が描画される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    expect(root.querySelectorAll('.category-card')).toHaveLength(3);
    expect(root.querySelector('.mixed-card')).not.toBeNull();
    expect(root.querySelector('.stats-link')).not.toBeNull();
  });

  it('未回答のカテゴリは「未挑戦」と表示される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    const card = findCategoryCard(root, CATEGORY_LABELS.pushfold);
    expect(card?.querySelector('.category-card__accuracy')?.textContent).toBe('未挑戦');
  });

  it('累計回答数が3未満のカテゴリは「正答率0%」ではなく「学習中」と表示される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    recordAnswer('pushfold:test:1', 'pushfold', false, NOW);
    recordAnswer('pushfold:test:2', 'pushfold', false, NOW);
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    const card = findCategoryCard(root, CATEGORY_LABELS.pushfold);
    expect(card?.querySelector('.category-card__accuracy')?.textContent).toBe('学習中');
  });

  it('累計回答数が3以上のカテゴリは正答率が%で表示される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    recordAnswer('pushfold:test:1', 'pushfold', true, NOW);
    recordAnswer('pushfold:test:2', 'pushfold', true, NOW);
    recordAnswer('pushfold:test:3', 'pushfold', false, NOW);
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    const card = findCategoryCard(root, CATEGORY_LABELS.pushfold);
    expect(card?.querySelector('.category-card__accuracy')?.textContent).toBe('正答率 67%');
  });

  it('復習期限到来問題があるとき、ヒント文が表示される', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    recordAnswer('pushfold:test:1', 'pushfold', false, NOW);
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    expect(root.querySelector('.due-alert')).not.toBeNull();
    expect(root.querySelector('.due-alert-hint')?.textContent).toContain(
      '間違えた問題は少し時間を置いて再出題されます',
    );
  });

  it('復習期限到来問題がないとき、ヒント文は表示されない', () => {
    // Arrange
    _configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderHome(root);

    // Assert
    expect(root.querySelector('.due-alert-hint')).toBeNull();
  });
});
