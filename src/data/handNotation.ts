// ============================================================
// レンジ表記パーサ
//
// 169ハンドグリッド表記（'AA','AKs','AKo','T9s' …）を扱う。
// 対応トークン文法:
//   ペア:            '55+' / '77-55' / '22'
//   スーテッド/オフスーツ: 'ATs+' / 'K5o+' / 'A5s-A4s' / '54s' / 'AJo'
// ============================================================
import type { CardStr, Suit } from '../types';
import { classToCell, rankAt, rankIndex } from './handGrid';
import { pickRandom } from './rngUtils';

const SUITS: readonly Suit[] = ['s', 'h', 'd', 'c'];

const PAIR_PLUS_RE = /^([2-9TJQKA])\1\+$/;
const PAIR_RANGE_RE = /^([2-9TJQKA])\1-([2-9TJQKA])\2$/;
const PAIR_SINGLE_RE = /^([2-9TJQKA])\1$/;
const NONPAIR_PLUS_RE = /^([2-9TJQKA])([2-9TJQKA])([so])\+$/;
const NONPAIR_RANGE_RE = /^([2-9TJQKA])([2-9TJQKA])([so])-([2-9TJQKA])([2-9TJQKA])([so])$/;
const NONPAIR_SINGLE_RE = /^([2-9TJQKA])([2-9TJQKA])([so])$/;

function group(m: RegExpMatchArray, index: number): string {
  const value = m[index];
  if (value === undefined) {
    throw new Error('正規表現のグループ取得に失敗しました（内部エラー）');
  }
  return value;
}

function pairsFromTo(hiIdx: number, loIdx: number): string[] {
  const result: string[] = [];
  for (let i = hiIdx; i <= loIdx; i++) {
    const r = rankAt(i);
    result.push(`${r}${r}`);
  }
  return result;
}

function nonPairKickerRange(hiRank: string, loStartIdx: number, loEndIdx: number, suffix: 's' | 'o'): string[] {
  const start = Math.min(loStartIdx, loEndIdx);
  const end = Math.max(loStartIdx, loEndIdx);
  const result: string[] = [];
  for (let i = start; i <= end; i++) {
    result.push(`${hiRank}${rankAt(i)}${suffix}`);
  }
  return result;
}

function parseToken(token: string): string[] {
  let m = token.match(PAIR_PLUS_RE);
  if (m) {
    return pairsFromTo(0, rankIndex(group(m, 1)));
  }

  m = token.match(PAIR_RANGE_RE);
  if (m) {
    const hiIdx = rankIndex(group(m, 1));
    const loIdx = rankIndex(group(m, 2));
    if (hiIdx > loIdx) {
      throw new Error(`不正なペア範囲トークンです（順序が逆、高いペアを先に書く）: "${token}"`);
    }
    return pairsFromTo(hiIdx, loIdx);
  }

  m = token.match(PAIR_SINGLE_RE);
  if (m) {
    const r = group(m, 1);
    return [`${r}${r}`];
  }

  m = token.match(NONPAIR_PLUS_RE);
  if (m) {
    const hi = group(m, 1);
    const lo = group(m, 2);
    const suffix = group(m, 3);
    if (suffix !== 's' && suffix !== 'o') {
      throw new Error(`不正なスート指定です: "${token}"`);
    }
    const hiIdx = rankIndex(hi);
    const loIdx = rankIndex(lo);
    if (hiIdx >= loIdx) {
      throw new Error(`不正なトークンです（高札と低札の順序が誤り）: "${token}"`);
    }
    return nonPairKickerRange(hi, hiIdx + 1, loIdx, suffix);
  }

  m = token.match(NONPAIR_RANGE_RE);
  if (m) {
    const hi1 = group(m, 1);
    const lo1 = group(m, 2);
    const suf1 = group(m, 3);
    const hi2 = group(m, 4);
    const lo2 = group(m, 5);
    const suf2 = group(m, 6);
    if (hi1 !== hi2 || suf1 !== suf2) {
      throw new Error(`不正な範囲トークンです（高札またはスート種別が範囲の両端で一致しない）: "${token}"`);
    }
    if (suf1 !== 's' && suf1 !== 'o') {
      throw new Error(`不正なスート指定です: "${token}"`);
    }
    const hiIdx = rankIndex(hi1);
    const loIdx1 = rankIndex(lo1);
    const loIdx2 = rankIndex(lo2);
    if (hiIdx >= loIdx1 || hiIdx >= loIdx2) {
      throw new Error(`不正な範囲トークンです（高札と低札の順序が誤り）: "${token}"`);
    }
    return nonPairKickerRange(hi1, loIdx1, loIdx2, suf1);
  }

  m = token.match(NONPAIR_SINGLE_RE);
  if (m) {
    const hi = group(m, 1);
    const lo = group(m, 2);
    const suffix = group(m, 3);
    if (suffix !== 's' && suffix !== 'o') {
      throw new Error(`不正なスート指定です: "${token}"`);
    }
    const hiIdx = rankIndex(hi);
    const loIdx = rankIndex(lo);
    if (hiIdx >= loIdx) {
      throw new Error(`不正なトークンです（高いランクを先に書く必要がある）: "${token}"`);
    }
    return [`${hi}${lo}${suffix}`];
  }

  throw new Error(`不正なレンジトークンです: "${token}"`);
}

/** カンマ区切りのレンジ表記文字列をハンドクラス集合に展開する。不正トークンは意味のあるメッセージ付きで throw。 */
export function parseRange(notation: string): Set<string> {
  const tokens = notation
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
  if (tokens.length === 0) {
    throw new Error('レンジ表記が空です');
  }
  const result = new Set<string>();
  for (const token of tokens) {
    for (const handClass of parseToken(token)) {
      result.add(handClass);
    }
  }
  return result;
}

/** 2枚のカードからハンドクラスを得る（例: ('Ks','9s') → 'K9s'）。 */
export function handClassOf(card1: CardStr, card2: CardStr): string {
  const r1 = card1[0] as string;
  const r2 = card2[0] as string;
  const s1 = card1[1];
  const s2 = card2[1];
  const i1 = rankIndex(r1);
  const i2 = rankIndex(r2);
  if (i1 === i2) {
    return `${r1}${r2}`;
  }
  const hi = i1 < i2 ? r1 : r2;
  const lo = i1 < i2 ? r2 : r1;
  const suffix = s1 === s2 ? 's' : 'o';
  return `${hi}${lo}${suffix}`;
}

function pickTwoDistinctSuits(rng: () => number): [Suit, Suit] {
  const i = Math.floor(rng() * SUITS.length) % SUITS.length;
  const offset = 1 + (Math.floor(rng() * (SUITS.length - 1)) % (SUITS.length - 1));
  const j = (i + offset) % SUITS.length;
  const a = SUITS[i];
  const b = SUITS[j];
  if (a === undefined || b === undefined) {
    throw new Error('スート選択に失敗しました（内部エラー）');
  }
  return [a, b];
}

/** ハンドクラスに合致する具体的な2枚をランダムに返す（表示用のスート付与）。 */
export function randomCardsForClass(handClass: string, rng: () => number): [CardStr, CardStr] {
  const cell = classToCell(handClass);
  const hiRank = rankAt(cell.hi);

  if (cell.type === 'pair') {
    const [s1, s2] = pickTwoDistinctSuits(rng);
    return [`${hiRank}${s1}`, `${hiRank}${s2}`];
  }

  const loRank = rankAt(cell.lo);

  if (cell.type === 's') {
    const suit = pickRandom(SUITS, rng);
    return [`${hiRank}${suit}`, `${loRank}${suit}`];
  }

  const [s1, s2] = pickTwoDistinctSuits(rng);
  return [`${hiRank}${s1}`, `${loRank}${s2}`];
}
