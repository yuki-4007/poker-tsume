// ============================================================
// オッズ計算問題ジェネレータ
//
// 1) 必要勝率問題: ポットP（コール前・相手のベット込み）とコール額Cから
//    必要勝率 = C / (P + C) を問う。
// 2) アウツ→勝率問題（2-4ルール）: よくあるドローのアウツ数と、
//    フロップ時点（×4%）/ ターン時点（×2%）の組み合わせを問う。
//
// P/C・アウツの組み合わせは有限のきれいな数字のリストから生成し、
// ID から決定的に再構築できるようにする。
// ============================================================
import type { Choice, Question } from '../types';

// ------------------------------------------------------------
// 必要勝率問題
// ------------------------------------------------------------

interface OddsReqPattern {
  readonly pot: number;
  readonly call: number;
}

/**
 * ベットサイズの比率（コール額 ÷ ポット額）。
 * 必要勝率 = call / (pot + call) = ratio / (1 + ratio) となるため、
 * 以下の比率はそれぞれ 20% / 25% / 33.3% / 40% ちょうどに収まるよう選定している。
 * （1倍・1.5倍ポットのオーバーベットは call >= pot となり必要勝率50%/60%相当だが、
 *   buildOddsReqQuestion の call < pot 制約と両立しないため対象外とした）
 */
interface BetRatio {
  readonly num: number;
  readonly den: number;
}

const BET_RATIOS: readonly BetRatio[] = [
  { num: 1, den: 4 }, // 1/4ポットベット → 必要勝率20%
  { num: 1, den: 3 }, // 1/3ポットベット → 必要勝率25%
  { num: 1, den: 2 }, // 1/2ポットベット → 必要勝率33.3%
  { num: 2, den: 3 }, // 2/3ポットベット → 必要勝率40%
];

/**
 * ポット基準額。600の倍数にすることで、上記すべての比率でコール額が
 * 整数かつ50の倍数になる（600 = lcm(4,3,2) × 50 の倍数）。
 */
const POT_BASES: readonly number[] = Array.from({ length: 24 }, (_, i) => (i + 1) * 600);

/**
 * 比率テーブル × ポット基準額を総当たりし、コール額が整数かつ50の倍数になる
 * 組み合わせのみを列挙する。同じ問題が固定18パターンに限られていた旧実装に比べ、
 * 出題空間を大幅に広げて「暗記で解ける」状態を防ぐ。
 */
function generateOddsReqPatterns(): readonly OddsReqPattern[] {
  const patterns: OddsReqPattern[] = [];
  for (const ratio of BET_RATIOS) {
    for (const pot of POT_BASES) {
      const call = (pot * ratio.num) / ratio.den;
      if (!Number.isInteger(call) || call <= 0 || call % 50 !== 0 || call >= pot) {
        continue;
      }
      patterns.push({ pot, call });
    }
  }
  return patterns;
}

/** ポット（コール前・相手ベット込みの総額）とコール額の組み合わせ。きれいな数字で構成。 */
export const ODDS_REQ_PATTERNS: readonly OddsReqPattern[] = generateOddsReqPatterns();

// ------------------------------------------------------------
// アウツ→勝率問題
// ------------------------------------------------------------

export type Timing = 'flop' | 'turn';

interface OutsPattern {
  readonly outs: number;
  readonly label: string;
  readonly description: string;
}

const TIMING_MULTIPLIER: Readonly<Record<Timing, number>> = { flop: 4, turn: 2 };
const TIMING_LABEL: Readonly<Record<Timing, string>> = {
  flop: 'フロップ（残り2枚見える）',
  turn: 'ターン（残り1枚見える）',
};

/** 実用的なドローのアウツ数パターン。outs は各パターンでユニーク（IDのキーになるため）。 */
export const OUTS_PATTERNS: readonly OutsPattern[] = [
  {
    outs: 2,
    label: '下位ポケットペア → セット',
    description: '手持ちのポケットペアが3枚目の同ランクでセットになるアウツ（残り2枚）。',
  },
  {
    outs: 3,
    label: 'オーバーカード1枚（同ランクがボードに1枚露出）',
    description:
      '手札の片方のランクがヒットすればトップペア完成。ただし同ランクの1枚がすでにボードにあるため、残りアウツは3枚。',
  },
  {
    outs: 4,
    label: 'ガットショットストレートドロー（中抜けドロー）',
    description: '中抜けの1ランクが埋まればストレートが完成する（そのランクの残り4枚）。',
  },
  {
    outs: 6,
    label: 'オーバーカード2枚',
    description: '手札2枚がボードより高いランクで、どちらかが当たればトップペアが完成する。',
  },
  {
    outs: 8,
    label: 'オープンエンドストレートドロー（OESD）',
    description: '両端どちらのランクが来てもストレートが完成する。',
  },
  {
    outs: 9,
    label: 'フラッシュドロー',
    description: '同スート4枚を保持しており、5枚目の同スートでフラッシュが完成する。',
  },
  {
    outs: 10,
    label: 'OESD + オーバーカード1枚（コンボドロー）',
    description:
      'オープンエンドストレートドローの8アウツに、もう一方の手札がヒットすればトップペアになるオーバーカードの2アウツを合算（重複なし）。',
  },
  {
    outs: 11,
    label: 'フラッシュドロー + オーバーカード1枚（コンボドロー）',
    description:
      'フラッシュの9アウツに、もう一方の手札がヒットすればトップペアになるオーバーカードの2アウツを合算（同ランクの1枚が既にボードにあるため2アウツ）。',
  },
  {
    outs: 12,
    label: 'フラッシュドロー + ガットショット',
    description: 'フラッシュの9アウツとガットショットの4アウツを合算（重複1枚を除く）したコンボドロー。',
  },
  {
    outs: 15,
    label: 'フラッシュドロー + OESD（コンボドロー）',
    description: 'フラッシュの9アウツとOESDの8アウツを合算（重複2枚を除く）した強力なコンボドロー。',
  },
];

export function findOutsPattern(outs: number): OutsPattern | undefined {
  return OUTS_PATTERNS.find((pattern) => pattern.outs === outs);
}

export function isValidTiming(value: string): value is Timing {
  return value === 'flop' || value === 'turn';
}

// ------------------------------------------------------------
// 選択肢（%表示）の共通ビルダー
// ------------------------------------------------------------

function formatPercent(ratio: number): string {
  const rounded = Math.round(ratio * 1000) / 10; // 小数点1桁までの%
  return `${rounded}%`;
}

function parsePercentLabel(label: string): number {
  return Number(label.replace('%', ''));
}

function clampRatio(ratio: number): number {
  return Math.min(0.99, Math.max(0.01, ratio));
}

/** 正解の比率(0-1)と誤答候補の比率から、重複のない4択（%表示、値の昇順）を作る。 */
function buildPercentChoices(
  correctRatio: number,
  wrongRatioCandidates: readonly number[],
): { choices: readonly Choice[]; correctChoiceId: string } {
  const correctLabel = formatPercent(correctRatio);
  const usedLabels = new Set<string>([correctLabel]);
  const wrongLabels: string[] = [];

  for (const candidate of wrongRatioCandidates) {
    if (wrongLabels.length >= 3) break;
    if (candidate <= 0 || candidate >= 1) continue;
    const label = formatPercent(candidate);
    if (usedLabels.has(label)) continue;
    usedLabels.add(label);
    wrongLabels.push(label);
  }

  let offsetPoints = 5;
  while (wrongLabels.length < 3) {
    const upLabel = formatPercent(clampRatio(correctRatio + offsetPoints / 100));
    const downLabel = formatPercent(clampRatio(correctRatio - offsetPoints / 100));
    for (const label of [upLabel, downLabel]) {
      if (wrongLabels.length >= 3) break;
      if (usedLabels.has(label)) continue;
      usedLabels.add(label);
      wrongLabels.push(label);
    }
    offsetPoints += 5;
    if (offsetPoints > 500) {
      throw new Error('選択肢の生成に失敗しました（内部エラー）');
    }
  }

  const sortedLabels = [correctLabel, ...wrongLabels].sort((a, b) => parsePercentLabel(a) - parsePercentLabel(b));
  const choices: Choice[] = sortedLabels.map((label) => ({ id: label, label }));
  return { choices, correctChoiceId: correctLabel };
}

// ------------------------------------------------------------
// Question 組み立て
// ------------------------------------------------------------

/** 必要勝率問題を組み立てる。pot/call が不正な場合は throw（buildQuestionFromId 側で事前検証する想定）。 */
export function buildOddsReqQuestion(pot: number, call: number): Question {
  if (!Number.isInteger(pot) || !Number.isInteger(call) || pot <= 0 || call <= 0 || call >= pot) {
    throw new Error(`不正なオッズ(必要勝率)パラメータです: pot=${pot}, call=${call}`);
  }

  const correctRatio = call / (pot + call);
  const wrongCandidates = [call / pot, call / (pot + 2 * call), call / (pot - call)];
  const { choices, correctChoiceId } = buildPercentChoices(correctRatio, wrongCandidates);

  return {
    id: `odds:req:${pot}:${call}`,
    category: 'odds',
    prompt: {
      title: 'オッズ計算（必要勝率）',
      situation: [
        `ポット（相手のベットを含む、コール前の総額）: ${pot}`,
        `コールに必要な金額: ${call}`,
        'コールするために最低限必要な勝率は何%か？',
      ],
    },
    choices,
    correctChoiceId,
    explanation: [
      `必要勝率 = コール額 ÷ (ポット + コール額) = ${call} ÷ (${pot} + ${call}) = ${correctChoiceId}`,
      `ポット${pot}には相手のベット${call}が既に含まれており、コール後の総ポットは${pot + call}になる。`,
      'ハンドの勝率がこの必要勝率を上回っていれば、コールは長期的にプラス期待値（+EV）になる。',
    ],
  };
}

/** アウツ→勝率問題を組み立てる。outs が未定義のパターンや timing が不正な場合は throw。 */
export function buildOddsOutsQuestion(outs: number, timing: Timing): Question {
  const pattern = findOutsPattern(outs);
  if (!pattern) {
    throw new Error(`未対応のアウツ数です: ${outs}`);
  }

  const multiplier = TIMING_MULTIPLIER[timing];
  const otherMultiplier = timing === 'flop' ? TIMING_MULTIPLIER.turn : TIMING_MULTIPLIER.flop;
  const remainingCards = timing === 'flop' ? 47 : 46;
  const correctRatio = clampRatio((pattern.outs * multiplier) / 100);
  const wrongCandidates = [
    (pattern.outs * otherMultiplier) / 100,
    (Math.max(pattern.outs - 2, 1) * multiplier) / 100,
    ((pattern.outs + 2) * multiplier) / 100,
  ];
  const { choices, correctChoiceId } = buildPercentChoices(correctRatio, wrongCandidates);

  return {
    id: `odds:outs:${outs}:${timing}`,
    category: 'odds',
    prompt: {
      title: 'オッズ計算（アウツ→勝率）',
      situation: [
        `ドローの種類: ${pattern.label}（アウツ ${outs}枚）`,
        pattern.description,
        `${TIMING_LABEL[timing]}時点で、次のカードで完成する確率の概算（2-4ルール）は？`,
      ],
    },
    choices,
    correctChoiceId,
    explanation: [
      `見えていないカードは残り約${remainingCards}枚（${TIMING_LABEL[timing]}時点）。1枚でアウツを引く確率は約2%（1÷${remainingCards}≒2%）。`,
      'フロップ時点はターン・リバーの2枚分のチャンスがあるため約2倍の「アウツ数×4%」、ターン時点は残りリバー1枚のみなので「アウツ数×2%」（これが2-4ルール）。',
      `${outs} × ${multiplier}% = ${correctChoiceId}`,
      `${pattern.label}: ${pattern.description}`,
    ],
  };
}
