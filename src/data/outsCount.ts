// ============================================================
// アウツカウント問題の生成
//
// 手札2枚＋フロップ3枚を毎回ランダムな実カードで生成する
// （カードの組み合わせが毎回変わるため、実質無限のバリエーションになる）。
// 局面の候補生成とテンプレート判定は outsTemplates.ts / outsEval.ts に委ね、
// このファイルは Question（選択肢・解説）の組み立てと ID の符号化／復号を担当する。
//
// ID形式: 'outscount:<手札2枚>:<ボード3枚>'  例: 'outscount:AsKs:Qs7s2h'
// カードは強い順（同ランクはスート s>h>d>c 順）に正規化して並べる。
// buildOutsCountQuestionFromId はIDからカードを復元し、classifyOuts で
// 同じアウツ数を再計算して同一問題を再構築する（不正IDは null）。
// ============================================================
import type { CardStr, Choice, Question, Rank, Suit } from '../types';
import { classifyOuts, type OutsClassification, SUITS } from './outsEval';
import { generateRandomOutsScenario } from './outsTemplates';

// ------------------------------------------------------------
// 選択肢の組み立て
// ------------------------------------------------------------

const OUTS_POOL: readonly number[] = [2, 4, 6, 8, 9, 12, 15];

function buildOutsChoices(correct: number): { choices: readonly Choice[]; correctChoiceId: string } {
  if (!OUTS_POOL.includes(correct)) {
    throw new Error(`未対応のアウツ数です: ${correct}`);
  }
  const wrongs = OUTS_POOL.filter((v) => v !== correct)
    .map((v) => ({ v, dist: Math.abs(v - correct) }))
    .sort((a, b) => a.dist - b.dist || a.v - b.v)
    .slice(0, 3)
    .map((entry) => entry.v);
  const values = [correct, ...wrongs].sort((a, b) => a - b);
  const choices: Choice[] = values.map((v) => ({ id: String(v), label: `${v}枚` }));
  return { choices, correctChoiceId: String(correct) };
}

// ------------------------------------------------------------
// 解説の組み立て
// ------------------------------------------------------------

const SUIT_LABEL: Readonly<Record<Suit, string>> = {
  s: '♠(スペード)',
  h: '♡(ハート)',
  d: '♦(ダイヤ)',
  c: '♣(クラブ)',
};

function joinRanks(ranks: readonly Rank[]): string {
  return ranks.join('と');
}

function flopPercent(outs: number): string {
  return `${outs * 4}%`; // 2-4ルール（フロップ時点は×4%）
}

function buildExplanation(classification: OutsClassification): string[] {
  const { kind, outs, flushSuit, straightRanks, pocketRank, overcardRanks } = classification;

  switch (kind) {
    case 'flush': {
      const suit = flushSuit;
      if (!suit) throw new Error('内部エラー: フラッシュ判定にスート情報がありません');
      return [
        `${SUIT_LABEL[suit]}のフラッシュドロー: 手札とボードを合わせて同スートが4枚見えている。`,
        `${SUIT_LABEL[suit]}は全部で13枚あるので、残りは 13-4=9枚 がアウツ。`,
        `フロップ時点なので2-4ルールにより 9 × 4% = ${flopPercent(outs)} で完成する計算になる。`,
      ];
    }
    case 'oesd':
      return [
        `オープンエンドストレートドロー(OESD): 4連続のランクを持っており、${joinRanks(straightRanks)}のどちらが来てもストレートが完成する。`,
        `完成させるランクは2種類、それぞれ残り4枚ずつ見えていないので 4+4=8枚 がアウツ。`,
        `フロップ時点なので 8 × 4% = ${flopPercent(outs)} で完成する計算になる。`,
      ];
    case 'gutshot': {
      const gap = straightRanks[0];
      if (gap === undefined) throw new Error('内部エラー: ガットショット判定に完成ランクがありません');
      return [
        `ガットショット（中抜け）ストレートドロー: 中抜けの${gap}が入れば5連続のストレートが完成する。`,
        `${gap}は残り4枚見えていないので、アウツは4枚。`,
        `フロップ時点なので 4 × 4% = ${flopPercent(outs)} と完成率はやや低め。`,
      ];
    }
    case 'pocketPair': {
      const rank = pocketRank;
      if (!rank) throw new Error('内部エラー: ポケットペア判定にランク情報がありません');
      return [
        `ポケットペア(${rank}${rank})を持っており、ボードはオーバーカードを含む未ペア。フラッシュ・ストレートのドローも無い。`,
        `セット（スリーカード）になるには残りの${rank}が必要で、4-2(既知の2枚)=2枚がアウツ。`,
        `フロップ時点なので 2 × 4% = ${flopPercent(outs)} と完成率は低いが、ヒットすれば非常に強い手になる。`,
      ];
    }
    case 'overcards':
      return [
        `手札2枚(${joinRanks(overcardRanks)})はどちらもボードの最高ランクより上のオーバーカード。ペア・ドローは無い。`,
        `各ランクとも残り3枚ずつ見えていないので、トップペアが完成するアウツは 3+3=6枚。`,
        `フロップ時点なので 6 × 4% = ${flopPercent(outs)} でどちらかのランクがヒットする計算になる。`,
      ];
    case 'flushGutshot': {
      const suit = flushSuit;
      const gap = straightRanks[0];
      if (!suit || gap === undefined) throw new Error('内部エラー: コンボドロー判定の情報が不足しています');
      return [
        `${SUIT_LABEL[suit]}のフラッシュドロー(9枚)に加えて、中抜けの${gap}で完成するガットショット(4枚)も持つコンボドロー。`,
        `${gap}${suit}はフラッシュとガットショットの両方の完成カードとして重複するため、9+4-1=12枚がアウツ。`,
        `フロップ時点なので 12 × 4% = ${flopPercent(outs)} と非常に強いコンボドローになる。`,
      ];
    }
    case 'flushOesd': {
      const suit = flushSuit;
      if (!suit || straightRanks.length !== 2) throw new Error('内部エラー: コンボドロー判定の情報が不足しています');
      return [
        `${SUIT_LABEL[suit]}のフラッシュドロー(9枚)に加えて、${joinRanks(straightRanks)}で完成するオープンエンドストレートドロー(8枚)も持つ強力なコンボドロー。`,
        `完成ランクそれぞれの${suit}側1枚ずつがフラッシュとも重複するため、9+8-2=15枚がアウツ。`,
        `フロップ時点なので 15 × 4% = ${flopPercent(outs)} と、コイントス以上の強さになる。`,
      ];
    }
    default: {
      const exhaustiveCheck: never = kind;
      throw new Error(`未対応のテンプレートです: ${String(exhaustiveCheck)}`);
    }
  }
}

// ------------------------------------------------------------
// Question 組み立て
// ------------------------------------------------------------

function buildQuestion(
  hole: readonly [CardStr, CardStr],
  board: readonly CardStr[],
  classification: OutsClassification,
  id: string,
): Question {
  const { choices, correctChoiceId } = buildOutsChoices(classification.outs);
  return {
    id,
    category: 'outscount',
    prompt: {
      title: 'アウツを数える',
      situation: [
        'フロップまで進んだ。あなたの手札とボードは以下の通り。',
        '次の1枚（ターン）でハンドを強くする「アウツ」は何枚か？',
      ],
      hand: hole,
      board,
    },
    choices,
    correctChoiceId,
    explanation: buildExplanation(classification),
  };
}

function encodeId(hole: readonly [CardStr, CardStr], board: readonly CardStr[]): string {
  return `outscount:${hole.join('')}:${board.join('')}`;
}

/** アウツカウント問題をランダム生成する。テンプレートを等確率で選び、検証器で確認済みの局面のみ採用する。 */
export function sampleOutsCountQuestion(rng: () => number): Question {
  const { hole, board, classification } = generateRandomOutsScenario(rng);
  const id = encodeId(hole, board);
  return buildQuestion(hole, board, classification, id);
}

// ------------------------------------------------------------
// ID からの再構築
// ------------------------------------------------------------

function isValidRankChar(c: string): boolean {
  return /^[2-9TJQKA]$/.test(c);
}

function isValidSuitChar(c: string): c is Suit {
  return (SUITS as readonly string[]).includes(c);
}

/** 'AsKs' のような連結文字列を count 枚のカードにパースする。不正なら null。 */
function parseCardsString(s: string, count: number): CardStr[] | null {
  if (s.length !== count * 2) {
    return null;
  }
  const cards: CardStr[] = [];
  for (let i = 0; i < s.length; i += 2) {
    const rankChar = s[i];
    const suitChar = s[i + 1];
    if (rankChar === undefined || suitChar === undefined) {
      return null;
    }
    if (!isValidRankChar(rankChar) || !isValidSuitChar(suitChar)) {
      return null;
    }
    cards.push(`${rankChar}${suitChar}` as CardStr);
  }
  if (new Set(cards).size !== cards.length) {
    return null; // 重複カード
  }
  return cards;
}

/**
 * 'outscount:<手札2枚>:<ボード3枚>' 形式のIDからカードを復元し、classifyOuts で
 * アウツ数を再計算して同一問題を再構築する。形式不正・重複カード・
 * どのテンプレートにも一致しない場合は null（throwしない）。
 */
export function buildOutsCountQuestionFromId(id: string): Question | null {
  const segments = id.split(':');
  if (segments.length !== 3) {
    return null;
  }
  const [head, holeStr, boardStr] = segments;
  if (head !== 'outscount' || holeStr === undefined || boardStr === undefined) {
    return null;
  }
  const holeCards = parseCardsString(holeStr, 2);
  const boardCards = parseCardsString(boardStr, 3);
  if (!holeCards || !boardCards) {
    return null;
  }
  const h0 = holeCards[0];
  const h1 = holeCards[1];
  if (h0 === undefined || h1 === undefined) {
    return null;
  }
  const allCards = [...holeCards, ...boardCards];
  if (new Set(allCards).size !== allCards.length) {
    return null; // 手札・ボード間の重複
  }

  const hole: [CardStr, CardStr] = [h0, h1];
  const classification = classifyOuts(hole, boardCards);
  if (!classification) {
    return null;
  }
  return buildQuestion(hole, boardCards, classification, id);
}
