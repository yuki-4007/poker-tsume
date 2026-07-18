// 成績画面（#stats）。カテゴリ別正答率と進捗リセットを提供する。
import { CATEGORIES, CATEGORY_LABELS } from '../../types';
import { getStats, resetProgress } from '../../learning';
import { escapeHtml } from '../utils/escape';
import { describeAccuracy } from '../utils/accuracyLabel';

function formatPercent(accuracy: number): string {
  return `${Math.round(accuracy * 100)}%`;
}

export function renderStats(root: HTMLElement): void {
  const stats = getStats();
  const statsByCategory = new Map(stats.map((stat) => [stat.category, stat]));

  const rows = CATEGORIES.map((category) => {
    const stat = statsByCategory.get(category);
    const total = stat?.total ?? 0;
    const correct = stat?.correct ?? 0;
    const accuracy = stat?.accuracy ?? 0;
    const dueCount = stat?.dueCount ?? 0;
    const display = describeAccuracy(total, accuracy);
    const isMeasured = display.kind === 'measured';
    const accuracyLabel = isMeasured ? formatPercent(accuracy) : '学習中';
    const barWidth = isMeasured ? Math.round(accuracy * 100) : 0;

    return `
      <li class="stats-row">
        <div class="stats-row__label">
          <span>${escapeHtml(CATEGORY_LABELS[category])}</span>
          <span class="stats-row__accuracy${isMeasured ? '' : ' stats-row__accuracy--learning'}">${accuracyLabel}</span>
        </div>
        ${
          isMeasured
            ? `<div class="stats-bar" role="img" aria-label="正答率 ${accuracyLabel}">
                 <div class="stats-bar__fill" style="width: ${barWidth}%"></div>
               </div>`
            : ''
        }
        <div class="stats-row__meta">
          <span>回答 ${total}問（正解 ${correct}）</span>
          ${dueCount > 0 ? `<span class="badge badge--due">復習${dueCount}問</span>` : ''}
        </div>
      </li>
    `;
  }).join('');

  root.innerHTML = `
    <main class="screen screen--stats">
      <header class="stats-header">
        <a class="back-button" href="#home" aria-label="ホームに戻る">←</a>
        <h1>成績</h1>
      </header>

      <ul class="stats-list">${rows}</ul>

      <button type="button" class="reset-button">進捗をリセット</button>
    </main>
  `;

  const resetButton = root.querySelector<HTMLButtonElement>('.reset-button');
  resetButton?.addEventListener('click', () => {
    const confirmed = window.confirm('すべての学習進捗を削除します。よろしいですか？');
    if (confirmed) {
      resetProgress();
      renderStats(root);
    }
  });
}
