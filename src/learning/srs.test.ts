import { describe, expect, it } from 'vitest';
import type { SrsEntry } from '../types';
import { BOX_INTERVALS_MS, MAX_BOX, applyAnswer, compareByReviewPriority } from './srs';

const NOW = 1_700_000_000_000;

function makeEntry(overrides: Partial<SrsEntry> = {}): SrsEntry {
  return {
    questionId: 'preflop:BTN:K9s',
    category: 'preflop',
    box: 0,
    wrongCount: 0,
    correctStreak: 0,
    dueAt: NOW,
    lastAnsweredAt: NOW,
    ...overrides,
  };
}

describe('applyAnswer', () => {
  it('初回回答（既存エントリなし）で正解するとbox1に上がる', () => {
    // Arrange
    const existing = undefined;

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', true, NOW);

    // Assert
    expect(result.box).toBe(1);
    expect(result.correctStreak).toBe(1);
    expect(result.wrongCount).toBe(0);
  });

  it('初回回答（既存エントリなし）で不正解するとbox0のまま', () => {
    // Arrange
    const existing = undefined;

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', false, NOW);

    // Assert
    expect(result.box).toBe(0);
    expect(result.wrongCount).toBe(1);
    expect(result.correctStreak).toBe(0);
    expect(result.dueAt).toBe(NOW);
  });

  it('正解するとboxが1つ上がる', () => {
    // Arrange
    const existing = makeEntry({ box: 2, correctStreak: 3 });

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', true, NOW);

    // Assert
    expect(result.box).toBe(3);
    expect(result.correctStreak).toBe(4);
  });

  it('box5で正解してもboxは5で頭打ちになる', () => {
    // Arrange
    const existing = makeEntry({ box: MAX_BOX });

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', true, NOW);

    // Assert
    expect(result.box).toBe(MAX_BOX);
  });

  it('不正解するとboxが0に戻り、wrongCountが増え、correctStreakが0になる', () => {
    // Arrange
    const existing = makeEntry({ box: 4, wrongCount: 1, correctStreak: 5 });

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', false, NOW);

    // Assert
    expect(result.box).toBe(0);
    expect(result.wrongCount).toBe(2);
    expect(result.correctStreak).toBe(0);
    expect(result.dueAt).toBe(NOW);
  });

  it.each([
    [0, 1, BOX_INTERVALS_MS[1]],
    [1, 2, BOX_INTERVALS_MS[2]],
    [2, 3, BOX_INTERVALS_MS[3]],
    [3, 4, BOX_INTERVALS_MS[4]],
    [4, 5, BOX_INTERVALS_MS[5]],
  ])('box%iで正解するとbox%iの間隔(%dms)後がdueAtになる', (fromBox, toBox, interval) => {
    // Arrange
    const existing = makeEntry({ box: fromBox });

    // Act
    const result = applyAnswer(existing, 'q1', 'preflop', true, NOW);

    // Assert
    expect(result.box).toBe(toBox);
    expect(result.dueAt).toBe(NOW + (interval ?? 0));
  });

  it('元のエントリをミューテーションしない（イミュータブル）', () => {
    // Arrange
    const existing = makeEntry({ box: 1 });
    const snapshot = { ...existing };

    // Act
    applyAnswer(existing, 'q1', 'preflop', true, NOW);

    // Assert
    expect(existing).toEqual(snapshot);
  });
});

describe('compareByReviewPriority', () => {
  it('boxが小さいエントリを先に並べる', () => {
    // Arrange
    const a = makeEntry({ questionId: 'a', box: 2, dueAt: NOW });
    const b = makeEntry({ questionId: 'b', box: 0, dueAt: NOW });

    // Act
    const sorted = [a, b].sort(compareByReviewPriority);

    // Assert
    expect(sorted.map((e) => e.questionId)).toEqual(['b', 'a']);
  });

  it('同じboxならdueAtが早いエントリを先に並べる', () => {
    // Arrange
    const a = makeEntry({ questionId: 'a', box: 1, dueAt: NOW + 1000 });
    const b = makeEntry({ questionId: 'b', box: 1, dueAt: NOW });

    // Act
    const sorted = [a, b].sort(compareByReviewPriority);

    // Assert
    expect(sorted.map((e) => e.questionId)).toEqual(['b', 'a']);
  });
});
