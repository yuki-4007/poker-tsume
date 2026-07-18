// ============================================================
// ハンドクラス（169グリッド）の基礎ユーティリティ
//
// ランク順序、グリッド座標⇔ハンドクラス文字列の変換、隣接判定、
// 全169ハンドクラスの列挙、境界（レンジ判定が隣と異なるセル）の
// 計算を提供する。プリフロップ/プッシュフォールドの出題サンプリング
// で「境界付近を出やすくする」ために使う。
// ============================================================
import type { Rank } from '../types';

/** 強い順（A > K > ... > 2）のランク配列。インデックスが小さいほど強い。 */
export const RANKS: readonly Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

const MIN_RANK_INDEX = 0;
const MAX_RANK_INDEX = RANKS.length - 1;

export type HandType = 'pair' | 's' | 'o';

/** グリッド上の座標。hi/lo は RANKS のインデックス（hi <= lo、ペアは hi === lo）。 */
export interface GridCell {
  readonly hi: number;
  readonly lo: number;
  readonly type: HandType;
}

/** ランク文字（'A'..'2'）を強さインデックスに変換する。不正な文字は throw。 */
export function rankIndex(rank: string): number {
  const idx = RANKS.indexOf(rank as Rank);
  if (idx === -1) {
    throw new Error(`不正なランク文字です: "${rank}"`);
  }
  return idx;
}

/** 強さインデックスからランク文字を得る。範囲外は throw（内部の想定外エラー）。 */
export function rankAt(index: number): Rank {
  const rank = RANKS[index];
  if (rank === undefined) {
    throw new Error(`ランクインデックスが範囲外です: ${index}`);
  }
  return rank;
}

export function cellToClass(cell: GridCell): string {
  const hiRank = rankAt(cell.hi);
  if (cell.type === 'pair') {
    return `${hiRank}${hiRank}`;
  }
  const loRank = rankAt(cell.lo);
  return `${hiRank}${loRank}${cell.type}`;
}

/**
 * ハンドクラス文字列（例: 'AKs', 'TT', 'K9o'）をグリッド座標に変換する。
 * 形式が不正（順序違反・不正ランク・不正スート指定）な場合は意味のあるメッセージ付きで throw。
 */
export function classToCell(handClass: string): GridCell {
  if (handClass.length === 2) {
    const r1 = handClass[0] as string;
    const r2 = handClass[1] as string;
    if (r1 !== r2) {
      throw new Error(`不正なペア表記です（2文字なのに同ランクでない）: "${handClass}"`);
    }
    const idx = rankIndex(r1);
    return { hi: idx, lo: idx, type: 'pair' };
  }
  if (handClass.length === 3) {
    const hi = handClass[0] as string;
    const lo = handClass[1] as string;
    const suffix = handClass[2];
    if (suffix !== 's' && suffix !== 'o') {
      throw new Error(`不正なスート指定です（末尾は s か o）: "${handClass}"`);
    }
    const hiIdx = rankIndex(hi);
    const loIdx = rankIndex(lo);
    if (hiIdx >= loIdx) {
      throw new Error(`高札と低札の順序が不正です（高いランクを先に書く）: "${handClass}"`);
    }
    return { hi: hiIdx, lo: loIdx, type: suffix };
  }
  throw new Error(`不正なハンドクラス形式です: "${handClass}"`);
}

/** ハンドクラス文字列として妥当かどうかを判定する（例外を投げない）。 */
export function isValidHandClass(handClass: string): boolean {
  try {
    classToCell(handClass);
    return true;
  } catch {
    return false;
  }
}

function buildAllHandClasses(): string[] {
  const classes: string[] = [];
  for (let hi = MIN_RANK_INDEX; hi <= MAX_RANK_INDEX; hi++) {
    classes.push(cellToClass({ hi, lo: hi, type: 'pair' }));
    for (let lo = hi + 1; lo <= MAX_RANK_INDEX; lo++) {
      classes.push(cellToClass({ hi, lo, type: 's' }));
      classes.push(cellToClass({ hi, lo, type: 'o' }));
    }
  }
  return classes;
}

/** 169通り全てのハンドクラス（ペア13 + スーテッド78 + オフスーツ78）。 */
export const ALL_HAND_CLASSES: readonly string[] = buildAllHandClasses();

/**
 * レンジ表（13x13グリッド）上で隣接するセルを返す。
 * ペアは対角上の隣（55の隣は44・66）、スーテッド/オフスーツは
 * 高札・低札のインデックスをそれぞれ±1した同種のセル。
 */
export function neighborsOf(cell: GridCell): GridCell[] {
  const result: GridCell[] = [];
  if (cell.type === 'pair') {
    if (cell.hi - 1 >= MIN_RANK_INDEX) {
      result.push({ hi: cell.hi - 1, lo: cell.lo - 1, type: 'pair' });
    }
    if (cell.hi + 1 <= MAX_RANK_INDEX) {
      result.push({ hi: cell.hi + 1, lo: cell.lo + 1, type: 'pair' });
    }
    return result;
  }
  if (cell.hi - 1 >= MIN_RANK_INDEX && cell.hi - 1 < cell.lo) {
    result.push({ hi: cell.hi - 1, lo: cell.lo, type: cell.type });
  }
  if (cell.hi + 1 < cell.lo) {
    result.push({ hi: cell.hi + 1, lo: cell.lo, type: cell.type });
  }
  if (cell.lo - 1 > cell.hi) {
    result.push({ hi: cell.hi, lo: cell.lo - 1, type: cell.type });
  }
  if (cell.lo + 1 <= MAX_RANK_INDEX) {
    result.push({ hi: cell.hi, lo: cell.lo + 1, type: cell.type });
  }
  return result;
}

/**
 * レンジ判定関数 isInRange を受け取り、隣接セルと in/out の判定が
 * 異なる「境界」ハンドクラスの集合を返す。出題サンプリングの重み付けに使う。
 */
export function computeBoundarySet(isInRange: (handClass: string) => boolean): ReadonlySet<string> {
  const boundary = new Set<string>();
  for (const handClass of ALL_HAND_CLASSES) {
    const cell = classToCell(handClass);
    const mine = isInRange(handClass);
    const isBoundary = neighborsOf(cell).some((neighbor) => isInRange(cellToClass(neighbor)) !== mine);
    if (isBoundary) {
      boundary.add(handClass);
    }
  }
  return boundary;
}
