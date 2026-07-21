// ============================================================
// アウツカウント問題 - 局面テンプレートの候補生成
//
// 7テンプレート（フラッシュドロー／OESD／ガットショット／
// ポケットペア→セット／オーバーカード2枚／フラッシュ+ガットショット／
// フラッシュ+OESD）ごとに、乱数でランク・スートを割り当てて
// 候補局面を組み立てる。組み立てた候補は必ず outsEval.ts の
// classifyOuts()（総当たり検証器）で確認し、期待するアウツ数と
// 一致しない場合は再抽選する（上限到達時は決定的なフォールバック局面）。
// ============================================================
import type { CardStr, Suit } from '../types';
import { classifyOuts, makeCard, type OutsClassification, rankOf, rankValue, suitOf, SUITS, type TemplateKind } from './outsEval';
import { pickRandom } from './rngUtils';

interface Candidate {
  readonly hole: readonly [CardStr, CardStr];
  readonly board: readonly [CardStr, CardStr, CardStr];
}

// ------------------------------------------------------------
// 小さな汎用ヘルパー
// ------------------------------------------------------------

function nth<T>(arr: readonly T[], index: number): T {
  const value = arr[index];
  if (value === undefined) {
    throw new Error(`内部エラー: 配列の要素が不足しています (index=${index})`);
  }
  return value;
}

function randInt(min: number, max: number, rng: () => number): number {
  return min + Math.min(max - min, Math.floor(rng() * (max - min + 1)));
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = arr[i];
    const b = arr[j];
    if (a === undefined || b === undefined) {
      throw new Error('内部エラー: シャッフル中に配列外参照が発生しました');
    }
    arr[i] = b;
    arr[j] = a;
  }
  return arr;
}

interface RankPickOptions {
  readonly exclude?: readonly number[];
  readonly min?: number;
  readonly max?: number;
}

/** 2..14（既定）の範囲から、重複しないランク値を count 個ランダムに選ぶ。不足時は null。 */
function pickDistinctRankValues(count: number, rng: () => number, options: RankPickOptions = {}): number[] | null {
  const { exclude = [], min = 2, max = 14 } = options;
  const excludeSet = new Set(exclude);
  const pool: number[] = [];
  for (let v = min; v <= max; v++) {
    if (!excludeSet.has(v)) pool.push(v);
  }
  if (pool.length < count) {
    return null;
  }
  return shuffle(pool, rng).slice(0, count);
}

function pickDistinctSuits(count: number, rng: () => number): Suit[] | null {
  if (count > SUITS.length) {
    return null;
  }
  return shuffle(SUITS, rng).slice(0, count);
}

// ------------------------------------------------------------
// テンプレートごとの候補生成（乱数で局面を組み立てる。制約を満たせなければ null＝再抽選）
// ------------------------------------------------------------

/** フラッシュドロー: 同スート4枚（手札2＋ボード2）＋無関係な1枚。 */
function attemptFlush(rng: () => number): Candidate | null {
  const suit = pickRandom(SUITS, rng);
  const otherSuits = SUITS.filter((s) => s !== suit);
  const ranks = pickDistinctRankValues(4, rng);
  if (!ranks) return null;
  const kickerRanks = pickDistinctRankValues(1, rng, { exclude: ranks });
  if (!kickerRanks) return null;
  const kickerSuit = pickRandom(otherSuits, rng);
  return {
    hole: [makeCard(nth(ranks, 0), suit), makeCard(nth(ranks, 1), suit)],
    board: [makeCard(nth(ranks, 2), suit), makeCard(nth(ranks, 3), suit), makeCard(nth(kickerRanks, 0), kickerSuit)],
  };
}

/** OESD: 4連続ランク（両端とも完成可能な範囲）＋無関係な1枚。 */
function attemptOesd(rng: () => number): Candidate | null {
  const low = randInt(3, 10, rng); // low-1 と low+4 が必ず 2..14 に収まる範囲
  const blockValues = [low, low + 1, low + 2, low + 3];
  const block = shuffle(blockValues, rng);
  const kickerRanks = pickDistinctRankValues(1, rng, { exclude: [...blockValues, low - 1, low + 4] });
  if (!kickerRanks) return null;
  return {
    hole: [makeCard(nth(block, 0), pickRandom(SUITS, rng)), makeCard(nth(block, 1), pickRandom(SUITS, rng))],
    board: [
      makeCard(nth(block, 2), pickRandom(SUITS, rng)),
      makeCard(nth(block, 3), pickRandom(SUITS, rng)),
      makeCard(nth(kickerRanks, 0), pickRandom(SUITS, rng)),
    ],
  };
}

/** ガットショット: 5ランクの窓のうち内側1つが欠けた4枚＋無関係な1枚。 */
function attemptGutshot(rng: () => number): Candidate | null {
  const w = randInt(2, 10, rng);
  const gapValue = w + randInt(1, 3, rng); // 窓の内側（両端は除く）
  const windowValues = [w, w + 1, w + 2, w + 3, w + 4];
  const present = shuffle(
    windowValues.filter((v) => v !== gapValue),
    rng,
  );
  const kickerRanks = pickDistinctRankValues(1, rng, { exclude: [...windowValues, w - 1, w + 5] });
  if (!kickerRanks) return null;
  return {
    hole: [makeCard(nth(present, 0), pickRandom(SUITS, rng)), makeCard(nth(present, 1), pickRandom(SUITS, rng))],
    board: [
      makeCard(nth(present, 2), pickRandom(SUITS, rng)),
      makeCard(nth(present, 3), pickRandom(SUITS, rng)),
      makeCard(nth(kickerRanks, 0), pickRandom(SUITS, rng)),
    ],
  };
}

/** ポケットペア→セット: 手札はポケットペア、ボードはオーバーカードを含む未ペア3枚。 */
function attemptPocketPair(rng: () => number): Candidate | null {
  const pocketValue = randInt(2, 12, rng); // ボード側にオーバーカードの余地を残す
  const suits2 = pickDistinctSuits(2, rng);
  if (!suits2) return null;
  const boardValues = pickDistinctRankValues(3, rng, { exclude: [pocketValue] });
  if (!boardValues) return null;
  if (!boardValues.some((v) => v > pocketValue)) return null; // オーバーカード条件
  const boardSuits = [pickRandom(SUITS, rng), pickRandom(SUITS, rng), pickRandom(SUITS, rng)];
  return {
    hole: [makeCard(pocketValue, nth(suits2, 0)), makeCard(pocketValue, nth(suits2, 1))],
    board: [
      makeCard(nth(boardValues, 0), nth(boardSuits, 0)),
      makeCard(nth(boardValues, 1), nth(boardSuits, 1)),
      makeCard(nth(boardValues, 2), nth(boardSuits, 2)),
    ],
  };
}

/** オーバーカード2枚: 手札2枚ともボード最高ランクより上。 */
function attemptOvercards(rng: () => number): Candidate | null {
  const boardValues = pickDistinctRankValues(3, rng, { max: 12 }); // 上に2ランク以上残す
  if (!boardValues) return null;
  const boardMax = Math.max(...boardValues);
  const holeValues = pickDistinctRankValues(2, rng, { min: boardMax + 1, max: 14 });
  if (!holeValues) return null;
  const boardSuits = [pickRandom(SUITS, rng), pickRandom(SUITS, rng), pickRandom(SUITS, rng)];
  const holeSuits = [pickRandom(SUITS, rng), pickRandom(SUITS, rng)];
  return {
    hole: [makeCard(nth(holeValues, 0), nth(holeSuits, 0)), makeCard(nth(holeValues, 1), nth(holeSuits, 1))],
    board: [
      makeCard(nth(boardValues, 0), nth(boardSuits, 0)),
      makeCard(nth(boardValues, 1), nth(boardSuits, 1)),
      makeCard(nth(boardValues, 2), nth(boardSuits, 2)),
    ],
  };
}

/** フラッシュドロー＋ガットショット: ガットショットの4枚を同スートで統一し、無関係な1枚のみ別スート。 */
function attemptFlushGutshot(rng: () => number): Candidate | null {
  const suit = pickRandom(SUITS, rng);
  const otherSuits = SUITS.filter((s) => s !== suit);
  const w = randInt(2, 10, rng);
  const gapValue = w + randInt(1, 3, rng);
  const windowValues = [w, w + 1, w + 2, w + 3, w + 4];
  const present = shuffle(
    windowValues.filter((v) => v !== gapValue),
    rng,
  );
  const kickerRanks = pickDistinctRankValues(1, rng, { exclude: [...windowValues, w - 1, w + 5] });
  if (!kickerRanks) return null;
  const kickerSuit = pickRandom(otherSuits, rng);
  return {
    hole: [makeCard(nth(present, 0), suit), makeCard(nth(present, 1), suit)],
    board: [makeCard(nth(present, 2), suit), makeCard(nth(present, 3), suit), makeCard(nth(kickerRanks, 0), kickerSuit)],
  };
}

/** フラッシュドロー＋OESD: OESDの4枚を同スートで統一し、無関係な1枚のみ別スート。 */
function attemptFlushOesd(rng: () => number): Candidate | null {
  const suit = pickRandom(SUITS, rng);
  const otherSuits = SUITS.filter((s) => s !== suit);
  const low = randInt(3, 10, rng);
  const blockValues = [low, low + 1, low + 2, low + 3];
  const block = shuffle(blockValues, rng);
  const kickerRanks = pickDistinctRankValues(1, rng, { exclude: [...blockValues, low - 1, low + 4] });
  if (!kickerRanks) return null;
  const kickerSuit = pickRandom(otherSuits, rng);
  return {
    hole: [makeCard(nth(block, 0), suit), makeCard(nth(block, 1), suit)],
    board: [makeCard(nth(block, 2), suit), makeCard(nth(block, 3), suit), makeCard(nth(kickerRanks, 0), kickerSuit)],
  };
}

// ------------------------------------------------------------
// フォールバック局面（手計算で検証済み。上限リトライ到達時のみ使用）
// ------------------------------------------------------------

const FALLBACK: Readonly<Record<TemplateKind, Candidate>> = {
  // As/Ks/Qs/7sで♠4枚、2hは無関係。ランクはA,K,Q,7,2で連続なし → 純粋なフラッシュドロー(9)
  flush: { hole: ['As', 'Ks'], board: ['Qs', '7s', '2h'] },
  // 9,8,7,6が連続。5と10のどちらでもストレート完成 → OESD(8)
  oesd: { hole: ['9c', '8d'], board: ['7h', '6s', '2c'] },
  // 5,6,8,9で7だけ欠けた中抜け。7のみ完成 → ガットショット(4)
  gutshot: { hole: ['9c', '8d'], board: ['6h', '5s', '2c'] },
  // 77のポケットペア、ボードはK98（Kがオーバーカード）でペア・ドロー無し → セット(2)
  pocketPair: { hole: ['7c', '7d'], board: ['Ks', '9h', '2s'] },
  // A,Kがボード最高ランク(9)より上、ペア・ドロー無し → オーバーカード2枚(6)
  overcards: { hole: ['As', 'Kd'], board: ['9h', '7d', '2c'] },
  // ♠4枚(9,8,6,5)＋7だけ欠けた中抜け（重複1枚）→ フラッシュ+ガットショット(12)
  flushGutshot: { hole: ['9s', '8s'], board: ['6s', '5s', '2h'] },
  // ♠4枚(9,8,7,6)＋OESD（重複2枚）→ フラッシュ+OESD(15)
  flushOesd: { hole: ['9s', '8s'], board: ['7s', '6s', '2h'] },
};

interface TemplateSpec {
  readonly kind: TemplateKind;
  readonly expectedOuts: number;
  readonly attempt: (rng: () => number) => Candidate | null;
}

const TEMPLATES: readonly TemplateSpec[] = [
  { kind: 'flush', expectedOuts: 9, attempt: attemptFlush },
  { kind: 'oesd', expectedOuts: 8, attempt: attemptOesd },
  { kind: 'gutshot', expectedOuts: 4, attempt: attemptGutshot },
  { kind: 'pocketPair', expectedOuts: 2, attempt: attemptPocketPair },
  { kind: 'overcards', expectedOuts: 6, attempt: attemptOvercards },
  { kind: 'flushGutshot', expectedOuts: 12, attempt: attemptFlushGutshot },
  { kind: 'flushOesd', expectedOuts: 15, attempt: attemptFlushOesd },
];

const MAX_ATTEMPTS = 500;

/** 強い順（同ランクはスート s>h>d>c）に並べ替える。 */
function sortDesc(cards: readonly CardStr[]): CardStr[] {
  return [...cards].sort((a, b) => {
    const byRank = rankValue(rankOf(b)) - rankValue(rankOf(a));
    if (byRank !== 0) return byRank;
    return SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b));
  });
}

function normalizeCandidate(candidate: Candidate): { hole: [CardStr, CardStr]; board: [CardStr, CardStr, CardStr] } {
  const hole = sortDesc(candidate.hole);
  const board = sortDesc(candidate.board);
  return {
    hole: [nth(hole, 0), nth(hole, 1)],
    board: [nth(board, 0), nth(board, 1), nth(board, 2)],
  };
}

function generateForTemplate(
  spec: TemplateSpec,
  rng: () => number,
): { hole: [CardStr, CardStr]; board: [CardStr, CardStr, CardStr]; classification: OutsClassification } {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const candidate = spec.attempt(rng);
    if (!candidate) continue;
    const normalized = normalizeCandidate(candidate);
    const classification = classifyOuts(normalized.hole, normalized.board);
    if (classification && classification.outs === spec.expectedOuts) {
      return { ...normalized, classification };
    }
  }

  const normalized = normalizeCandidate(FALLBACK[spec.kind]);
  const classification = classifyOuts(normalized.hole, normalized.board);
  if (!classification || classification.outs !== spec.expectedOuts) {
    throw new Error(`フォールバック局面の検証に失敗しました（内部エラー）: kind=${spec.kind}`);
  }
  return { ...normalized, classification };
}

/**
 * 7テンプレートから1つを等確率で選び、検証器（classifyOuts）で確認済みの
 * ランダムな局面（手札2枚＋ボード3枚＋分類結果）を1件返す。
 */
export function generateRandomOutsScenario(
  rng: () => number,
): { hole: [CardStr, CardStr]; board: [CardStr, CardStr, CardStr]; classification: OutsClassification } {
  const spec = pickRandom(TEMPLATES, rng);
  return generateForTemplate(spec, rng);
}
