import { describe, expect, test } from 'vitest';
import { classifyOuts } from './outsEval';
import { buildOutsCountQuestionFromId, sampleOutsCountQuestion } from './outsCount';

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

const SEEDS = [1, 2, 3, 7, 42, 123, 999, 20260718];
const ITER_PER_SEED = 100 / SEEDS.length;

describe('sampleOutsCountQuestion - 生成される問題の正しさ（検証器との一致）', () => {
  test('100回生成して、毎回 classifyOuts の再計算結果と一致する', () => {
    for (const seed of SEEDS) {
      const rng = seededRng(seed);
      for (let i = 0; i < Math.ceil(ITER_PER_SEED); i++) {
        // Arrange & Act
        const question = sampleOutsCountQuestion(rng);
        const [handStr, boardStr] = question.id.split(':').slice(1);
        expect(handStr).toBeDefined();
        expect(boardStr).toBeDefined();

        // 検証器で独立に再計算し、生成結果と一致することを確認する
        const hole = question.prompt.hand;
        const board = question.prompt.board;
        expect(hole).toBeDefined();
        expect(board).toBeDefined();
        if (!hole || !board) continue;
        const classification = classifyOuts(hole, board);

        // Assert
        expect(classification, `id=${question.id} が検証器で分類できない`).not.toBeNull();
        expect(classification?.outs).toBe(Number(question.correctChoiceId));
      }
    }
  });

  test('id は outscount: 名前空間で、手札2枚・ボード3枚のカード表記を含む', () => {
    const rng = seededRng(5);
    const question = sampleOutsCountQuestion(rng);
    expect(question.id).toMatch(/^outscount:([2-9TJQKA][shdc]){2}:([2-9TJQKA][shdc]){3}$/);
  });

  test('選択肢は4件で重複が無く、正解を含む', () => {
    const rng = seededRng(11);
    for (let i = 0; i < 30; i++) {
      const question = sampleOutsCountQuestion(rng);
      const ids = question.choices.map((c) => c.id);
      expect(question.choices.length).toBe(4);
      expect(new Set(ids).size).toBe(4);
      expect(ids).toContain(question.correctChoiceId);
      expect(question.explanation.length).toBeGreaterThanOrEqual(2);
      expect(question.explanation.length).toBeLessThanOrEqual(4);
    }
  });

  test('100回生成して、7テンプレート全てのアウツ数（2,4,6,8,9,12,15）が出現する', () => {
    const rng = seededRng(2026);
    const seenOuts = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const question = sampleOutsCountQuestion(rng);
      seenOuts.add(question.correctChoiceId);
    }
    expect(seenOuts).toEqual(new Set(['2', '4', '6', '8', '9', '12', '15']));
  });
});

describe('buildOutsCountQuestionFromId - 往復整合', () => {
  test('生成→ID→再構築で、correctChoiceId・choices・explanationが完全一致する', () => {
    for (const seed of SEEDS) {
      const rng = seededRng(seed);
      for (let i = 0; i < Math.ceil(ITER_PER_SEED); i++) {
        const generated = sampleOutsCountQuestion(rng);
        const rebuilt = buildOutsCountQuestionFromId(generated.id);

        expect(rebuilt, `id=${generated.id} が再構築できない`).not.toBeNull();
        expect(rebuilt?.id).toBe(generated.id);
        expect(rebuilt?.category).toBe('outscount');
        expect(rebuilt?.correctChoiceId).toBe(generated.correctChoiceId);
        expect(rebuilt?.choices).toEqual(generated.choices);
        expect(rebuilt?.explanation).toEqual(generated.explanation);
        expect(rebuilt?.prompt.hand).toEqual(generated.prompt.hand);
        expect(rebuilt?.prompt.board).toEqual(generated.prompt.board);
      }
    }
  });

  test('既知の各テンプレートIDを直接指定しても正しく再構築できる', () => {
    const cases: ReadonlyArray<{ id: string; outs: string }> = [
      { id: 'outscount:AsKs:Qs7s2h', outs: '9' }, // フラッシュドロー
      { id: 'outscount:9c8d:7h6s2c', outs: '8' }, // OESD
      { id: 'outscount:9c8d:6h5s2c', outs: '4' }, // ガットショット
      { id: 'outscount:7c7d:Ks9h2s', outs: '2' }, // ポケットペア→セット
      { id: 'outscount:AsKd:9h7d2c', outs: '6' }, // オーバーカード2枚
      { id: 'outscount:9s8s:6s5s2h', outs: '12' }, // フラッシュ+ガットショット
      { id: 'outscount:9s8s:7s6s2h', outs: '15' }, // フラッシュ+OESD
    ];

    for (const { id, outs } of cases) {
      const question = buildOutsCountQuestionFromId(id);
      expect(question, `id=${id}`).not.toBeNull();
      expect(question?.correctChoiceId).toBe(outs);
      expect(question?.choices.map((c) => c.id)).toContain(outs);
    }
  });
});

describe('buildOutsCountQuestionFromId - 不正IDはnullを返す（throwしない）', () => {
  const invalidIds = [
    '',
    'outscount',
    'outscount:AsKs',
    'unknown:AsKs:Qs7s2h',
    'outscount:AsAs:Qs7s2h', // 手札内で重複カード
    'outscount:AsKs:AsQs7s', // 手札とボードで重複カード
    'outscount:AsKs:Qs7s7s', // ボード内で重複カード
    'outscount:AsK:Qs7s2h', // 手札の桁数が不正
    'outscount:AsKs:Qs7s2', // ボードの桁数が不正
    'outscount:AxKs:Qs7s2h', // 不正なランク文字
    'outscount:AsKz:Qs7s2h', // 不正なスート文字
    'outscount:AsKs:Qs7s3s', // 既にフラッシュが完成（想定外の混入）
    'outscount:2c3d:4h5s6c', // 既にストレートが完成（想定外の混入）
    'outscount:2c2d:2h5s6c', // ポケットペアと同ランクがボードに存在
  ];

  for (const id of invalidIds) {
    test(`'${id}' は null を返す`, () => {
      expect(buildOutsCountQuestionFromId(id)).toBeNull();
    });
  }
});
