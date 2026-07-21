import { describe, expect, test } from 'vitest';
import { buildCbetQuestion, CBET_POT_SIZES, parseBoardString, sampleCbetQuestion } from './betSizeCbet';
import type { CardStr } from '../types';

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

const DRY_BOARD: readonly CardStr[] = ['Kh', '7d', '2c'];
const WET_BOARD: readonly CardStr[] = ['Jh', 'Th', '9d'];

describe('buildCbetQuestion - ドライ/ウェットのポットサイズ計算', () => {
  for (const pot of CBET_POT_SIZES) {
    test(`ドライボード・ポット${pot}は1/3ポット(${pot / 3})が正解`, () => {
      // Arrange & Act
      const question = buildCbetQuestion('dry', pot, DRY_BOARD);

      // Assert
      expect(question.correctChoiceId).toBe(String(pot / 3));
    });

    test(`ウェットボード・ポット${pot}は2/3ポット(${(pot * 2) / 3})が正解`, () => {
      // Arrange & Act
      const question = buildCbetQuestion('wet', pot, WET_BOARD);

      // Assert
      expect(question.correctChoiceId).toBe(String((pot * 2) / 3));
    });
  }

  test('IDにボードとポットが含まれる', () => {
    // Arrange & Act
    const question = buildCbetQuestion('dry', 600, DRY_BOARD);

    // Assert
    expect(question.id).toBe('betsize:cbet:dry:600:Kh7d2c');
    expect(question.prompt.board).toEqual(DRY_BOARD);
  });

  test('未定義のポット額はthrowする', () => {
    // Arrange & Act & Assert
    expect(() => buildCbetQuestion('dry', 500, DRY_BOARD)).toThrow();
  });

  test('ドライを名乗るのにツートーンのボードを渡すとthrowする', () => {
    // Arrange & Act & Assert
    expect(() => buildCbetQuestion('dry', 600, WET_BOARD)).toThrow();
  });

  test('ウェットを名乗るのにレインボーのボードを渡すとthrowする', () => {
    // Arrange & Act & Assert
    expect(() => buildCbetQuestion('wet', 600, DRY_BOARD)).toThrow();
  });

  test('選択肢に正解が含まれ、重複がない', () => {
    for (const pot of CBET_POT_SIZES) {
      for (const [texture, board] of [
        ['dry', DRY_BOARD],
        ['wet', WET_BOARD],
      ] as const) {
        // Arrange & Act
        const question = buildCbetQuestion(texture, pot, board);
        const ids = question.choices.map((c) => c.id);

        // Assert
        expect(ids).toContain(question.correctChoiceId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  test('解説は2〜4行', () => {
    // Arrange & Act
    const question = buildCbetQuestion('wet', 900, WET_BOARD);

    // Assert
    expect(question.explanation.length).toBeGreaterThanOrEqual(2);
    expect(question.explanation.length).toBeLessThanOrEqual(4);
  });
});

describe('parseBoardString', () => {
  test('正しいボード文字列を3枚のカードに分解する', () => {
    // Arrange & Act
    const board = parseBoardString('Kh7d2c');

    // Assert
    expect(board).toEqual(['Kh', '7d', '2c']);
  });

  test('長さが6でない文字列はnull', () => {
    expect(parseBoardString('Kh7d2')).toBeNull();
    expect(parseBoardString('Kh7d2cA')).toBeNull();
  });

  test('不正なランク文字はnull', () => {
    expect(parseBoardString('Xh7d2c')).toBeNull();
  });

  test('不正なスート文字はnull', () => {
    expect(parseBoardString('Kx7d2c')).toBeNull();
  });

  test('重複するカードはnull', () => {
    expect(parseBoardString('Kh7dKh')).toBeNull();
  });
});

describe('sampleCbetQuestion', () => {
  test('生成される問題は常にセオリー通りの正解額になる', () => {
    // Arrange
    const rng = seededRng(20260718);

    for (let i = 0; i < 50; i++) {
      // Act
      const question = sampleCbetQuestion(rng);
      const match = question.id.match(/^betsize:cbet:(dry|wet):(\d+):([A-Za-z0-9]+)$/);

      // Assert
      expect(match).not.toBeNull();
      if (match) {
        const texture = match[1];
        const pot = Number(match[2]);
        const expected = texture === 'dry' ? pot / 3 : (pot * 2) / 3;
        expect(question.correctChoiceId).toBe(String(expected));
      }
    }
  });
});
