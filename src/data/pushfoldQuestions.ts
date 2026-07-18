// ============================================================
// プッシュ/フォールド判断問題の生成
//
// ポジション×スタック×ハンドをランダムに選び、レンジ境界付近が
// 出やすいよう重み付けサンプリングする。preflopQuestions.ts と対になる構造。
// ============================================================
import type { Question } from '../types';
import { ALL_HAND_CLASSES, computeBoundarySet, isValidHandClass } from './handGrid';
import { randomCardsForClass } from './handNotation';
import {
  getPushNotation,
  PUSHFOLD_POSITIONS,
  PUSHFOLD_STACKS,
  shouldPush,
  STACK_PRINCIPLE,
  type PushFoldPosition,
  type StackBB,
} from './pushfold';
import { DEFAULT_BOUNDARY_WEIGHT, pickRandom, pickWeighted } from './rngUtils';

function cacheKey(position: PushFoldPosition, stackBB: StackBB): string {
  return `${position}:${stackBB}`;
}

const boundaryCache = new Map<string, ReadonlySet<string>>();

function getBoundarySet(position: PushFoldPosition, stackBB: StackBB): ReadonlySet<string> {
  const key = cacheKey(position, stackBB);
  const cached = boundaryCache.get(key);
  if (cached) {
    return cached;
  }
  const boundary = computeBoundarySet((handClass) => shouldPush(position, stackBB, handClass));
  boundaryCache.set(key, boundary);
  return boundary;
}

/** ID からの決定的再構築時に使う固定rng（スートは常に同じ組み合わせを選ぶ）。 */
function fixedRng(): number {
  return 0;
}

/**
 * プッシュ/フォールド判断問題を組み立てる。
 * rng を省略すると、決定的なスート選択（ID再構築向け）になる。
 */
export function buildPushFoldQuestion(
  position: PushFoldPosition,
  stackBB: StackBB,
  handClass: string,
  rng: () => number = fixedRng,
): Question {
  if (!isValidHandClass(handClass)) {
    throw new Error(`不正なハンドクラスです: "${handClass}"`);
  }

  const push = shouldPush(position, stackBB, handClass);
  const [card1, card2] = randomCardsForClass(handClass, rng);
  const notation = getPushNotation(position, stackBB);

  return {
    id: `pushfold:${position}:${stackBB}:${handClass}`,
    category: 'pushfold',
    prompt: {
      title: 'プッシュ/フォールド判断',
      situation: [
        `トーナメント。${position}まで全員フォールドし、有効スタック${stackBB}BB（この勝負で実際に賭けられるチップ量）のあなたの番。`,
        'この局面はオープンプッシュ（オールイン）かフォールドの2択のみで考える。',
      ],
      hand: [card1, card2],
      position,
      stackBB,
    },
    choices: [
      { id: 'push', label: 'プッシュ（オールイン）' },
      { id: 'fold', label: 'フォールド' },
    ],
    correctChoiceId: push ? 'push' : 'fold',
    explanation: [
      STACK_PRINCIPLE[stackBB],
      `${position} ${stackBB}BBの簡略プッシュレンジ: ${notation}`,
      push
        ? `${handClass} はこのレンジに含まれるため、オールインが正解。`
        : `${handClass} はこのレンジに含まれないため、フォールドが正解。`,
    ],
  };
}

/** プッシュ/フォールド問題をランダム生成する。レンジ境界付近のハンドを出やすくする。 */
export function samplePushFoldQuestion(rng: () => number): Question {
  const position = pickRandom(PUSHFOLD_POSITIONS, rng);
  const stackBB = pickRandom(PUSHFOLD_STACKS, rng);
  const boundary = Array.from(getBoundarySet(position, stackBB));
  const handClass = pickWeighted(ALL_HAND_CLASSES, boundary, DEFAULT_BOUNDARY_WEIGHT, rng);
  return buildPushFoldQuestion(position, stackBB, handClass, rng);
}
