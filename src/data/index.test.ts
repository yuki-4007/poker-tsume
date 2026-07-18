import { describe, expect, test } from 'vitest';
import { CATEGORIES } from '../types';
import { buildQuestionFromId, generateQuestion } from './index';

/** テスト用の決定的な乱数生成器（mulberry32） */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEEDS = [1, 42, 123, 999, 20260718];
const GENERATIONS_PER_SEED = 20;

describe('generateQuestion と buildQuestionFromId の往復整合', () => {
  for (const category of CATEGORIES) {
    test(`${category}: 生成した問題がIDから同一内容で再構築できる`, () => {
      // Arrange
      for (const seed of SEEDS) {
        const rng = seededRng(seed);
        for (let i = 0; i < GENERATIONS_PER_SEED; i++) {
          const generated = generateQuestion(category, rng);

          // Act
          const rebuilt = buildQuestionFromId(generated.id);

          // Assert
          expect(rebuilt, `id=${generated.id} が再構築できない`).not.toBeNull();
          expect(rebuilt?.id).toBe(generated.id);
          expect(rebuilt?.category).toBe(category);
          expect(rebuilt?.correctChoiceId).toBe(generated.correctChoiceId);
          expect(rebuilt?.choices).toEqual(generated.choices);
          expect(rebuilt?.explanation).toEqual(generated.explanation);
        }
      }
    });
  }

  test('生成される問題は正解の選択肢を必ず含む', () => {
    // Arrange
    const rng = seededRng(7);

    for (const category of CATEGORIES) {
      for (let i = 0; i < GENERATIONS_PER_SEED; i++) {
        // Act
        const question = generateQuestion(category, rng);
        const choiceIds = question.choices.map((c) => c.id);

        // Assert
        expect(choiceIds).toContain(question.correctChoiceId);
        expect(new Set(choiceIds).size).toBe(choiceIds.length);
        expect(question.explanation.length).toBeGreaterThan(0);
      }
    }
  });
});

describe('buildQuestionFromId の不正ID処理', () => {
  const invalidIds = [
    '',
    'unknown:BTN:K9s',
    'preflop:BB:K9s', // BBはRFI対象外
    'preflop:BTN:K9x',
    'preflop:BTN',
    'pushfold:CO:10:K7o', // COはプッシュ/フォールド対象外
    'pushfold:SB:7:K7o', // 7BBは未定義スタック
    'odds:req:1000:3000', // コール額がポット超え
    'odds:req:abc:100',
    'odds:outs:99:flop', // 未定義アウツ
    'odds:outs:9:river',
  ];

  for (const id of invalidIds) {
    test(`'${id}' は null を返す（throwしない）`, () => {
      expect(buildQuestionFromId(id)).toBeNull();
    });
  }
});
