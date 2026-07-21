// ============================================================
// ベットサイズ問題 - 公開API（'betsize:' 名前空間の統括）
//
// 4サブタイプ（BB=100点として金額を明示する）:
//   open: オープンレイズ額       betsize:open:<Position>:<HandClass>
//   limp: リンパーがいる場合     betsize:limp:<Position>:<HandClass>:<limpers>
//   3bet: 3ベット額             betsize:3bet:<Position>:<HandClass>:<openSize>:<ip|oop>
//   cbet: Cベット額（フロップ）  betsize:cbet:<dry|wet>:<pot>:<board>
//
// 公開APIの契約:
//   sampleBetSizeQuestion(rng: () => number): Question
//   buildBetSizeQuestionFromId(id: string): Question | null   // 'betsize:' 名前空間のIDを担当
// ============================================================
import type { Position, Question } from '../types';
import { isValidHandClass } from './handGrid';
import { isInOpenRange, RFI_POSITIONS } from './ranges';
import { pickRandom } from './rngUtils';
import {
  buildLimpQuestion,
  buildOpenRaiseQuestion,
  LIMPER_COUNTS,
  sampleLimpQuestion,
  sampleOpenRaiseQuestion,
} from './betSizeOpen';
import {
  build3BetQuestion,
  isThreeBetPositionStr,
  sample3BetQuestion,
  THREE_BET_HAND_CLASSES,
  THREE_BET_OPEN_SIZES,
  type ThreeBetPosture,
} from './betSize3bet';
import {
  buildCbetQuestion,
  CBET_POT_SIZES,
  parseBoardString,
  sampleCbetQuestion,
  type BoardTexture,
} from './betSizeCbet';

type BetSizeSubType = 'open' | 'limp' | '3bet' | 'cbet';
const SUB_TYPES: readonly BetSizeSubType[] = ['open', 'limp', '3bet', 'cbet'];

/** ベットサイズ問題をランダム生成する。4サブタイプから均等に選ぶ。 */
export function sampleBetSizeQuestion(rng: () => number): Question {
  const subType = pickRandom(SUB_TYPES, rng);
  switch (subType) {
    case 'open':
      return sampleOpenRaiseQuestion(rng);
    case 'limp':
      return sampleLimpQuestion(rng);
    case '3bet':
      return sample3BetQuestion(rng);
    case 'cbet':
      return sampleCbetQuestion(rng);
    default: {
      const exhaustiveCheck: never = subType;
      throw new Error(`未対応のベットサイズサブタイプです: ${String(exhaustiveCheck)}`);
    }
  }
}

/** オープンレイズ / リンパー対応サブタイプの対象ポジション文字列かどうか（Positionへの型ガード）。 */
function isRfiPositionStr(value: string): value is Position {
  return (RFI_POSITIONS as readonly string[]).includes(value);
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function isThreeBetPosture(value: string): value is ThreeBetPosture {
  return value === 'ip' || value === 'oop';
}

function isBoardTexture(value: string): value is BoardTexture {
  return value === 'dry' || value === 'wet';
}

/**
 * Question.id（'betsize:'名前空間）から同一問題を決定的に再構築する。
 * 不正なIDは null を返す（例外を投げない）。
 */
export function buildBetSizeQuestionFromId(id: string): Question | null {
  const parts = id.split(':');
  const [head, subType, ...rest] = parts;

  if (head !== 'betsize') {
    return null;
  }

  try {
    if (subType === 'open' && rest.length === 2) {
      const [posStr, handClass] = rest;
      if (posStr === undefined || handClass === undefined) {
        return null;
      }
      if (!isRfiPositionStr(posStr) || !isValidHandClass(handClass) || !isInOpenRange(posStr, handClass)) {
        return null;
      }
      return buildOpenRaiseQuestion(posStr, handClass);
    }

    if (subType === 'limp' && rest.length === 3) {
      const [posStr, handClass, limpersStr] = rest;
      if (posStr === undefined || handClass === undefined || limpersStr === undefined) {
        return null;
      }
      if (!isRfiPositionStr(posStr) || !isValidHandClass(handClass) || !isInOpenRange(posStr, handClass)) {
        return null;
      }
      const limpers = parsePositiveInt(limpersStr);
      if (limpers === null || !LIMPER_COUNTS.includes(limpers)) {
        return null;
      }
      return buildLimpQuestion(posStr, handClass, limpers);
    }

    if (subType === '3bet' && rest.length === 4) {
      const [posStr, handClass, openSizeStr, postureStr] = rest;
      if (posStr === undefined || handClass === undefined || openSizeStr === undefined || postureStr === undefined) {
        return null;
      }
      if (!isThreeBetPositionStr(posStr)) {
        return null;
      }
      if (!isValidHandClass(handClass) || !THREE_BET_HAND_CLASSES.includes(handClass)) {
        return null;
      }
      const openSize = parsePositiveInt(openSizeStr);
      if (openSize === null || !THREE_BET_OPEN_SIZES.includes(openSize)) {
        return null;
      }
      if (!isThreeBetPosture(postureStr)) {
        return null;
      }
      return build3BetQuestion(posStr, handClass, openSize, postureStr);
    }

    if (subType === 'cbet' && rest.length === 3) {
      const [textureStr, potStr, boardStr] = rest;
      if (textureStr === undefined || potStr === undefined || boardStr === undefined) {
        return null;
      }
      if (!isBoardTexture(textureStr)) {
        return null;
      }
      const pot = parsePositiveInt(potStr);
      if (pot === null || !CBET_POT_SIZES.includes(pot)) {
        return null;
      }
      const board = parseBoardString(boardStr);
      if (board === null) {
        return null;
      }
      return buildCbetQuestion(textureStr, pot, board);
    }

    return null;
  } catch {
    return null;
  }
}
