// ============================================================
// 詰めポーカー 共通型定義とモジュール間契約
//
// このファイルは全モジュール（data / learning / ui）の共有契約。
// 変更する場合は3モジュールすべての整合を確認すること。
// ============================================================

export type Rank =
  | 'A' | 'K' | 'Q' | 'J' | 'T'
  | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';

export type Suit = 's' | 'h' | 'd' | 'c';

/** カード1枚の表記。例: 'Ks' = スペードのK */
export type CardStr = `${Rank}${Suit}`;

/** 6-max のポジション */
export type Position = 'UTG' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

/** 出題カテゴリ */
export type Category = 'preflop' | 'odds' | 'pushfold';

export const CATEGORIES: readonly Category[] = ['preflop', 'odds', 'pushfold'];

export const CATEGORY_LABELS: Readonly<Record<Category, string>> = {
  preflop: 'プリフロップレンジ',
  odds: 'オッズ計算',
  pushfold: 'プッシュ/フォールド',
};

export interface Choice {
  readonly id: string;
  readonly label: string;
}

export interface QuestionPrompt {
  /** 例: 'プリフロップ判断' */
  readonly title: string;
  /** 状況説明の行（改行単位で分割） */
  readonly situation: readonly string[];
  /** 自分のハンド（オッズ問題では省略可） */
  readonly hand?: readonly [CardStr, CardStr];
  readonly position?: Position;
  /** 有効スタック（BB単位）。プッシュ/フォールド問題で必須 */
  readonly stackBB?: number;
}

export interface Question {
  /**
   * 決定的で再構築可能なID。SRSの再出題キーになる。
   * 例: 'preflop:BTN:K9s' / 'pushfold:SB:10:K7o' / 'odds:req:3000:1000' / 'odds:outs:9:flop'
   */
  readonly id: string;
  readonly category: Category;
  readonly prompt: QuestionPrompt;
  readonly choices: readonly Choice[];
  readonly correctChoiceId: string;
  /** 「なぜ」の解説行（改行単位で分割） */
  readonly explanation: readonly string[];
}

// ------------------------------------------------------------
// data モジュール契約（src/data/index.ts が export する関数）
//
//   generateQuestion(category: Category, rng: () => number): Question
//     - rng は [0,1) を返す乱数関数（テスト時に固定可能）
//   buildQuestionFromId(id: string): Question | null
//     - Question.id から同一問題を決定的に再構築する（SRS再出題用）
//     - 不正なIDは null（例外を投げない）
// ------------------------------------------------------------

// ------------------------------------------------------------
// learning モジュール契約（src/learning/index.ts が export する関数）
//
//   recordAnswer(questionId: string, category: Category, correct: boolean, now?: number): void
//   getDueEntries(now?: number): SrsEntry[]   // 復習期限が来た問題（優先度順）
//   getStats(now?: number): CategoryStats[]   // カテゴリ別成績
//   resetProgress(): void                     // 全進捗の削除
//   removeEntry(questionId: string): void     // 再構築不能になったSRSエントリを削除する
// ------------------------------------------------------------

export interface SrsEntry {
  readonly questionId: string;
  readonly category: Category;
  /** Leitner ボックス番号 0..5（0が最頻出） */
  readonly box: number;
  readonly wrongCount: number;
  readonly correctStreak: number;
  /** 次に出題すべき時刻（epoch ms） */
  readonly dueAt: number;
  readonly lastAnsweredAt: number;
}

export interface CategoryStats {
  readonly category: Category;
  /** 累計回答数 */
  readonly total: number;
  /** 累計正解数 */
  readonly correct: number;
  /** 0..1。total が 0 のときは 0 */
  readonly accuracy: number;
  /** 現在復習期限が来ている問題数 */
  readonly dueCount: number;
}
