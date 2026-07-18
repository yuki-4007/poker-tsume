// セッション終了時の結果サマリー画面。
// drill.ts が SESSION_LENGTH 問回答し終えたタイミングで、drill シェル内に描画する
// （URL遷移は伴わない中間状態のため、router には組み込まない）。
import type { Category } from '../../types';
import { CATEGORY_LABELS } from '../../types';
import { escapeHtml } from '../utils/escape';
import type { SessionState } from './drill';

/** 正答数に応じた一言コメントを返す（9問以上=称賛/6-8問=励まし/5問以下=復習推奨）。 */
function pickComment(correct: number): string {
  if (correct >= 9) {
    return '見事な精度です。レンジがしっかり体に染み込んでいます。この調子で次のセッションへ。';
  }
  if (correct >= 6) {
    return '着実に判断力がついてきています。もう10問続けて、精度をさらに高めましょう。';
  }
  return '基礎を見直す好機です。間違えた問題の解説を読み返してから、もう一度挑戦してみましょう。';
}

function resolveCategoryLabel(categoryParam: Category | 'mixed'): string {
  return categoryParam === 'mixed' ? 'ミックス出題' : CATEGORY_LABELS[categoryParam];
}

/**
 * セッション終了時の結果サマリーを shell に描画する。
 * 「もう10問」は onRestart で同カテゴリの新しいセッションを開始し、
 * 「ホームに戻る」は通常のハッシュ遷移（#home）に任せる。
 */
export function renderSessionSummary(
  shell: HTMLElement,
  session: SessionState,
  categoryParam: Category | 'mixed',
  onRestart: () => void,
): void {
  const categoryLabel = resolveCategoryLabel(categoryParam);
  const accuracyPercent =
    session.answered > 0 ? Math.round((session.correct / session.answered) * 100) : 0;
  const comment = pickComment(session.correct);

  shell.innerHTML = `
    <section class="session-summary" role="status" aria-live="polite">
      <h2 class="session-summary__title">結果</h2>
      <p class="session-summary__category">${escapeHtml(categoryLabel)}</p>
      <div class="session-summary__score">
        <span class="session-summary__score-value">${session.correct}<span class="session-summary__score-total">/${session.answered}</span></span>
        <span class="session-summary__accuracy">正答率 ${accuracyPercent}%</span>
      </div>
      <p class="session-summary__streak">最大連続正解 ${session.bestStreak}問</p>
      <p class="session-summary__comment">${escapeHtml(comment)}</p>
      <div class="session-summary__actions">
        <button type="button" class="session-summary__restart">もう10問</button>
        <a class="session-summary__home" href="#home">ホームに戻る</a>
      </div>
    </section>
  `;

  const restartButton = shell.querySelector<HTMLButtonElement>('.session-summary__restart');
  restartButton?.addEventListener('click', onRestart);
}
