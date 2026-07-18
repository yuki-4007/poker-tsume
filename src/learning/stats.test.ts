import { describe, expect, it } from 'vitest';
import type { Category, SrsEntry } from '../types';
import { CATEGORIES } from '../types';
import type { CategoryCounts } from './storage';
import { computeCategoryStats } from './stats';

const NOW = 1_700_000_000_000;

function zeroCounts(): Record<Category, CategoryCounts> {
  return CATEGORIES.reduce<Record<Category, CategoryCounts>>((acc, category) => {
    return { ...acc, [category]: { total: 0, correct: 0 } };
  }, {} as Record<Category, CategoryCounts>);
}

function makeEntry(overrides: Partial<SrsEntry>): SrsEntry {
  return {
    questionId: 'q1',
    category: 'preflop',
    box: 0,
    wrongCount: 0,
    correctStreak: 0,
    dueAt: NOW,
    lastAnsweredAt: NOW,
    ...overrides,
  };
}

describe('computeCategoryStats', () => {
  it('未回答でも全カテゴリを0埋めで返す', () => {
    // Arrange
    const counts = zeroCounts();

    // Act
    const stats = computeCategoryStats(counts, [], NOW);

    // Assert
    expect(stats).toHaveLength(CATEGORIES.length);
    for (const stat of stats) {
      expect(stat.total).toBe(0);
      expect(stat.correct).toBe(0);
      expect(stat.accuracy).toBe(0);
      expect(stat.dueCount).toBe(0);
    }
  });

  it('total=0のときaccuracyは0（ゼロ除算にならない）', () => {
    // Arrange
    const counts = zeroCounts();

    // Act
    const stats = computeCategoryStats(counts, [], NOW);
    const preflop = stats.find((s) => s.category === 'preflop');

    // Assert
    expect(preflop?.accuracy).toBe(0);
  });

  it('累計回答数・正解数・正答率を正しく計算する', () => {
    // Arrange
    const counts = zeroCounts();
    const withPreflop = { ...counts, preflop: { total: 4, correct: 3 } };

    // Act
    const stats = computeCategoryStats(withPreflop, [], NOW);
    const preflop = stats.find((s) => s.category === 'preflop');

    // Assert
    expect(preflop?.total).toBe(4);
    expect(preflop?.correct).toBe(3);
    expect(preflop?.accuracy).toBeCloseTo(0.75);
  });

  it('dueCountはカテゴリごとに現在時刻以下のエントリ数のみを数える', () => {
    // Arrange
    const counts = zeroCounts();
    const entries = [
      makeEntry({ questionId: 'a', category: 'preflop', dueAt: NOW - 1000 }), // due
      makeEntry({ questionId: 'b', category: 'preflop', dueAt: NOW + 1000 }), // not due
      makeEntry({ questionId: 'c', category: 'odds', dueAt: NOW - 1 }), // due, different category
    ];

    // Act
    const stats = computeCategoryStats(counts, entries, NOW);
    const preflop = stats.find((s) => s.category === 'preflop');
    const odds = stats.find((s) => s.category === 'odds');
    const pushfold = stats.find((s) => s.category === 'pushfold');

    // Assert
    expect(preflop?.dueCount).toBe(1);
    expect(odds?.dueCount).toBe(1);
    expect(pushfold?.dueCount).toBe(0);
  });
});
