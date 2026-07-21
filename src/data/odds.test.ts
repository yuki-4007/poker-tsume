import { describe, expect, test } from 'vitest';
import { buildOddsOutsQuestion, buildOddsReqQuestion, ODDS_REQ_PATTERNS, OUTS_PATTERNS } from './odds';

describe('buildOddsReqQuestion - 計算式', () => {
  test('必要勝率 = コール額 / (ポット + コール額) で正解が計算される（3000:1000 → 25%）', () => {
    // Arrange
    const pot = 3000;
    const call = 1000;

    // Act
    const question = buildOddsReqQuestion(pot, call);

    // Assert
    expect(question.correctChoiceId).toBe('25%');
    expect(question.choices.some((c) => c.id === '25%')).toBe(true);
  });

  test('id は odds:req:<pot>:<call> の形式になる', () => {
    // Arrange & Act
    const question = buildOddsReqQuestion(4000, 1000);

    // Assert
    expect(question.id).toBe('odds:req:4000:1000');
  });

  test('不正なパラメータ（call >= pot）は throw する', () => {
    expect(() => buildOddsReqQuestion(1000, 1000)).toThrow();
    expect(() => buildOddsReqQuestion(1000, 2000)).toThrow();
  });
});

describe('buildOddsReqQuestion - 選択肢', () => {
  test.each(ODDS_REQ_PATTERNS)('pot=$pot call=$call: 選択肢は4件で重複がなく正解を含む', ({ pot, call }) => {
    // Arrange & Act
    const question = buildOddsReqQuestion(pot, call);
    const labels = question.choices.map((c) => c.label);
    const ids = question.choices.map((c) => c.id);

    // Assert
    expect(question.choices.length).toBe(4);
    expect(new Set(labels).size).toBe(4);
    expect(new Set(ids).size).toBe(4);
    expect(ids).toContain(question.correctChoiceId);
  });
});

describe('ODDS_REQ_PATTERNS - 出題空間の拡張', () => {
  test('暗記されにくいよう十分な件数（80〜120件）に拡張されている', () => {
    expect(ODDS_REQ_PATTERNS.length).toBeGreaterThanOrEqual(80);
    expect(ODDS_REQ_PATTERNS.length).toBeLessThanOrEqual(120);
  });

  test('全パターンでコール額が整数かつ50の倍数、pot > call を満たす', () => {
    for (const { pot, call } of ODDS_REQ_PATTERNS) {
      expect(Number.isInteger(call)).toBe(true);
      expect(call % 50).toBe(0);
      expect(call).toBeLessThan(pot);
      expect(call).toBeGreaterThan(0);
    }
  });

  test('全パターンの(pot, call)にID重複がない', () => {
    const ids = ODDS_REQ_PATTERNS.map(({ pot, call }) => `${pot}:${call}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('必要勝率は 20% / 25% / 33.3% / 40% のいずれかきれいな値に収まる', () => {
    const allowedRates = new Set(['20%', '25%', '33.3%', '40%']);
    for (const { pot, call } of ODDS_REQ_PATTERNS) {
      const question = buildOddsReqQuestion(pot, call);
      expect(allowedRates.has(question.correctChoiceId)).toBe(true);
    }
  });
});

describe('buildOddsOutsQuestion - 計算式', () => {
  test('フロップ時点は アウツ×4% で計算される（9アウツ → 36%）', () => {
    // Arrange & Act
    const question = buildOddsOutsQuestion(9, 'flop');

    // Assert
    expect(question.correctChoiceId).toBe('36%');
  });

  test('ターン時点は アウツ×2% で計算される（9アウツ → 18%）', () => {
    // Arrange & Act
    const question = buildOddsOutsQuestion(9, 'turn');

    // Assert
    expect(question.correctChoiceId).toBe('18%');
  });

  test('id は odds:outs:<outs>:<timing> の形式になる', () => {
    // Arrange & Act
    const question = buildOddsOutsQuestion(9, 'flop');

    // Assert
    expect(question.id).toBe('odds:outs:9:flop');
  });

  test('未定義のアウツ数は throw する', () => {
    expect(() => buildOddsOutsQuestion(5, 'flop')).toThrow();
  });
});

describe('buildOddsOutsQuestion - 選択肢', () => {
  const timings = ['flop', 'turn'] as const;

  for (const timing of timings) {
    test.each(OUTS_PATTERNS)(`outs=$outs timing=${timing}: 選択肢は4件で重複がなく正解を含む`, ({ outs }) => {
      // Arrange & Act
      const question = buildOddsOutsQuestion(outs, timing);
      const labels = question.choices.map((c) => c.label);
      const ids = question.choices.map((c) => c.id);

      // Assert
      expect(question.choices.length).toBe(4);
      expect(new Set(labels).size).toBe(4);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(question.correctChoiceId);
    });
  }
});

describe('buildOddsReqQuestion / buildOddsOutsQuestion - 解説', () => {
  test('必要勝率の解説に計算式が数字入りで含まれる', () => {
    // Arrange & Act
    const question = buildOddsReqQuestion(3000, 1000);

    // Assert
    expect(question.explanation.join('\n')).toContain('1000 ÷ (3000 + 1000)');
  });

  test('アウツの解説に2-4ルールの計算式が含まれる', () => {
    // Arrange & Act
    const question = buildOddsOutsQuestion(8, 'flop');

    // Assert
    expect(question.explanation.join('\n')).toContain('8 × 4%');
  });

  test('2-4ルールの説明が根拠2行に集約され、旧来の重複した要約行が存在しない（根拠2行→計算展開→ドロー説明の4行構成）', () => {
    // Arrange & Act
    const question = buildOddsOutsQuestion(9, 'flop');

    // Assert
    expect(question.explanation).toHaveLength(4);
    expect(question.explanation.some((line) => line.startsWith('2-4ルール:'))).toBe(false);
    expect(question.explanation[2]).toBe('9 × 4% = 36%');
    expect(question.explanation[3]).toContain('フラッシュドロー');
  });
});
