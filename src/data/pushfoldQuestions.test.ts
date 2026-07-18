import { describe, expect, test } from 'vitest';
import { buildPushFoldQuestion } from './pushfoldQuestions';

describe('buildPushFoldQuestion - 選択肢ラベルの用語統一', () => {
  test('プッシュ選択肢のラベルは「プッシュ（オールイン）」で、idは"push"のまま変わらない（SRS互換）', () => {
    // Arrange & Act
    const question = buildPushFoldQuestion('SB', 5, '22');

    // Assert
    const pushChoice = question.choices.find((choice) => choice.id === 'push');
    expect(pushChoice).toBeDefined();
    expect(pushChoice?.label).toBe('プッシュ（オールイン）');
  });

  test('フォールド選択肢のラベル・idは変更しない', () => {
    // Arrange & Act
    const question = buildPushFoldQuestion('BTN', 10, '22');

    // Assert
    const foldChoice = question.choices.find((choice) => choice.id === 'fold');
    expect(foldChoice?.label).toBe('フォールド');
  });
});
