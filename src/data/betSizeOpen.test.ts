import { describe, expect, test } from 'vitest';
import { buildLimpQuestion, buildOpenRaiseQuestion, sampleLimpQuestion, sampleOpenRaiseQuestion } from './betSizeOpen';

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

describe('buildOpenRaiseQuestion - オープンレイズ額', () => {
  test('正解は常に250（2.5BB）', () => {
    // Arrange & Act
    const question = buildOpenRaiseQuestion('CO', 'AJs');

    // Assert
    expect(question.correctChoiceId).toBe('250');
    expect(question.id).toBe('betsize:open:CO:AJs');
  });

  test('選択肢に正解が含まれ、重複がない', () => {
    // Arrange & Act
    const question = buildOpenRaiseQuestion('BTN', '22');
    const ids = question.choices.map((c) => c.id);

    // Assert
    expect(ids).toContain(question.correctChoiceId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('レンジ外のハンドを渡すとthrowする', () => {
    // Arrange & Act & Assert
    expect(() => buildOpenRaiseQuestion('UTG', '72o')).toThrow();
  });

  test('解説は2〜4行', () => {
    // Arrange & Act
    const question = buildOpenRaiseQuestion('SB', 'K5s');

    // Assert
    expect(question.explanation.length).toBeGreaterThanOrEqual(2);
    expect(question.explanation.length).toBeLessThanOrEqual(4);
  });

  test('サンプリングは常にそのポジションのオープンレンジ内のハンドを選ぶ', () => {
    // Arrange
    const rng = seededRng(1);

    for (let i = 0; i < 50; i++) {
      // Act
      const question = sampleOpenRaiseQuestion(rng);

      // Assert
      expect(question.correctChoiceId).toBe('250');
      expect(question.category).toBe('betsize');
    }
  });
});

describe('buildLimpQuestion - リンパーがいる場合', () => {
  test('リンパー1人なら3BB+1BB=400が正解', () => {
    // Arrange & Act
    const question = buildLimpQuestion('HJ', 'KQs', 1);

    // Assert
    expect(question.correctChoiceId).toBe('400');
    expect(question.id).toBe('betsize:limp:HJ:KQs:1');
  });

  test('リンパー2人なら3BB+2BB=500が正解', () => {
    // Arrange & Act
    const question = buildLimpQuestion('HJ', 'KQs', 2);

    // Assert
    expect(question.correctChoiceId).toBe('500');
    expect(question.id).toBe('betsize:limp:HJ:KQs:2');
  });

  test('不正なリンパー人数はthrowする', () => {
    // Arrange & Act & Assert
    expect(() => buildLimpQuestion('HJ', 'KQs', 3)).toThrow();
  });

  test('選択肢に正解が含まれ、重複がない（各リンパー人数）', () => {
    for (const limpers of [1, 2]) {
      // Arrange & Act
      const question = buildLimpQuestion('CO', 'AJs', limpers);
      const ids = question.choices.map((c) => c.id);

      // Assert
      expect(ids).toContain(question.correctChoiceId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test('サンプリングで生成される問題は常に正しいセオリー通りの正解額になる', () => {
    // Arrange
    const rng = seededRng(42);

    for (let i = 0; i < 50; i++) {
      // Act
      const question = sampleLimpQuestion(rng);
      const limpersMatch = question.id.match(/:(\d+)$/);
      const limpers = limpersMatch ? Number(limpersMatch[1]) : NaN;

      // Assert
      expect(question.correctChoiceId).toBe(String(300 + 100 * limpers));
    }
  });
});
