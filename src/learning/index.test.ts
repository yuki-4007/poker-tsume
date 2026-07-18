import { afterEach, describe, expect, it } from 'vitest';
import { CATEGORIES } from '../types';
import { createLearning } from './index';
import * as learningApi from './index';
import { createMemoryStore } from './storage';

const NOW = 1_700_000_000_000;

describe('createLearning', () => {
  it('新規問題への正解でbox1のエントリが作られ、getDueEntriesには次の期限まで出てこない', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());

    // Act
    learning.recordAnswer('q1', 'preflop', true, NOW);
    const dueImmediately = learning.getDueEntries(NOW);
    const dueLater = learning.getDueEntries(NOW + 11 * 60 * 1000); // 10分間隔を超過

    // Assert
    expect(dueImmediately).toHaveLength(0);
    expect(dueLater).toHaveLength(1);
    expect(dueLater[0]?.box).toBe(1);
  });

  it('不正解した問題は即座にgetDueEntriesへ現れる', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());

    // Act
    learning.recordAnswer('q1', 'preflop', false, NOW);
    const due = learning.getDueEntries(NOW);

    // Assert
    expect(due).toHaveLength(1);
    expect(due[0]?.box).toBe(0);
    expect(due[0]?.wrongCount).toBe(1);
  });

  it('getDueEntriesはbox昇順で返す（頻出の問題を優先）', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('wrong-again', 'preflop', false, NOW); // box0, dueAt=NOW
    learning.recordAnswer('correct-once', 'odds', true, NOW - 1000); // box1

    // Act: 十分未来にして両方dueにする
    const due = learning.getDueEntries(NOW + 60 * 60 * 1000);

    // Assert
    expect(due.map((e) => e.questionId)).toEqual(['wrong-again', 'correct-once']);
  });

  it('getDueEntriesは同boxならdueAt昇順（期限が早い方を先）で返す', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('wrong-b', 'preflop', false, NOW); // box0, dueAt=NOW
    learning.recordAnswer('wrong-a', 'odds', false, NOW - 5000); // box0, dueAt=NOW-5000（より古い）

    // Act
    const due = learning.getDueEntries(NOW);

    // Assert
    expect(due.map((e) => e.questionId)).toEqual(['wrong-a', 'wrong-b']);
  });

  it('getStatsは全カテゴリを返し、累計回答数・正答率・dueCountを反映する', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', true, NOW);
    learning.recordAnswer('q2', 'preflop', false, NOW);

    // Act
    const stats = learning.getStats(NOW);
    const preflop = stats.find((s) => s.category === 'preflop');

    // Assert
    expect(stats).toHaveLength(CATEGORIES.length);
    expect(preflop?.total).toBe(2);
    expect(preflop?.correct).toBe(1);
    expect(preflop?.accuracy).toBeCloseTo(0.5);
    expect(preflop?.dueCount).toBe(1); // q2は不正解でdueAt=NOW
  });

  it('同じ問題を複数回回答すると最新の状態に上書きされる', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', true, NOW);

    // Act: 2回目も正解 → box2へ
    learning.recordAnswer('q1', 'preflop', true, NOW + 20 * 60 * 1000);
    const stats = learning.getStats(NOW + 20 * 60 * 1000);
    const preflop = stats.find((s) => s.category === 'preflop');

    // Assert: 累計回答数は2件、SRSエントリは1件に集約される
    expect(preflop?.total).toBe(2);
    expect(preflop?.correct).toBe(2);
  });

  it('removeEntryで指定したquestionIdのエントリが削除される', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', false, NOW);
    learning.recordAnswer('q2', 'odds', false, NOW);

    // Act
    learning.removeEntry('q1');
    const due = learning.getDueEntries(NOW);

    // Assert: q1だけが消え、q2は残る
    expect(due.map((e) => e.questionId)).toEqual(['q2']);
  });

  it('removeEntryは存在しないquestionIdを渡してもクラッシュせず、既存データに影響しない', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', false, NOW);

    // Act
    expect(() => learning.removeEntry('does-not-exist')).not.toThrow();
    const due = learning.getDueEntries(NOW);

    // Assert
    expect(due.map((e) => e.questionId)).toEqual(['q1']);
  });

  it('removeEntryはgetStatsの累計回答数・正答率には影響しない（SRSエントリのみ削除する）', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', true, NOW);

    // Act
    learning.removeEntry('q1');
    const stats = learning.getStats(NOW);
    const preflop = stats.find((s) => s.category === 'preflop');

    // Assert: 累計カウントはcategoryCountsで独立管理されているため変わらない
    expect(preflop?.total).toBe(1);
    expect(preflop?.correct).toBe(1);
    expect(preflop?.dueCount).toBe(0);
  });

  it('resetProgressで全データが消える', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());
    learning.recordAnswer('q1', 'preflop', true, NOW);

    // Act
    learning.resetProgress();
    const stats = learning.getStats(NOW);
    const due = learning.getDueEntries(NOW + 100 * 24 * 60 * 60 * 1000);

    // Assert
    expect(due).toHaveLength(0);
    for (const stat of stats) {
      expect(stat.total).toBe(0);
      expect(stat.correct).toBe(0);
    }
  });

  it('nowを省略した場合はDate.now()相当の現在時刻が使われる', () => {
    // Arrange
    const learning = createLearning(createMemoryStore());

    // Act
    learning.recordAnswer('q1', 'preflop', false); // nowを省略
    const due = learning.getDueEntries(); // nowを省略

    // Assert: 不正解は即時dueになるはずなので、現在時刻基準で1件見える
    expect(due).toHaveLength(1);
  });
});

describe('デフォルトエクスポート（_configureForTestによるstore差し替え）', () => {
  afterEach(() => {
    learningApi._configureForTest(createMemoryStore());
  });

  it('_configureForTestで注入したstoreに対して公開APIが動作する', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());

    // Act
    learningApi.recordAnswer('q1', 'preflop', true, NOW);
    const due = learningApi.getDueEntries(NOW + 60 * 60 * 1000);
    const stats = learningApi.getStats(NOW + 60 * 60 * 1000);

    // Assert
    expect(due).toHaveLength(1);
    expect(stats.find((s) => s.category === 'preflop')?.total).toBe(1);
  });

  it('removeEntryは注入されたstoreに対して働く', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    learningApi.recordAnswer('q1', 'preflop', false, NOW);

    // Act
    learningApi.removeEntry('q1');
    const due = learningApi.getDueEntries(NOW);

    // Assert
    expect(due).toHaveLength(0);
  });

  it('resetProgressは注入されたstoreに対して働く', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    learningApi.recordAnswer('q1', 'preflop', true, NOW);

    // Act
    learningApi.resetProgress();
    const stats = learningApi.getStats(NOW);

    // Assert
    expect(stats.every((s) => s.total === 0)).toBe(true);
  });
});
