import { describe, expect, test } from 'vitest';
import { build3BetQuestion, sample3BetQuestion, THREE_BET_HAND_CLASSES, THREE_BET_OPEN_SIZES } from './betSize3bet';

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

describe('build3BetQuestion - IP/OOP × オープンサイズの全組み合わせ', () => {
  const cases: ReadonlyArray<{
    position: 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';
    posture: 'ip' | 'oop';
    openSize: number;
    expected: number;
  }> = [
    { position: 'BTN', posture: 'ip', openSize: 250, expected: 750 },
    { position: 'BTN', posture: 'ip', openSize: 300, expected: 900 },
    { position: 'CO', posture: 'ip', openSize: 250, expected: 750 },
    { position: 'HJ', posture: 'ip', openSize: 300, expected: 900 },
    { position: 'SB', posture: 'oop', openSize: 250, expected: 1000 },
    { position: 'SB', posture: 'oop', openSize: 300, expected: 1200 },
    { position: 'BB', posture: 'oop', openSize: 250, expected: 1000 },
    { position: 'BB', posture: 'oop', openSize: 300, expected: 1200 },
  ];

  for (const { position, posture, openSize, expected } of cases) {
    test(`${position}(${posture}) がオープン${openSize}に対して3ベットする額は${expected}`, () => {
      // Arrange & Act
      const question = build3BetQuestion(position, 'QQ', openSize, posture);

      // Assert
      expect(question.correctChoiceId).toBe(String(expected));
      expect(question.id).toBe(`betsize:3bet:${position}:QQ:${openSize}:${posture}`);
    });
  }

  test('ポジションとpostureが矛盾しているとthrowする（BTNはOOPになりえない）', () => {
    // Arrange & Act & Assert
    expect(() => build3BetQuestion('BTN', 'QQ', 250, 'oop')).toThrow();
  });

  test('3ベットハンド以外（境界ハンド）を渡すとthrowする', () => {
    // Arrange & Act & Assert
    expect(() => build3BetQuestion('BTN', 'AJs', 250, 'ip')).toThrow();
  });

  test('未定義のオープンサイズを渡すとthrowする', () => {
    // Arrange & Act & Assert
    expect(() => build3BetQuestion('BTN', 'QQ', 200, 'ip')).toThrow();
  });

  test('選択肢に正解が含まれ、重複がない', () => {
    for (const handClass of THREE_BET_HAND_CLASSES) {
      for (const openSize of THREE_BET_OPEN_SIZES) {
        // Arrange & Act
        const question = build3BetQuestion('BTN', handClass, openSize, 'ip');
        const ids = question.choices.map((c) => c.id);

        // Assert
        expect(ids).toContain(question.correctChoiceId);
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
  });

  test('解説は2〜4行', () => {
    // Arrange & Act
    const question = build3BetQuestion('SB', 'AKo', 300, 'oop');

    // Assert
    expect(question.explanation.length).toBeGreaterThanOrEqual(2);
    expect(question.explanation.length).toBeLessThanOrEqual(4);
  });

  test('サンプリングで生成される問題は常にposture通りの倍率で正解額が計算される', () => {
    // Arrange
    const rng = seededRng(7);

    for (let i = 0; i < 50; i++) {
      // Act
      const question = sample3BetQuestion(rng);
      const match = question.id.match(/^betsize:3bet:([A-Z]+):([A-Za-z]+):(\d+):(ip|oop)$/);

      // Assert
      expect(match).not.toBeNull();
      if (match) {
        const openSize = Number(match[3]);
        const posture = match[4];
        const expected = openSize * (posture === 'ip' ? 3 : 4);
        expect(question.correctChoiceId).toBe(String(expected));
      }
    }
  });
});
