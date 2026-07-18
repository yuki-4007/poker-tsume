// ============================================================
// data モジュールの公開API
//
// src/types.ts の契約に従う:
//   generateQuestion(category, rng): Question
//   buildQuestionFromId(id): Question | null
//
// ID 形式（決定的で再構築可能）:
//   preflop:<Position>:<HandClass>            例: 'preflop:BTN:K9s'
//   pushfold:<SB|BTN>:<5|10|15>:<HandClass>    例: 'pushfold:SB:10:K7o'
//   odds:req:<pot>:<call>                      例: 'odds:req:3000:1000'
//   odds:outs:<outs>:<flop|turn>               例: 'odds:outs:9:flop'
// ============================================================
import type { Category, Question } from '../types';
import { isValidHandClass } from './handGrid';
import {
  buildOddsOutsQuestion,
  buildOddsReqQuestion,
  findOutsPattern,
  isValidTiming,
  ODDS_REQ_PATTERNS,
  OUTS_PATTERNS,
} from './odds';
import { buildPreflopQuestion, samplePreflopQuestion } from './preflopQuestions';
import { PUSHFOLD_STACKS, type StackBB } from './pushfold';
import { buildPushFoldQuestion, samplePushFoldQuestion } from './pushfoldQuestions';
import { RFI_POSITIONS } from './ranges';
import { pickRandom } from './rngUtils';

const ODDS_REQ_SAMPLE_WEIGHT = 0.5;

function sampleOddsQuestion(rng: () => number): Question {
  if (rng() < ODDS_REQ_SAMPLE_WEIGHT) {
    const pattern = pickRandom(ODDS_REQ_PATTERNS, rng);
    return buildOddsReqQuestion(pattern.pot, pattern.call);
  }
  const pattern = pickRandom(OUTS_PATTERNS, rng);
  const timing = pickRandom(['flop', 'turn'] as const, rng);
  return buildOddsOutsQuestion(pattern.outs, timing);
}

/** rng は [0,1) を返す乱数関数（テスト時に固定可能）。 */
export function generateQuestion(category: Category, rng: () => number): Question {
  switch (category) {
    case 'preflop':
      return samplePreflopQuestion(rng);
    case 'pushfold':
      return samplePushFoldQuestion(rng);
    case 'odds':
      return sampleOddsQuestion(rng);
    default: {
      const exhaustiveCheck: never = category;
      throw new Error(`未対応のカテゴリです: ${String(exhaustiveCheck)}`);
    }
  }
}

function isRfiPositionStr(value: string): value is (typeof RFI_POSITIONS)[number] {
  return (RFI_POSITIONS as readonly string[]).includes(value);
}

function isPushFoldPositionStr(value: string): value is 'SB' | 'BTN' {
  return value === 'SB' || value === 'BTN';
}

function isStackBB(value: number): value is StackBB {
  return (PUSHFOLD_STACKS as readonly number[]).includes(value);
}

function parsePositiveInt(value: string): number | null {
  if (!/^\d+$/.test(value)) {
    return null;
  }
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Question.id から同一問題を決定的に再構築する（SRS再出題用）。不正なIDは null（例外を投げない）。 */
export function buildQuestionFromId(id: string): Question | null {
  const [head, ...rest] = id.split(':');

  try {
    if (head === 'preflop' && rest.length === 2) {
      const [posStr, handClass] = rest;
      if (posStr === undefined || handClass === undefined) {
        return null;
      }
      if (!isRfiPositionStr(posStr) || !isValidHandClass(handClass)) {
        return null;
      }
      return buildPreflopQuestion(posStr, handClass);
    }

    if (head === 'pushfold' && rest.length === 3) {
      const [posStr, stackStr, handClass] = rest;
      if (posStr === undefined || stackStr === undefined || handClass === undefined) {
        return null;
      }
      if (!isPushFoldPositionStr(posStr)) {
        return null;
      }
      const stackNum = parsePositiveInt(stackStr);
      if (stackNum === null || !isStackBB(stackNum) || !isValidHandClass(handClass)) {
        return null;
      }
      return buildPushFoldQuestion(posStr, stackNum, handClass);
    }

    if (head === 'odds' && rest[0] === 'req' && rest.length === 3) {
      const [, potStr, callStr] = rest;
      if (potStr === undefined || callStr === undefined) {
        return null;
      }
      const pot = parsePositiveInt(potStr);
      const call = parsePositiveInt(callStr);
      if (pot === null || call === null || call >= pot) {
        return null;
      }
      return buildOddsReqQuestion(pot, call);
    }

    if (head === 'odds' && rest[0] === 'outs' && rest.length === 3) {
      const [, outsStr, timingStr] = rest;
      if (outsStr === undefined || timingStr === undefined) {
        return null;
      }
      const outs = parsePositiveInt(outsStr);
      if (outs === null || !findOutsPattern(outs) || !isValidTiming(timingStr)) {
        return null;
      }
      return buildOddsOutsQuestion(outs, timingStr);
    }

    return null;
  } catch {
    return null;
  }
}
