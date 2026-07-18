// ドリル画面（#drill/<category|mixed>）。出題・判定・SRS記録・セッション終端を担う。
import type { Category, Question } from '../../types';
import { CATEGORIES, CATEGORY_LABELS } from '../../types';
import { generateQuestion, buildQuestionFromId } from '../../data';
import { getDueEntries, recordAnswer, removeEntry } from '../../learning';
import { escapeHtml } from '../utils/escape';
import { renderHand } from '../components/card';
import { renderSessionSummary } from './sessionSummary';

/** 復習期限到来問題を優先的に再出題する確率。 */
const DUE_REPEAT_PROBABILITY = 0.6;

/** 1セッションで出題する問題数。この数に達したら結果サマリーを表示する。 */
export const SESSION_LENGTH = 10;

export interface SessionState {
  readonly answered: number;
  readonly correct: number;
  readonly correctStreak: number;
  /** セッション内で記録した最大の連続正解数。 */
  readonly bestStreak: number;
}

function createInitialSession(): SessionState {
  return { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0 };
}

/** rng は [0,1) を返す乱数関数（テスト時に固定可能。プロジェクト規約は src/data/rngUtils.ts 参照）。 */
export function pickRandomCategory(rng: () => number): Category {
  const index = Math.floor(rng() * CATEGORIES.length);
  return CATEGORIES[index] ?? 'preflop';
}

/**
 * 期限到来問題があれば60%で再出題、それ以外は新規生成する。
 * 再出題対象のquestionIdがbuildQuestionFromIdで再構築できない場合（データ定義変更などで
 * 該当問題が消滅した「亡霊エントリ」）は、SRSエントリを削除してから新規生成にフォールバックする。
 */
export function pickQuestion(category: Category, rng: () => number): Question {
  const dueForCategory = getDueEntries().filter((entry) => entry.category === category);
  const topDue = dueForCategory[0];

  if (topDue && rng() < DUE_REPEAT_PROBABILITY) {
    const rebuilt = buildQuestionFromId(topDue.questionId);
    if (rebuilt) {
      return rebuilt;
    }
    removeEntry(topDue.questionId);
  }

  return generateQuestion(category, rng);
}

function updateSessionLabel(shell: HTMLElement, session: SessionState): void {
  const label = shell.querySelector('.drill-header__session');
  if (label) {
    label.textContent = `${session.answered}/${SESSION_LENGTH}問 連続${session.correctStreak}`;
  }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function renderQuestionCard(
  shell: HTMLElement,
  question: Question,
  categoryParam: Category | 'mixed',
  session: SessionState,
  onSessionChange: (next: SessionState) => void,
  onNext: () => void,
): void {
  const headerLabel = categoryParam === 'mixed' ? 'ミックス出題' : CATEGORY_LABELS[categoryParam];
  const subcategoryHtml =
    categoryParam === 'mixed'
      ? `<span class="drill-header__subcategory"> · ${escapeHtml(CATEGORY_LABELS[question.category])}</span>`
      : '';

  const situationHtml = question.prompt.situation
    .map((line) => `<p class="situation-line">${escapeHtml(line)}</p>`)
    .join('');

  const positionBadge = question.prompt.position
    ? `<span class="badge badge--position">${escapeHtml(question.prompt.position)}</span>`
    : '';

  const stackBadge =
    typeof question.prompt.stackBB === 'number'
      ? `<span class="badge badge--stack">${question.prompt.stackBB}BB</span>`
      : '';

  const handHtml = question.prompt.hand ? renderHand(question.prompt.hand, 'あなたのハンド') : '';

  const choicesHtml = question.choices
    .map(
      (choice) => `
        <button type="button" class="choice-button" data-choice-id="${escapeHtml(choice.id)}">
          ${escapeHtml(choice.label)}
        </button>
      `,
    )
    .join('');

  shell.innerHTML = `
    <header class="drill-header">
      <a class="back-button" href="#home" aria-label="ホームに戻る">←</a>
      <span class="drill-header__category">${escapeHtml(headerLabel)}${subcategoryHtml}</span>
      <span class="drill-header__session">${session.answered}/${SESSION_LENGTH}問 連続${session.correctStreak}</span>
    </header>

    <section class="question-card" aria-live="polite">
      <h2 class="question-title">${escapeHtml(question.prompt.title)}</h2>
      <div class="question-badges">${positionBadge}${stackBadge}</div>
      <div class="situation">${situationHtml}</div>
      ${handHtml}
    </section>

    <section class="choices" role="group" aria-label="選択肢">
      ${choicesHtml}
    </section>

    <section class="explanation-panel" role="status" aria-live="polite" hidden></section>
  `;

  const choiceButtons = Array.from(shell.querySelectorAll<HTMLButtonElement>('.choice-button'));
  const explanationPanel = shell.querySelector<HTMLElement>('.explanation-panel');

  // 新しい問題が表示されたことを、見出しへのフォーカス移動でも伝える（スクリーンリーダー・キーボード操作対応）。
  const questionTitle = shell.querySelector<HTMLElement>('.question-title');
  questionTitle?.setAttribute('tabindex', '-1');
  questionTitle?.focus();

  const handleChoice = (chosenId: string): void => {
    const correct = chosenId === question.correctChoiceId;
    const correctStreak = correct ? session.correctStreak + 1 : 0;
    const nextSession: SessionState = {
      answered: session.answered + 1,
      correct: session.correct + (correct ? 1 : 0),
      correctStreak,
      bestStreak: Math.max(session.bestStreak, correctStreak),
    };

    recordAnswer(question.id, question.category, correct);
    onSessionChange(nextSession);
    updateSessionLabel(shell, nextSession);

    choiceButtons.forEach((button) => {
      button.disabled = true;
      const isChosen = button.dataset.choiceId === chosenId;
      const isCorrectChoice = button.dataset.choiceId === question.correctChoiceId;

      if (isCorrectChoice) {
        button.classList.add('choice-button--correct');
        button.insertAdjacentHTML(
          'beforeend',
          ' <span class="choice-button__mark" aria-hidden="true">✓</span><span class="sr-only">（正解）</span>',
        );
      } else if (isChosen) {
        button.classList.add('choice-button--incorrect');
        button.insertAdjacentHTML(
          'beforeend',
          ' <span class="choice-button__mark" aria-hidden="true">✗</span><span class="sr-only">（不正解）</span>',
        );
      }
    });

    if (!explanationPanel) {
      return;
    }

    const explanationLines = question.explanation
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');
    const isSessionComplete = nextSession.answered >= SESSION_LENGTH;
    const nextButtonLabel = isSessionComplete ? '結果を見る' : '次へ';

    explanationPanel.innerHTML = `
      <p class="explanation-result ${correct ? 'is-correct' : 'is-incorrect'}">
        ${correct ? '正解' : '不正解'}
      </p>
      ${explanationLines}
      <button type="button" class="next-button">${nextButtonLabel}</button>
    `;
    explanationPanel.hidden = false;
    // 次のフレームでクラスを付与し、transition が確実に発火するようにする。
    requestAnimationFrame(() => {
      explanationPanel.classList.add('is-visible');
    });

    explanationPanel.scrollIntoView?.({
      block: 'start',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    });

    const nextButton = explanationPanel.querySelector<HTMLButtonElement>('.next-button');
    nextButton?.addEventListener('click', onNext);
    // スクロールは直前の scrollIntoView に任せ、focus 自体では画面を動かさない。
    nextButton?.focus({ preventScroll: true });
  };

  choiceButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const choiceId = button.dataset.choiceId;
      if (choiceId) {
        handleChoice(choiceId);
      }
    });
  });
}

export function renderDrill(root: HTMLElement, categoryParam: Category | 'mixed'): void {
  // Math.random を直接参照するのはこの1箇所のみ。以降は rng として引数注入する。
  const rng = Math.random;

  let session: SessionState = createInitialSession();

  const shell = document.createElement('main');
  shell.className = 'screen screen--drill';
  root.appendChild(shell);

  const handleSessionChange = (next: SessionState): void => {
    session = next;
  };

  const startNewSession = (): void => {
    session = createInitialSession();
    showNextQuestion();
  };

  const showSummary = (): void => {
    renderSessionSummary(shell, session, categoryParam, startNewSession);
  };

  const showNextQuestion = (): void => {
    if (session.answered >= SESSION_LENGTH) {
      showSummary();
      return;
    }
    const category = categoryParam === 'mixed' ? pickRandomCategory(rng) : categoryParam;
    const question = pickQuestion(category, rng);
    renderQuestionCard(shell, question, categoryParam, session, handleSessionChange, showNextQuestion);
  };

  showNextQuestion();
}
