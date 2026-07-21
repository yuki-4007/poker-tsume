// ============================================================
// ベットサイズ問題 - オープンレイズ額 / リンパーがいる場合
//
// セオリー（この規則が唯一の正）:
//   - オープンレイズの標準サイズは2.5BB（250点）
//   - リンパーがいる場合は「3BB + リンパー1人につき+1BB」
// ハンドはそのポジションのオープンレンジ（ranges.ts）からサンプリングする。
// ============================================================
import type { Position, Question } from '../types';
import { ALL_HAND_CLASSES, isValidHandClass } from './handGrid';
import { randomCardsForClass } from './handNotation';
import { getPositionPrinciple, getRfiNotation, isInOpenRange, RFI_POSITIONS } from './ranges';
import { buildAmountChoices } from './betSizeShared';
import { pickRandom } from './rngUtils';

/** オープンレイズの標準サイズ（点）。 */
const STANDARD_OPEN_AMOUNT = 250;
/** リンパーがいる場合の基準サイズ（点）。ここに人数分を加算する。 */
const LIMP_BASE_AMOUNT = 300;
/** リンパー1人あたりの加算額（点）。 */
const LIMP_PER_PLAYER = 100;
/** オーバーサイズ誤答の加算額（点）。 */
const LIMP_OVERSIZE_ADD = 300;

/** 出題対象のリンパー人数。 */
export const LIMPER_COUNTS: readonly number[] = [1, 2];

/** ID からの決定的再構築時に使う固定rng（スートは常に同じ組み合わせを選ぶ）。 */
function fixedRng(): number {
  return 0;
}

/** 指定ポジションのオープンレンジに含まれるハンドクラス一覧。 */
function rangeHandClasses(position: Position): readonly string[] {
  return ALL_HAND_CLASSES.filter((handClass) => isInOpenRange(position, handClass));
}

function isValidRangeHand(position: Position, handClass: string): boolean {
  return isValidHandClass(handClass) && isInOpenRange(position, handClass);
}

/**
 * オープンレイズ額問題を組み立てる。
 * rng を省略すると、決定的なスート選択（ID再構築向け）になる。
 */
export function buildOpenRaiseQuestion(position: Position, handClass: string, rng: () => number = fixedRng): Question {
  if (!isValidRangeHand(position, handClass)) {
    throw new Error(`不正なオープンレンジハンドです: ${position} ${handClass}`);
  }
  const [card1, card2] = randomCardsForClass(handClass, rng);
  const notation = getRfiNotation(position);
  const principle = getPositionPrinciple(position);

  return {
    id: `betsize:open:${position}:${handClass}`,
    category: 'betsize',
    prompt: {
      title: 'ベットサイズ：オープンレイズ額',
      situation: [
        'BB=100点。あなたより前の全員がフォールドし、あなたの番になった。',
        `${position}のあなたが最初にレイズするなら、いくらにするのが適切か？`,
      ],
      hand: [card1, card2],
      position,
    },
    choices: buildAmountChoices([STANDARD_OPEN_AMOUNT, 100, 400, 800]),
    correctChoiceId: String(STANDARD_OPEN_AMOUNT),
    explanation: [
      'オープンレイズの標準サイズは2.5BB（250点）が基準。',
      principle,
      '小さすぎるレイズ（1BBのリンプ相当）は相手に安いオッズを与えてしまい入ってきやすくなる。逆に大きすぎるレイズはリスクが増えるだけでリターンが見合わない。',
      notation !== null ? `${position}の簡略オープンレンジ: ${notation}` : null,
    ].filter((line): line is string => line !== null && line.length > 0),
  };
}

/** オープンレイズ額問題をランダム生成する。 */
export function sampleOpenRaiseQuestion(rng: () => number): Question {
  const position = pickRandom(RFI_POSITIONS, rng);
  const handClasses = rangeHandClasses(position);
  const handClass = pickRandom(handClasses, rng);
  return buildOpenRaiseQuestion(position, handClass, rng);
}

/**
 * リンパーがいる場合のレイズ額問題を組み立てる。
 * rng を省略すると、決定的なスート選択（ID再構築向け）になる。
 */
export function buildLimpQuestion(
  position: Position,
  handClass: string,
  limpers: number,
  rng: () => number = fixedRng,
): Question {
  if (!isValidRangeHand(position, handClass)) {
    throw new Error(`不正なオープンレンジハンドです: ${position} ${handClass}`);
  }
  if (!LIMPER_COUNTS.includes(limpers)) {
    throw new Error(`不正なリンパー人数です: ${limpers}`);
  }
  const [card1, card2] = randomCardsForClass(handClass, rng);
  const correctAmount = LIMP_BASE_AMOUNT + LIMP_PER_PLAYER * limpers;
  const otherLimpers = limpers === 1 ? 2 : 1;
  const wrongCountAmount = LIMP_BASE_AMOUNT + LIMP_PER_PLAYER * otherLimpers;
  const oversizeAmount = correctAmount + LIMP_OVERSIZE_ADD;

  return {
    id: `betsize:limp:${position}:${handClass}:${limpers}`,
    category: 'betsize',
    prompt: {
      title: 'ベットサイズ：リンパーがいる場合',
      situation: [
        'BB=100点。あなたの前に' + String(limpers) + '人がリンプ（コール）してきた。',
        `${position}のあなたがレイズ（アイソレーション）するなら、いくらが適切か？`,
      ],
      hand: [card1, card2],
      position,
    },
    choices: buildAmountChoices([correctAmount, STANDARD_OPEN_AMOUNT, wrongCountAmount, oversizeAmount]),
    correctChoiceId: String(correctAmount),
    explanation: [
      'リンパーがいる場合のセオリーは「3BB＋リンパー1人につき+1BB」。',
      `リンパー${limpers}人なので、3BB + ${limpers}BB = ${correctAmount / 100}BB（${correctAmount}点）。`,
      'リンパーの人数分だけポットに参加する人数が増え、勝つために必要なハンドの強さの期待値も上がるため、通常のオープンより大きくレイズしてポットを大きくし、複数人に安いコールで参加されないようにする。',
    ],
  };
}

/** リンパーがいる場合のレイズ額問題をランダム生成する。 */
export function sampleLimpQuestion(rng: () => number): Question {
  const position = pickRandom(RFI_POSITIONS, rng);
  const handClasses = rangeHandClasses(position);
  const handClass = pickRandom(handClasses, rng);
  const limpers = pickRandom(LIMPER_COUNTS, rng);
  return buildLimpQuestion(position, handClass, limpers, rng);
}
