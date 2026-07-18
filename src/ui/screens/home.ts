// ホーム画面（#home）。カテゴリカード＋ミックス出題＋成績への導線。
import { CATEGORIES, CATEGORY_LABELS } from '../../types';
import { getStats } from '../../learning';
import { escapeHtml } from '../utils/escape';
import { describeAccuracy } from '../utils/accuracyLabel';

function formatAccuracy(total: number, accuracy: number): string {
  const display = describeAccuracy(total, accuracy);
  switch (display.kind) {
    case 'none':
      return '未挑戦';
    case 'learning':
      return '学習中';
    case 'measured':
      return `正答率 ${display.percent}%`;
  }
}

export function renderHome(root: HTMLElement): void {
  const stats = getStats();
  const statsByCategory = new Map(stats.map((stat) => [stat.category, stat]));
  const totalDue = stats.reduce((sum, stat) => sum + stat.dueCount, 0);

  const categoryCards = CATEGORIES.map((category) => {
    const stat = statsByCategory.get(category);
    const total = stat?.total ?? 0;
    const accuracy = stat?.accuracy ?? 0;
    const dueCount = stat?.dueCount ?? 0;
    const dueBadge =
      dueCount > 0 ? `<span class="badge badge--due">復習${dueCount}問</span>` : '';

    return `
      <li>
        <a class="category-card" href="#drill/${category}">
          <span class="category-card__title">${escapeHtml(CATEGORY_LABELS[category])}</span>
          <span class="category-card__meta">
            <span class="category-card__accuracy">${escapeHtml(formatAccuracy(total, accuracy))}</span>
            ${dueBadge}
          </span>
        </a>
      </li>
    `;
  }).join('');

  root.innerHTML = `
    <main class="screen screen--home">
      <header class="home-header">
        <h1 class="app-title">詰めポーカー</h1>
        <p class="app-tagline">すきま時間で、判断を体に染み込ませる。</p>
        ${
          totalDue > 0
            ? `<p class="due-alert" role="status">復習期限の問題が ${totalDue} 問あります</p>
               <p class="due-alert-hint">間違えた問題は少し時間を置いて再出題されます</p>`
            : ''
        }
      </header>

      <nav aria-label="ドリルカテゴリ">
        <ul class="category-list">
          ${categoryCards}
        </ul>
      </nav>

      <a class="mixed-card" href="#drill/mixed">
        <span class="mixed-card__title">ミックス出題</span>
        <span class="mixed-card__desc">全カテゴリからランダムに出題</span>
      </a>

      <a class="stats-link" href="#stats">成績を見る →</a>
    </main>
  `;
}
