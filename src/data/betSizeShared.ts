// ============================================================
// ベットサイズ問題の共通ユーティリティ
//
// BB=100点として金額を表現する（例: 250点 = 2.5BB）。
// 選択肢ラベルの組み立てなど、4サブタイプ共通の処理をまとめる。
// ============================================================
import type { Choice } from '../types';

/** 点数（BB=100）をBB単位の表示用文字列に変換する。例: 250 → '2.5'、800 → '8' */
function formatBB(amount: number): string {
  const bb = amount / 100;
  return Number.isInteger(bb) ? String(bb) : bb.toFixed(1);
}

/** 金額の選択肢ラベルを組み立てる。例: 250 → '250（2.5BB）' */
export function amountLabel(amount: number): string {
  return `${amount}（${formatBB(amount)}BB）`;
}

/** 金額から選択肢オブジェクトを作る。idは金額の文字列表現（正解判定・SRSキーの一部）。 */
export function amountChoice(amount: number): Choice {
  return { id: String(amount), label: amountLabel(amount) };
}

/**
 * 複数の金額候補から選択肢配列を作る。重複した金額は1つにまとめる
 * （呼び出し側は4つの金額が互いに異なることを保証する責務を持つ）。
 */
export function buildAmountChoices(amounts: readonly number[]): readonly Choice[] {
  const uniqueAmounts = Array.from(new Set(amounts));
  return uniqueAmounts.map(amountChoice);
}
