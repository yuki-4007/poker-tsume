// ============================================================
// ベットサイズ問題 - Cベット額（フロップのコンティニュエーションベット）
//
// セオリー（この規則が唯一の正）:
//   ドライボード（レインボー・無関連ランク、例: K72レインボー）は約1/3ポット、
//   ウェットボード（2枚同スート・連結、例: JT9で2枚同スート）は約2/3ポット。
// ボードは各タイプのテンプレートから実カードを生成し prompt.board に入れる。
// ID にはボード自体を文字列として含めるため、ID から板の再構築が可能。
// ============================================================
import type { CardStr, Question, Rank, Suit } from '../types';
import { RANKS } from './handGrid';
import { buildAmountChoices } from './betSizeShared';
import { pickRandom } from './rngUtils';

export type BoardTexture = 'dry' | 'wet';

const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];
const RANK_CHARS: ReadonlySet<string> = new Set<string>(RANKS);

/** ドライボード（レインボー・無関連）のランクテンプレート。 */
const DRY_TEMPLATES: readonly (readonly [Rank, Rank, Rank])[] = [
  ['K', '7', '2'],
  ['A', '8', '3'],
  ['Q', '8', '4'],
  ['J', '5', '2'],
  ['T', '6', '4'],
  ['9', '5', '2'],
];

/** ウェットボード（2枚同スート・連結）のランクテンプレート。 */
const WET_TEMPLATES: readonly (readonly [Rank, Rank, Rank])[] = [
  ['J', 'T', '9'],
  ['9', '8', '7'],
  ['T', '9', '8'],
  ['8', '7', '6'],
  ['Q', 'J', 'T'],
  ['7', '6', '5'],
];

/** ポット額の候補（1/3・2/3・タイニーベット(1/6)いずれもきれいに割れる値のみ）。 */
export const CBET_POT_SIZES: readonly number[] = [300, 600, 900, 1200];

const TINY_DIVISOR = 6;

/** 指定数のスート違いを重複なく選ぶ。SUITSは4種のみなのでcountは4以下であること。 */
function pickDistinctSuits(count: number, rng: () => number): Suit[] {
  let remaining: Suit[] = [...SUITS];
  const result: Suit[] = [];
  for (let k = 0; k < count; k++) {
    const suit = pickRandom(remaining, rng);
    result.push(suit);
    remaining = remaining.filter((s) => s !== suit);
  }
  return result;
}

function requireSuit(suits: readonly Suit[], index: number): Suit {
  const suit = suits[index];
  if (suit === undefined) {
    throw new Error('スート選択に失敗しました（内部エラー）');
  }
  return suit;
}

/** レインボー（3色バラバラ）のドライボードを生成する。 */
function buildRainbowBoard(ranks: readonly [Rank, Rank, Rank], rng: () => number): CardStr[] {
  const suits = pickDistinctSuits(3, rng);
  const s0 = requireSuit(suits, 0);
  const s1 = requireSuit(suits, 1);
  const s2 = requireSuit(suits, 2);
  const [r0, r1, r2] = ranks;
  return [`${r0}${s0}`, `${r1}${s1}`, `${r2}${s2}`];
}

/** 2枚同スート（ツートーン）のウェットボードを生成する。 */
function buildTwoToneBoard(ranks: readonly [Rank, Rank, Rank], rng: () => number): CardStr[] {
  const suits = pickDistinctSuits(2, rng);
  const mainSuit = requireSuit(suits, 0);
  const offSuit = requireSuit(suits, 1);
  const [r0, r1, r2] = ranks;
  const oddIndex = Math.floor(rng() * 3);
  const suitFor = (index: number): Suit => (index === oddIndex ? offSuit : mainSuit);
  return [`${r0}${suitFor(0)}`, `${r1}${suitFor(1)}`, `${r2}${suitFor(2)}`];
}

function suitOf(card: CardStr): string {
  return card.slice(1);
}

function distinctSuitCount(board: readonly CardStr[]): number {
  return new Set(board.map(suitOf)).size;
}

/** ボードが指定テクスチャの条件（スート構成）を満たしているか検証する。 */
function matchesTexture(board: readonly CardStr[], texture: BoardTexture): boolean {
  const suitCount = distinctSuitCount(board);
  return texture === 'dry' ? suitCount === 3 : suitCount === 2;
}

/** ボード文字列（例: 'Kh7d2c'）を3枚のCardStrに分解する。不正な形式はnullを返す（throwしない）。 */
export function parseBoardString(boardStr: string): readonly CardStr[] | null {
  if (boardStr.length !== 6) {
    return null;
  }
  const cards: CardStr[] = [];
  for (let i = 0; i < 6; i += 2) {
    const rank = boardStr.slice(i, i + 1);
    const suit = boardStr.slice(i + 1, i + 2);
    if (!RANK_CHARS.has(rank) || !(SUITS as readonly string[]).includes(suit)) {
      return null;
    }
    cards.push(`${rank}${suit}` as CardStr);
  }
  if (new Set(cards).size !== cards.length) {
    return null; // 同一カードの重複は不正
  }
  return cards;
}

function boardToId(board: readonly CardStr[]): string {
  return board.join('');
}

/**
 * Cベット額問題を組み立てる。board はテクスチャ（dry=レインボー/wet=ツートーン）と
 * 整合している必要があり、不整合な場合は throw する（呼び出し側でIDバリデーション時にcatchする想定）。
 */
export function buildCbetQuestion(texture: BoardTexture, pot: number, board: readonly CardStr[]): Question {
  if (board.length !== 3) {
    throw new Error(`不正なボード枚数です: ${board.length}`);
  }
  if (!CBET_POT_SIZES.includes(pot)) {
    throw new Error(`不正なポット額です: ${pot}`);
  }
  if (!matchesTexture(board, texture)) {
    throw new Error(`ボードのスート構成がテクスチャ(${texture})と一致しません`);
  }

  const oneThird = pot / 3;
  const twoThirds = (pot * 2) / 3;
  const correctAmount = texture === 'dry' ? oneThird : twoThirds;
  const oppositeAmount = texture === 'dry' ? twoThirds : oneThird;
  const tinyAmount = pot / TINY_DIVISOR;
  const fullPotAmount = pot;

  const textureLabel = texture === 'dry' ? 'ドライボード' : 'ウェットボード';
  const fractionLabel = texture === 'dry' ? '約1/3ポット' : '約2/3ポット';

  return {
    id: `betsize:cbet:${texture}:${pot}:${boardToId(board)}`,
    category: 'betsize',
    prompt: {
      title: 'ベットサイズ：Cベット額',
      situation: [
        `BB=100点。フロップまでのポットは${pot}点。あなたはプリフロップのレイザーとしてCベット（コンティニュエーションベット）を打つ。`,
        `${textureLabel}に対して、いくらベットするのが適切か？`,
      ],
      board,
    },
    choices: buildAmountChoices([correctAmount, oppositeAmount, tinyAmount, fullPotAmount]),
    correctChoiceId: String(correctAmount),
    explanation: [
      `${textureLabel}では${fractionLabel}が基準。`,
      texture === 'dry'
        ? 'ドライボードは相手に強いハンドやドローが少ないため、小さめのベットでも十分にフォールドを取れたり、価値を得たりできる。'
        : 'ウェットボードはストレートやフラッシュのドローが絡みやすく、小さいベットでは相手のドローに見合わない安いコール（正しくないオッズ）を与えてしまうため、大きめにして正しいプライスを提示する必要がある。',
    ],
  };
}

/** Cベット額問題をランダム生成する。 */
export function sampleCbetQuestion(rng: () => number): Question {
  const texture = pickRandom(['dry', 'wet'] as const, rng);
  const templates = texture === 'dry' ? DRY_TEMPLATES : WET_TEMPLATES;
  const ranks = pickRandom(templates, rng);
  const board = texture === 'dry' ? buildRainbowBoard(ranks, rng) : buildTwoToneBoard(ranks, rng);
  const pot = pickRandom(CBET_POT_SIZES, rng);
  return buildCbetQuestion(texture, pot, board);
}
