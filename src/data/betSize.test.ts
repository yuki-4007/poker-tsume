import { describe, expect, test } from 'vitest';
import { buildBetSizeQuestionFromId, sampleBetSizeQuestion } from './betSize';

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

describe('sampleBetSizeQuestion / buildBetSizeQuestionFromId の往復整合（4サブタイプ）', () => {
  const SEEDS = [1, 42, 123, 999, 20260718];

  for (const seed of SEEDS) {
    test(`seed=${seed}: 生成した問題がIDから同一内容で再構築できる`, () => {
      // Arrange
      const rng = seededRng(seed);

      for (let i = 0; i < 40; i++) {
        // Act
        const generated = sampleBetSizeQuestion(rng);
        const rebuilt = buildBetSizeQuestionFromId(generated.id);

        // Assert
        expect(rebuilt, `id=${generated.id} が再構築できない`).not.toBeNull();
        expect(rebuilt?.id).toBe(generated.id);
        expect(rebuilt?.category).toBe('betsize');
        expect(rebuilt?.correctChoiceId).toBe(generated.correctChoiceId);
        expect(rebuilt?.choices).toEqual(generated.choices);
        expect(rebuilt?.explanation).toEqual(generated.explanation);
        // 注: hand のスートはIDに含まれない（preflop/pushfoldと同様、ハンドクラス単位で再構築されるため
        // 具体的なスートの組み合わせは一致するとは限らない）。situationなどテキスト部分のみ照合する。
        expect(rebuilt?.prompt.title).toBe(generated.prompt.title);
        expect(rebuilt?.prompt.situation).toEqual(generated.prompt.situation);
        expect(rebuilt?.prompt.position).toBe(generated.prompt.position);
        expect(rebuilt?.prompt.board).toEqual(generated.prompt.board);
      }
    });
  }

  test('4サブタイプすべてが出現する（十分な試行数で）', () => {
    // Arrange
    const rng = seededRng(2026);
    const subTypes = new Set<string>();

    for (let i = 0; i < 200; i++) {
      // Act
      const question = sampleBetSizeQuestion(rng);
      const subType = question.id.split(':')[1];
      if (subType !== undefined) {
        subTypes.add(subType);
      }
    }

    // Assert
    expect(subTypes).toEqual(new Set(['open', 'limp', '3bet', 'cbet']));
  });
});

describe('buildBetSizeQuestionFromId の不正ID処理', () => {
  const invalidIds = [
    '',
    'betsize',
    'betsize:unknown:CO:AJs',
    'betsize:open:BB:AKs', // BBはRFI対象外
    'betsize:open:CO:72o', // COのオープンレンジ外
    'betsize:open:CO:K9x', // 不正なハンドクラス
    'betsize:open:CO', // 引数不足
    'betsize:limp:CO:AJs:3', // 未定義のリンパー人数
    'betsize:limp:CO:AJs:0',
    'betsize:limp:BB:AKs:1', // BBはRFI対象外
    'betsize:3bet:UTG:QQ:300:ip', // UTGは3ベット対象外
    'betsize:3bet:BTN:QQ:300:oop', // ポジションとpostureの不整合
    'betsize:3bet:BTN:AJs:300:ip', // 境界ハンド（3ベットハンド対象外）
    'betsize:3bet:BTN:QQ:200:ip', // 未定義のオープンサイズ
    'betsize:3bet:BTN:QQ:300:mixed', // 不正なposture
    'betsize:cbet:foo:600:Kh7d2c', // 不正なテクスチャ
    'betsize:cbet:dry:500:Kh7d2c', // 未定義のポット額
    'betsize:cbet:dry:600:Kh7dKh', // 重複カード
    'betsize:cbet:dry:600:JhTh9d', // ツートーンなのにdry指定
    'betsize:cbet:wet:600:Kh7d2c', // レインボーなのにwet指定
    'betsize:cbet:dry:600:short',
  ];

  for (const id of invalidIds) {
    test(`'${id}' は null を返す（throwしない）`, () => {
      expect(buildBetSizeQuestionFromId(id)).toBeNull();
    });
  }
});
