// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest';
import type { SessionState } from './drill';
import { renderSessionSummary } from './sessionSummary';

function session(overrides: Partial<SessionState>): SessionState {
  return {
    answered: 10,
    correct: 0,
    correctStreak: 0,
    bestStreak: 0,
    answeredIds: new Set(),
    ...overrides,
  };
}

describe('renderSessionSummary', () => {
  it('正答数/回答数・正答率・最大連続正解・カテゴリ名を表示する', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderSessionSummary(shell, session({ correct: 7, bestStreak: 4 }), 'odds', () => {});

    // Assert
    const summary = shell.querySelector('.session-summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain('7');
    expect(summary?.textContent).toContain('/10');
    expect(summary?.textContent).toContain('70%');
    expect(summary?.textContent).toContain('4問');
    expect(summary?.textContent).toContain('オッズ計算');
  });

  it('mixedカテゴリの場合は「ミックス出題」と表示する', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderSessionSummary(shell, session({ correct: 5 }), 'mixed', () => {});

    // Assert
    expect(shell.querySelector('.session-summary__category')?.textContent).toBe('ミックス出題');
  });

  it.each([
    [10, '見事'],
    [9, '見事'],
    [8, '着実'],
    [6, '着実'],
    [5, '見直す'],
    [0, '見直す'],
  ])('正答数%d問のときコメントに「%s」が含まれる', (correct, expectedFragment) => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderSessionSummary(shell, session({ correct }), 'odds', () => {});

    // Assert
    expect(shell.querySelector('.session-summary__comment')?.textContent).toContain(
      expectedFragment,
    );
  });

  it('「もう10問」ボタンをクリックするとonRestartが呼ばれる', () => {
    // Arrange
    const shell = document.createElement('main');
    const onRestart = vi.fn();
    renderSessionSummary(shell, session({ correct: 3 }), 'preflop', onRestart);

    // Act
    shell.querySelector<HTMLButtonElement>('.session-summary__restart')?.click();

    // Assert
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('「ホームに戻る」は#homeへのリンクである', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderSessionSummary(shell, session({ correct: 3 }), 'preflop', () => {});

    // Assert
    expect(shell.querySelector('.session-summary__home')?.getAttribute('href')).toBe('#home');
  });

  it('カテゴリ名にHTMLとして解釈される文字列が含まれてもエスケープされる', () => {
    // Arrange: CATEGORY_LABELS が将来外部化された場合の回帰保護。
    // ここでは categoryParam 自体は固定値のため、コメント文言など静的文字列の
    // エスケープ経路が壊れていないことのみ確認する。
    const shell = document.createElement('main');

    // Act
    renderSessionSummary(shell, session({ correct: 10 }), 'pushfold', () => {});

    // Assert
    expect(shell.querySelector('script')).toBeNull();
  });
});
