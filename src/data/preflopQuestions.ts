// ============================================================
// プリフロップ判断問題の生成
//
// ポジション・ハンドをランダムに選び、レンジ境界付近が出やすいよう
// 重み付けサンプリングする。Question の組み立ては ID からの
// 決定的再構築（buildPreflopQuestion）とサンプリング生成の両方で共有する。
// ============================================================
import type { Position, Question } from '../types';
import { ALL_HAND_CLASSES, computeBoundarySet, isValidHandClass } from './handGrid';
import { randomCardsForClass } from './handNotation';
import { getPositionPrinciple, getRfiNotation, isInOpenRange, RFI_POSITIONS } from './ranges';
import { DEFAULT_BOUNDARY_WEIGHT, pickRandom, pickWeighted } from './rngUtils';

const boundaryCache = new Map<Position, ReadonlySet<string>>();

function getBoundarySet(position: Position): ReadonlySet<string> {
  const cached = boundaryCache.get(position);
  if (cached) {
    return cached;
  }
  const boundary = computeBoundarySet((handClass) => isInOpenRange(position, handClass));
  boundaryCache.set(position, boundary);
  return boundary;
}

/** ID からの決定的再構築時に使う固定rng（スートは常に同じ組み合わせを選ぶ）。 */
function fixedRng(): number {
  return 0;
}

/**
 * プリフロップ判断問題を組み立てる。
 * rng を省略すると、決定的なスート選択（ID再構築向け）になる。
 */
export function buildPreflopQuestion(position: Position, handClass: string, rng: () => number = fixedRng): Question {
  if (!isValidHandClass(handClass)) {
    throw new Error(`不正なハンドクラスです: "${handClass}"`);
  }

  const inRange = isInOpenRange(position, handClass);
  const [card1, card2] = randomCardsForClass(handClass, rng);
  const notation = getRfiNotation(position);
  const principle = getPositionPrinciple(position);

  const explanationLines = [
    principle,
    `${position}の簡略オープンレンジ: ${notation ?? '(このポジションはオープン側の対象外)'}`,
    inRange
      ? `${handClass} はこのレンジに含まれるため、レイズ（オープン）が正解。`
      : `${handClass} はこのレンジに含まれないため、フォールドが正解。`,
  ].filter((line): line is string => line !== null && line.length > 0);

  return {
    id: `preflop:${position}:${handClass}`,
    category: 'preflop',
    prompt: {
      title: 'プリフロップ判断',
      situation: [`6-max 100BB。あなたより前の全員がフォールドし、${position}のあなたの番になった。`],
      hand: [card1, card2],
      position,
    },
    choices: [
      { id: 'raise', label: 'レイズ' },
      { id: 'fold', label: 'フォールド' },
    ],
    correctChoiceId: inRange ? 'raise' : 'fold',
    explanation: explanationLines,
  };
}

/** プリフロップ問題をランダム生成する。レンジ境界付近のハンドを出やすくする。 */
export function samplePreflopQuestion(rng: () => number): Question {
  const position = pickRandom(RFI_POSITIONS, rng);
  const boundary = Array.from(getBoundarySet(position));
  const handClass = pickWeighted(ALL_HAND_CLASSES, boundary, DEFAULT_BOUNDARY_WEIGHT, rng);
  return buildPreflopQuestion(position, handClass, rng);
}
