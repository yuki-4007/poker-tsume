// ============================================================
// アウツカウント問題の判定エンジン（カード評価・総当たり検証）
//
// 手札2枚＋ボード3枚（フロップ）が与えられたとき、次の1枚（ターン）で
// 「意図したドロー」を完成させるカードを、未見47枚から総当たりで数える。
//
// classifyOuts() がこのファイルの中心的な関数で、与えられたカード自体から
// 毎回ゼロベースでフラッシュ／ストレート／セット／オーバーカードの各条件を
// 再計算する。生成側（outsCount.ts）はこの関数の結果を「検証器」として使い、
// 期待するアウツ数と一致しない組み合わせは破棄して再抽選する。
// buildOutsCountQuestionFromId（IDからの再構築）も同じ関数を呼ぶため、
// 生成時と再構築時でロジックが乖離することがない。
// ============================================================
import type { CardStr, Rank, Suit } from '../types';

/** 強い順（A > K > ... > 2）のランク配列。 */
export const RANKS_HIGH_TO_LOW: readonly Rank[] = [
  'A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2',
];

export const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];

const RANK_VALUE: Readonly<Record<Rank, number>> = {
  A: 14, K: 13, Q: 12, J: 11, T: 10,
  '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2,
};

/** 52枚のカード（強い順×スート順）。 */
export const ALL_CARDS: readonly CardStr[] = RANKS_HIGH_TO_LOW.flatMap((r) =>
  SUITS.map((s) => `${r}${s}` as CardStr),
);

export function rankOf(card: CardStr): Rank {
  return card[0] as Rank;
}

export function suitOf(card: CardStr): Suit {
  return card[1] as Suit;
}

export function rankValue(rank: Rank): number {
  return RANK_VALUE[rank];
}

/** ランク値（2..14）からランク文字を得る。範囲外は throw（内部の想定外エラー）。 */
export function rankFromValue(value: number): Rank {
  const found = RANKS_HIGH_TO_LOW.find((r) => rankValue(r) === value);
  if (found === undefined) {
    throw new Error(`不正なランク値です: ${value}`);
  }
  return found;
}

export function makeCard(value: number, suit: Suit): CardStr {
  return `${rankFromValue(value)}${suit}` as CardStr;
}

/** 52枚から既知のカードを除いた「未見」カードを返す。 */
export function unseenCards(known: readonly CardStr[]): CardStr[] {
  const knownSet = new Set(known);
  return ALL_CARDS.filter((c) => !knownSet.has(c));
}

function suitCounts(cards: readonly CardStr[]): Map<Suit, number> {
  const counts = new Map<Suit, number>();
  for (const c of cards) {
    const s = suitOf(c);
    counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  return counts;
}

function formsFlush(cards: readonly CardStr[]): boolean {
  const counts = suitCounts(cards);
  return Math.max(...counts.values()) >= 5;
}

/** known に candidate を加えた組が、同スート5枚以上（フラッシュ）を作るか。 */
export function makesFlush(known: readonly CardStr[], candidate: CardStr): boolean {
  return formsFlush([...known, candidate]);
}

/** エースをロー（1）としても扱えるようにしたランク値集合。 */
function rankValueSetWithAceLow(cards: readonly CardStr[]): Set<number> {
  const values = new Set(cards.map((c) => rankValue(rankOf(c))));
  if (values.has(14)) {
    values.add(1);
  }
  return values;
}

function formsStraight(cards: readonly CardStr[]): boolean {
  const values = rankValueSetWithAceLow(cards);
  for (let low = 1; low <= 10; low++) {
    let complete = true;
    for (let v = low; v < low + 5; v++) {
      if (!values.has(v)) {
        complete = false;
        break;
      }
    }
    if (complete) {
      return true;
    }
  }
  return false;
}

/** known に candidate を加えた組が、5連続ランク（ストレート）を作るか。 */
export function makesStraight(known: readonly CardStr[], candidate: CardStr): boolean {
  return formsStraight([...known, candidate]);
}

/** known 内で指定ランクが何枚見えているか。 */
export function rankCount(known: readonly CardStr[], rank: Rank): number {
  return known.filter((c) => rankOf(c) === rank).length;
}

/** known に重複ランクが存在するか（＝どこかにペアがあるか）。 */
export function hasPairAmong(known: readonly CardStr[]): boolean {
  const ranks = known.map((c) => rankOf(c));
  return new Set(ranks).size !== ranks.length;
}

/** 未見カードのうち、predicate を満たすものの枚数を数える（総当たり）。 */
export function countOuts(known: readonly CardStr[], predicate: (candidate: CardStr) => boolean): number {
  return unseenCards(known).filter(predicate).length;
}

/** 未見カードのうち、ストレートを完成させるランクの集合を求める（強い順・重複なし）。 */
function straightCompletingRanks(known: readonly CardStr[]): Rank[] {
  const ranks = new Set<Rank>();
  for (const c of unseenCards(known)) {
    if (makesStraight(known, c)) {
      ranks.add(rankOf(c));
    }
  }
  return Array.from(ranks).sort((a, b) => rankValue(b) - rankValue(a));
}

// ------------------------------------------------------------
// テンプレート分類
// ------------------------------------------------------------

export type TemplateKind =
  | 'flush'
  | 'oesd'
  | 'gutshot'
  | 'pocketPair'
  | 'overcards'
  | 'flushGutshot'
  | 'flushOesd';

export interface OutsClassification {
  readonly outs: number;
  readonly kind: TemplateKind;
  readonly flushSuit: Suit | null;
  /** ストレートを完成させるランク（強い順）。0〜2件。 */
  readonly straightRanks: readonly Rank[];
  readonly pocketRank: Rank | null;
  /** オーバーカード2枚のランク（強い順）。0または2件。 */
  readonly overcardRanks: readonly Rank[];
}

/**
 * 手札2枚＋ボード3枚から、アウツ数とドローの種類を総当たりで判定する。
 * 7つのテンプレートのいずれにも一意に当てはまらない場合（意図しないドローの
 * 混入、重複カードなど）は null を返す。
 */
export function classifyOuts(
  hole: readonly [CardStr, CardStr],
  board: readonly CardStr[],
): OutsClassification | null {
  if (board.length !== 3) {
    return null;
  }
  const known = [...hole, ...board];
  if (new Set(known).size !== known.length) {
    return null; // 重複カード
  }
  if (formsFlush(known) || formsStraight(known)) {
    return null; // フロップ時点で既にフラッシュ／ストレートが完成している（ドローではなく想定外）
  }

  const [h1, h2] = hole;

  if (rankOf(h1) === rankOf(h2)) {
    return classifyPocketPair(hole, board, known);
  }

  if (hasPairAmong(known)) {
    return null; // 意図しないペア（ドローの無い単純ペアなど）が混入
  }

  return classifyDrawTemplates(hole, board, known);
}

function classifyPocketPair(
  hole: readonly [CardStr, CardStr],
  board: readonly CardStr[],
  known: readonly CardStr[],
): OutsClassification | null {
  const pocketRank = rankOf(hole[0]);
  if (rankCount(board, pocketRank) > 0 || hasPairAmong(board)) {
    return null; // ボードに同ランク、またはボード自体がペア
  }
  const flushOuts = countOuts(known, (c) => makesFlush(known, c));
  const straightOuts = countOuts(known, (c) => makesStraight(known, c));
  if (flushOuts !== 0 || straightOuts !== 0) {
    return null; // 想定外のドローが混入
  }
  const outs = 4 - rankCount(known, pocketRank);
  if (outs !== 2) {
    return null;
  }
  return {
    outs,
    kind: 'pocketPair',
    flushSuit: null,
    straightRanks: [],
    pocketRank,
    overcardRanks: [],
  };
}

function findFlushSuit(known: readonly CardStr[]): Suit | null {
  const counts = suitCounts(known);
  for (const [suit, n] of counts) {
    if (n === 4) {
      return suit;
    }
  }
  return null;
}

function classifyDrawTemplates(
  hole: readonly [CardStr, CardStr],
  board: readonly CardStr[],
  known: readonly CardStr[],
): OutsClassification | null {
  const flushSuit = findFlushSuit(known);
  const hasFlushDraw = flushSuit !== null;
  const straightRanks = straightCompletingRanks(known);
  const unionOuts = countOuts(known, (c) => makesFlush(known, c) || makesStraight(known, c));

  if (hasFlushDraw && straightRanks.length === 0) {
    return unionOuts === 9
      ? { outs: 9, kind: 'flush', flushSuit, straightRanks: [], pocketRank: null, overcardRanks: [] }
      : null;
  }
  if (!hasFlushDraw && straightRanks.length === 2) {
    return unionOuts === 8
      ? { outs: 8, kind: 'oesd', flushSuit: null, straightRanks, pocketRank: null, overcardRanks: [] }
      : null;
  }
  if (!hasFlushDraw && straightRanks.length === 1) {
    return unionOuts === 4
      ? { outs: 4, kind: 'gutshot', flushSuit: null, straightRanks, pocketRank: null, overcardRanks: [] }
      : null;
  }
  if (hasFlushDraw && straightRanks.length === 1) {
    return unionOuts === 12
      ? { outs: 12, kind: 'flushGutshot', flushSuit, straightRanks, pocketRank: null, overcardRanks: [] }
      : null;
  }
  if (hasFlushDraw && straightRanks.length === 2) {
    return unionOuts === 15
      ? { outs: 15, kind: 'flushOesd', flushSuit, straightRanks, pocketRank: null, overcardRanks: [] }
      : null;
  }
  if (!hasFlushDraw && straightRanks.length === 0) {
    return classifyOvercards(hole, board, known);
  }
  return null; // 3件以上の完成ランクなど、想定外の混入パターン
}

function classifyOvercards(
  hole: readonly [CardStr, CardStr],
  board: readonly CardStr[],
  known: readonly CardStr[],
): OutsClassification | null {
  const boardMax = Math.max(...board.map((c) => rankValue(rankOf(c))));
  const holeRanks: [Rank, Rank] = [rankOf(hole[0]), rankOf(hole[1])];
  const bothOvercards = holeRanks.every((r) => rankValue(r) > boardMax);
  if (!bothOvercards) {
    return null; // どのテンプレートにも一致しない
  }
  const overcardRanks = [...holeRanks].sort((a, b) => rankValue(b) - rankValue(a));
  const outs = countOuts(known, (c) => holeRanks.includes(rankOf(c)));
  if (outs !== 6) {
    return null;
  }
  return {
    outs,
    kind: 'overcards',
    flushSuit: null,
    straightRanks: [],
    pocketRank: null,
    overcardRanks,
  };
}
