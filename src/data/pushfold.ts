// ============================================================
// プッシュ/フォールド（トーナメント）レンジ
//
// 前に誰も参加していない状況でのオールインレンジ（簡略Nash近似）。
// スタックは 5/10/15BB、ポジションは SB / BTN のみを対象とする。
// 表の文字列そのものが「唯一の正」であり、他の場所にハードコードしない。
// ============================================================
import { parseRange } from './handNotation';

export type PushFoldPosition = 'SB' | 'BTN';
export type StackBB = 5 | 10 | 15;

export const PUSHFOLD_POSITIONS: readonly PushFoldPosition[] = ['SB', 'BTN'];
export const PUSHFOLD_STACKS: readonly StackBB[] = [5, 10, 15];

const PUSH_NOTATION: Readonly<Record<PushFoldPosition, Readonly<Record<StackBB, string>>>> = {
  SB: {
    5: '22+, A2s+, A2o+, K2s+, K2o+, Q2s+, Q4o+, J4s+, J7o+, T6s+, T8o+, 96s+, 98o, 85s+, 87o, 75s+, 64s+, 54s',
    10: '22+, A2s+, A2o+, K2s+, K7o+, Q5s+, Q9o+, J7s+, J9o+, T7s+, T9o, 97s+, 86s+, 76s, 65s',
    15: '22+, A2s+, A5o+, K7s+, KTo+, Q8s+, QJo, J8s+, JTo, T8s+, 98s, 87s',
  },
  BTN: {
    5: '22+, A2s+, A2o+, K2s+, K5o+, Q4s+, Q8o+, J6s+, J9o+, T6s+, T9o, 96s+, 86s+, 76s, 65s',
    10: '22+, A2s+, A4o+, K5s+, K9o+, Q8s+, QTo+, J8s+, JTo, T7s+, 97s+, 87s, 76s',
    15: '22+, A2s+, A7o+, K9s+, KJo+, Q9s+, QJo, J9s+, JTo, T8s+, 98s, 87s',
  },
};

/** スタックの深さに応じた戦略原則（解説文で使用）。 */
export const STACK_PRINCIPLE: Readonly<Record<StackBB, string>> = {
  5: '5BBは極めて浅いスタック。相手がコールを避けてフォールドすれば、ハンドの強さに関係なくその場でポットを獲得できる（この「相手をフォールドさせることで得る価値」をフォールドエクイティと呼ぶ）。相手にコールされたときの勝率よりも、このフォールドエクイティの価値が非常に大きく、かなり広いレンジでのオールインが正解になる。',
  10: '10BBはまだ浅いスタックだが5BBよりは少し引き締める。依然としてフォールドエクイティ（相手をフォールドさせることで得る価値）を重視した広めのプッシュレンジが基本方針。',
  15: '15BBはこの中では最も深く、コールされた際のハンドの勝率が相対的に重要になるため、プッシュレンジはより絞られる。',
};

function buildRangeTable(): ReadonlyMap<PushFoldPosition, ReadonlyMap<StackBB, ReadonlySet<string>>> {
  const entries = PUSHFOLD_POSITIONS.map((position) => {
    const stackEntries = PUSHFOLD_STACKS.map(
      (stackBB) => [stackBB, parseRange(PUSH_NOTATION[position][stackBB])] as const,
    );
    return [position, new Map(stackEntries)] as const;
  });
  return new Map(entries);
}

const PUSH_RANGES = buildRangeTable();

/** 指定ポジション・スタックのプッシュレンジに、指定ハンドクラスが含まれるか判定する。 */
export function shouldPush(position: PushFoldPosition, stackBB: StackBB, handClass: string): boolean {
  return PUSH_RANGES.get(position)?.get(stackBB)?.has(handClass) ?? false;
}

/** 解説表示用に、ポジション・スタックのプッシュレンジ表記全文を返す。 */
export function getPushNotation(position: PushFoldPosition, stackBB: StackBB): string {
  return PUSH_NOTATION[position][stackBB];
}
