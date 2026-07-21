// トランプ1枚を自作SVG不要のCSS+DOMで描画するコンポーネント。
// 4色デッキ: スペード黒・ハート赤・ダイヤ青・クラブ緑。
import type { CardStr, Rank, Suit } from '../../types';
import { escapeHtml } from '../utils/escape';

const SUIT_SYMBOL: Readonly<Record<Suit, string>> = {
  s: '♠',
  h: '♥',
  d: '♦',
  c: '♣',
};

const SUIT_CLASS: Readonly<Record<Suit, string>> = {
  s: 'suit-spade',
  h: 'suit-heart',
  d: 'suit-diamond',
  c: 'suit-club',
};

function displayRank(rank: Rank): string {
  return rank === 'T' ? '10' : rank;
}

function parseCard(card: CardStr): { rank: Rank; suit: Suit } {
  // CardStr は `${Rank}${Suit}` のテンプレートリテラル型のため、
  // 実行時の分割結果を Rank/Suit として扱うにはキャストが必要。
  const suit = card.slice(-1) as Suit;
  const rank = card.slice(0, -1) as Rank;
  return { rank, suit };
}

export function renderCard(card: CardStr): string {
  const { rank, suit } = parseCard(card);
  const rankLabel = displayRank(rank);
  const suitSymbol = SUIT_SYMBOL[suit];
  const suitClass = SUIT_CLASS[suit];

  return `
    <div class="playing-card ${suitClass}" aria-hidden="true">
      <span class="playing-card__rank playing-card__rank--top">${rankLabel}</span>
      <span class="playing-card__suit">${suitSymbol}</span>
      <span class="playing-card__rank playing-card__rank--bottom">${rankLabel}</span>
    </div>
  `;
}

export function renderHand(hand: readonly [CardStr, CardStr], label: string): string {
  return `
    <div class="hand" role="img" aria-label="${escapeHtml(label)}">
      ${renderCard(hand[0])}
      ${renderCard(hand[1])}
    </div>
  `;
}

/**
 * コミュニティカード（ボード）を描画する。アウツカウント・ベットサイズ問題などで使用。
 * 3枚（フロップ）・4枚（ターン）いずれの枚数にも対応する。
 * 手札より小さいサイズで表示するため `.board` スコープの専用クラスを付与する
 * （実際のサイズ調整は styles/components.css 側で行う）。
 */
export function renderBoard(board: readonly CardStr[], label: string): string {
  const cardsHtml = board.map((card) => renderCard(card)).join('');
  return `
    <div class="board">
      <span class="board__label">${escapeHtml(label)}</span>
      <div class="board__cards" role="img" aria-label="${escapeHtml(label)}">
        ${cardsHtml}
      </div>
    </div>
  `;
}
