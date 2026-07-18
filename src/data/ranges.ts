// ============================================================
// プリフロップ RFI（オープンレイズ）レンジ
//
// 6-max 100BB、初心者向け簡略化・純戦略（ミックス戦略なし）。
// 表の文字列そのものが「唯一の正」であり、他の場所にハードコードしない。
// ============================================================
import type { Position } from '../types';
import { parseRange } from './handNotation';

type RfiPosition = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB';

/** RFI テーブルの対象ポジション（BB はオープン側の対象外なので含まない）。 */
export const RFI_POSITIONS: readonly RfiPosition[] = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];

const RFI_NOTATION: Readonly<Record<RfiPosition, string>> = {
  UTG: '55+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
  HJ: '44+, A9s+, A5s, A4s, KTs+, QTs+, J9s+, T9s, 98s, 87s, ATo+, KJo+',
  CO: '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, A9o+, KTo+, QTo+, JTo',
  BTN: '22+, A2s+, K2s+, Q4s+, J6s+, T6s+, 96s+, 86s+, 75s+, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T8o+, 98o',
  SB: '22+, A2s+, K4s+, Q6s+, J7s+, T7s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, K9o+, Q9o+, J9o+, T9o',
};

/** ポジションごとのオープンレンジ原則（解説文で使用）。 */
const POSITION_PRINCIPLE: Readonly<Record<RfiPosition, string>> = {
  UTG: 'UTGは後ろに5人残っており、最もタイトに開くべきポジション。',
  HJ: 'HJはUTGよりは広く開けるが、後ろにまだ数人残っているため、そこそこ絞ったレンジで開く必要がある。',
  CO: 'COは後ろにBTN・SB・BBの3人のみで、かなり広くオープンできるポジション。',
  BTN: 'BTNはポストフロップ（フロップ以降）で毎回最後にアクションできるため、最も広くオープンできるポジション。',
  SB: 'SBはオープンすれば必ずBBとのヘッズアップになるため、独自の広めのレンジで対応する。',
};

const RFI_RANGES: ReadonlyMap<Position, ReadonlySet<string>> = new Map(
  RFI_POSITIONS.map((position) => [position, parseRange(RFI_NOTATION[position])]),
);

const RFI_NOTATION_MAP: ReadonlyMap<Position, string> = new Map(
  RFI_POSITIONS.map((position) => [position, RFI_NOTATION[position]]),
);

const POSITION_PRINCIPLE_MAP: ReadonlyMap<Position, string> = new Map(
  RFI_POSITIONS.map((position) => [position, POSITION_PRINCIPLE[position]]),
);

/** 指定ポジションのオープンレンジに、指定ハンドクラスが含まれるか判定する。BB は常に false。 */
export function isInOpenRange(position: Position, handClass: string): boolean {
  const range = RFI_RANGES.get(position);
  return range !== undefined && range.has(handClass);
}

/** 解説表示用に、ポジションのレンジ表記全文を返す。対象外ポジション（BB）は null。 */
export function getRfiNotation(position: Position): string | null {
  return RFI_NOTATION_MAP.get(position) ?? null;
}

/** 解説表示用に、ポジションのオープンレンジ原則の一文を返す。対象外ポジション（BB）は null。 */
export function getPositionPrinciple(position: Position): string | null {
  return POSITION_PRINCIPLE_MAP.get(position) ?? null;
}
