// ============================================================
// ベットサイズ問題 - 3ベット額
//
// セオリー（この規則が唯一の正）:
//   相手のオープン（2.5BB または 3BB）に対し、
//   IP（ポジション有利）なら3倍、OOP（ポジション不利）なら4倍。
// ハンドは QQ+/AK など明確な3ベットハンドのみを使う（境界ハンドは使わず、
// サイズの学習に集中させる）。
// ============================================================
import type { Position, Question } from '../types';
import { isValidHandClass } from './handGrid';
import { randomCardsForClass } from './handNotation';
import { buildAmountChoices } from './betSizeShared';
import { pickRandom } from './rngUtils';

export type ThreeBetPosture = 'ip' | 'oop';

/** 3ベットハンド候補（境界ハンドを避け、明確に3ベットすべきハンドのみ）。 */
export const THREE_BET_HAND_CLASSES: readonly string[] = ['AA', 'KK', 'QQ', 'AKs', 'AKo'];

/** IP（ポジション有利）側の3ベッターになりうるポジション。相手は必ずそれより前のポジション。 */
const IP_POSITIONS: readonly Position[] = ['HJ', 'CO', 'BTN'];
/** OOP（ポジション不利）側の3ベッターになりうるポジション。 */
const OOP_POSITIONS: readonly Position[] = ['SB', 'BB'];

const THREE_BET_POSITIONS: readonly Position[] = [...IP_POSITIONS, ...OOP_POSITIONS];

/** 相手のオープンサイズ候補（点）。2.5BB または 3BB。 */
export const THREE_BET_OPEN_SIZES: readonly number[] = [250, 300];

const IP_MULTIPLIER = 3;
const OOP_MULTIPLIER = 4;
const TOO_SMALL_MULTIPLIER = 2;
const OVERSIZE_MULTIPLIER = 6;

/** ID からの決定的再構築時に使う固定rng（スートは常に同じ組み合わせを選ぶ）。 */
function fixedRng(): number {
  return 0;
}

/** ポジション文字列が3ベット問題の対象ポジションかどうかを判定する（Positionへの型ガード）。 */
export function isThreeBetPositionStr(value: string): value is Position {
  return (THREE_BET_POSITIONS as readonly string[]).includes(value);
}

/** ポジションからIP/OOPを決定する。対象外ポジションは null。 */
function postureOf(position: Position): ThreeBetPosture | null {
  if (IP_POSITIONS.includes(position)) {
    return 'ip';
  }
  if (OOP_POSITIONS.includes(position)) {
    return 'oop';
  }
  return null;
}

function multiplierFor(posture: ThreeBetPosture): number {
  return posture === 'ip' ? IP_MULTIPLIER : OOP_MULTIPLIER;
}

/**
 * 3ベット額問題を組み立てる。position と posture（IP/OOP）の整合性はここで検証する
 * （3ベッターのポジションからIP/OOPは一意に決まるため）。
 * rng を省略すると、決定的なスート選択（ID再構築向け）になる。
 */
export function build3BetQuestion(
  position: Position,
  handClass: string,
  openSize: number,
  posture: ThreeBetPosture,
  rng: () => number = fixedRng,
): Question {
  if (!isValidHandClass(handClass) || !THREE_BET_HAND_CLASSES.includes(handClass)) {
    throw new Error(`不正な3ベットハンドです: "${handClass}"`);
  }
  if (!THREE_BET_OPEN_SIZES.includes(openSize)) {
    throw new Error(`不正なオープンサイズです: ${openSize}`);
  }
  const expectedPosture = postureOf(position);
  if (expectedPosture === null || expectedPosture !== posture) {
    throw new Error(`ポジションとIP/OOPの整合性が不正です: ${position} ${posture}`);
  }

  const [card1, card2] = randomCardsForClass(handClass, rng);
  const correctAmount = openSize * multiplierFor(posture);
  const otherPostureAmount = openSize * multiplierFor(posture === 'ip' ? 'oop' : 'ip');
  const tooSmallAmount = openSize * TOO_SMALL_MULTIPLIER;
  const oversizeAmount = openSize * OVERSIZE_MULTIPLIER;

  const postureLabel = posture === 'ip' ? 'ポジション有利（IP）' : 'ポジション不利（OOP）';

  return {
    id: `betsize:3bet:${position}:${handClass}:${openSize}:${posture}`,
    category: 'betsize',
    prompt: {
      title: 'ベットサイズ：3ベット額',
      situation: [
        `BB=100点。前のポジションの相手が${openSize}点（${openSize / 100}BB）でオープンレイズしてきた。`,
        `${position}のあなたはこの相手に対して${postureLabel}の状況。3ベットするならいくらが適切か？`,
      ],
      hand: [card1, card2],
      position,
    },
    choices: buildAmountChoices([correctAmount, otherPostureAmount, tooSmallAmount, oversizeAmount]),
    correctChoiceId: String(correctAmount),
    explanation: [
      '3ベットの基準は、相手のオープン額に対してIPなら3倍、OOPなら4倍。',
      `今回は相手のオープン${openSize / 100}BBに対して${posture === 'ip' ? '3倍' : '4倍'}なので、${correctAmount / 100}BB（${correctAmount}点）が正解。`,
      posture === 'ip'
        ? 'IPはポストフロップで相手より後に行動できて有利なため、3倍程度のサイズでも相手のコール参加を十分に抑えられる。'
        : 'OOPは相手より先に行動しなければならず不利なため、大きめの4倍にして相手の参加率を下げ、不利な状況で複雑な判断を迫られる回数を減らす。',
    ],
  };
}

/** 3ベット額問題をランダム生成する。 */
export function sample3BetQuestion(rng: () => number): Question {
  const posture = pickRandom(['ip', 'oop'] as const, rng);
  const position = pickRandom(posture === 'ip' ? IP_POSITIONS : OOP_POSITIONS, rng);
  const handClass = pickRandom(THREE_BET_HAND_CLASSES, rng);
  const openSize = pickRandom(THREE_BET_OPEN_SIZES, rng);
  return build3BetQuestion(position, handClass, openSize, posture, rng);
}
