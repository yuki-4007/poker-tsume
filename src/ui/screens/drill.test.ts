// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { CATEGORIES, CATEGORY_LABELS } from '../../types';
import type { Question } from '../../types';
import { generateQuestion } from '../../data';
import * as learningApi from '../../learning';
import { createMemoryStore } from '../../learning/storage';
import type { SessionState } from './drill';
import {
  SESSION_LENGTH,
  pickQuestion,
  pickRandomCategory,
  renderDrill,
  renderQuestionCard,
} from './drill';

const NOW = 1_700_000_000_000;

/** 最初の呼び出しだけ`first`を返し、以降はすべて`rest`を返す固定rng（テスト用）。 */
function firstThenFixed(first: number, rest: number): () => number {
  let calls = 0;
  return () => {
    calls += 1;
    return calls === 1 ? first : rest;
  };
}

/** 常に同じ値を返す固定rng（テスト用）。 */
function alwaysFixed(value: number): () => number {
  return () => value;
}

afterEach(() => {
  learningApi._configureForTest(createMemoryStore());
});

describe('pickRandomCategory', () => {
  it('rngが0を返すと最初のカテゴリを選ぶ', () => {
    // Act
    const category = pickRandomCategory(alwaysFixed(0));

    // Assert
    expect(category).toBe(CATEGORIES[0]);
  });

  it('rngが1未満で最大値に近いと最後のカテゴリを選ぶ', () => {
    // Act
    const category = pickRandomCategory(alwaysFixed(0.999));

    // Assert
    expect(category).toBe(CATEGORIES[CATEGORIES.length - 1]);
  });

  it('5カテゴリすべてが、対応するrng区間から選ばれる（カテゴリ拡張への追従を確認）', () => {
    // Arrange & Act & Assert
    expect(CATEGORIES.length).toBe(5);
    CATEGORIES.forEach((expectedCategory, index) => {
      const rngValue = (index + 0.5) / CATEGORIES.length;
      expect(pickRandomCategory(alwaysFixed(rngValue))).toBe(expectedCategory);
    });
  });
});

describe('pickQuestion', () => {
  it('期限到来問題がありrngが0.6未満なら再出題する', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    learningApi.recordAnswer('odds:req:3000:1000', 'odds', false, NOW);
    const rng = firstThenFixed(0.1, 0.5);

    // Act
    const question = pickQuestion('odds', rng);

    // Assert
    expect(question.id).toBe('odds:req:3000:1000');
  });

  it('期限到来問題があってもrngが0.6以上なら新規生成する', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    learningApi.recordAnswer('odds:req:3000:1000', 'odds', false, NOW);
    const rng = firstThenFixed(0.9, 0.5);

    // Act
    const question = pickQuestion('odds', rng);

    // Assert: 確率チェックで1回rngを消費した後、残りはgenerateQuestionにそのまま渡される
    const expected = generateQuestion('odds', alwaysFixed(0.5));
    expect(question.id).toBe(expected.id);
    expect(question.id).not.toBe('odds:req:3000:1000');
  });

  it('期限到来問題がなければrng値によらず新規生成する（確率チェック自体が発生しない）', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    const rng = firstThenFixed(0.1, 0.5); // 0.1は本来「再出題」を選ぶ値

    // Act
    const question = pickQuestion('preflop', rng);

    // Assert: due entryが無いのでrng()の最初の呼び出しは消費されず、そのままgenerateQuestionに渡る
    const expected = generateQuestion('preflop', firstThenFixed(0.1, 0.5));
    expect(question.id).toBe(expected.id);
    expect(question.category).toBe('preflop');
  });

  it('再構築不能な亡霊エントリはremoveEntryで削除してから新規生成にフォールバックする', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    const ghostId = 'preflop:ZZ:INVALID'; // buildQuestionFromIdがnullを返す不正なID
    learningApi.recordAnswer(ghostId, 'preflop', false, NOW);
    expect(learningApi.getDueEntries().some((e) => e.questionId === ghostId)).toBe(true);
    const rng = firstThenFixed(0.1, 0.5); // 再出題を選ぶが再構築できずフォールバックする

    // Act
    const question = pickQuestion('preflop', rng);

    // Assert
    expect(question.category).toBe('preflop');
    expect(question.id).not.toBe(ghostId);
    expect(learningApi.getDueEntries().some((e) => e.questionId === ghostId)).toBe(false);
  });
});

/** index.test.ts と同じ決定的な乱数生成器（mulberry32）。 */
function seededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('pickQuestion のセッション内重複防止', () => {
  it('新規生成がセッション内既出IDと重複する場合、同じrng系列でも再抽選して別の問題を返す', () => {
    // Arrange: 復習期限なし（新規生成のみが発生する状態）。
    // 同じseedのrng系列を2回使い、1回目の結果を「既出」として2回目に渡す。
    learningApi._configureForTest(createMemoryStore());
    const seed = 12345;
    const withoutDedup = generateQuestion('preflop', seededRng(seed));
    const excludeIds = new Set([withoutDedup.id]);

    // Act: 同一seedのrng系列でも、既出IDと重複するため再抽選が起きるはず
    const withDedup = pickQuestion('preflop', seededRng(seed), excludeIds);

    // Assert: 素の生成結果とは異なる問題が返る（再抽選が発生した証拠）
    expect(withDedup.id).not.toBe(withoutDedup.id);
  });

  it('復習期限到来問題（due）はセッション内既出IDと重複していても再抽選しない', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    learningApi.recordAnswer('odds:req:3000:1000', 'odds', false, NOW);
    const excludeIds = new Set(['odds:req:3000:1000']);
    const rng = firstThenFixed(0.1, 0.5); // 再出題(due)を選ぶ値

    // Act
    const question = pickQuestion('odds', rng, excludeIds);

    // Assert: 復習出題はexcludeIdsに関わらずそのまま返る（復習は同じ問題を出すのが目的のため）
    expect(question.id).toBe('odds:req:3000:1000');
  });

  it('最大8回再抽選しても重複が解消しない場合は、重複したままでも出題する（無限ループにならない）', () => {
    // Arrange: 常に同じ問題しか生成しない固定rng
    learningApi._configureForTest(createMemoryStore());
    const rng = alwaysFixed(0.5);
    const stuckId = generateQuestion('preflop', alwaysFixed(0.5)).id;
    const excludeIds = new Set([stuckId]);

    // Act & Assert: 何度再抽選しても同じ問題しか出ないため、例外を投げず重複したまま返す
    let question: Question | undefined;
    expect(() => {
      question = pickQuestion('preflop', rng, excludeIds);
    }).not.toThrow();
    expect(question?.id).toBe(stuckId);
  });

  it('excludeIdsを省略した場合は重複防止が働かない（デフォルト値は空集合）', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());

    // Act & Assert: 第3引数を省略しても例外にならない
    expect(() => pickQuestion('preflop', alwaysFixed(0.5))).not.toThrow();
  });
});

describe('renderQuestionCard のHTMLエスケープ', () => {
  it('危険文字列を含むQuestionを渡してもscript要素や属性注入が発生しない', () => {
    // Arrange
    const shell = document.createElement('main');
    const maliciousQuestion: Question = {
      id: 'preflop:BTN:AKs',
      category: 'preflop',
      prompt: {
        title: '<script>alert(1)</script>',
        situation: ['"onmouseover=alert(1) x="', '通常の行'],
        hand: ['As', 'Kh'],
        position: 'BTN',
        stackBB: 100,
      },
      choices: [
        { id: 'raise" onmouseover="alert(1)', label: '<b>レイズ</b>' },
        { id: 'fold', label: 'フォールド' },
      ],
      correctChoiceId: 'raise" onmouseover="alert(1)',
      explanation: ['"><script>alert(2)</script>'],
    };

    // Act
    renderQuestionCard(
      shell,
      maliciousQuestion,
      'preflop',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert: 危険な要素・属性が実DOMに現れないこと
    expect(shell.querySelector('script')).toBeNull();
    expect(shell.querySelector('b')).toBeNull();
    const choiceButtons = Array.from(shell.querySelectorAll('.choice-button'));
    expect(choiceButtons.length).toBeGreaterThan(0);
    choiceButtons.forEach((button) => {
      expect(button.hasAttribute('onmouseover')).toBe(false);
    });

    // Assert: エスケープされたテキストとしては表示されている（描画自体は正しく行われている）
    expect(shell.textContent).toContain('<script>alert(1)</script>');
    expect(shell.textContent).toContain('<b>レイズ</b>');
    expect(shell.textContent).toContain('"onmouseover=alert(1) x="');
  });

  it('選択肢クリック時、渡されたsessionオブジェクトを直接ミューテートせず、新しいオブジェクトをonSessionChangeへ渡す', () => {
    // Arrange
    const shell = document.createElement('main');
    const question: Question = {
      id: 'odds:req:3000:1000',
      category: 'odds',
      prompt: { title: 'オッズ計算', situation: ['行1'] },
      choices: [
        { id: 'call', label: 'コール' },
        { id: 'fold', label: 'フォールド' },
      ],
      correctChoiceId: 'call',
      explanation: ['解説'],
    };
    const originalSession: SessionState = { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() };
    let receivedSession: SessionState | null = null;

    renderQuestionCard(
      shell,
      question,
      'odds',
      originalSession,
      (next) => {
        receivedSession = next;
      },
      () => {},
    );

    // Act
    shell.querySelector<HTMLButtonElement>('[data-choice-id="call"]')?.click();

    // Assert: 元のオブジェクトは不変のまま、コールバックには新しいオブジェクトが渡る
    expect(originalSession).toEqual({ answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() });
    expect(receivedSession).toEqual({
      answered: 1,
      correct: 1,
      correctStreak: 1,
      bestStreak: 1,
      answeredIds: new Set(['odds:req:3000:1000']),
    });
  });
});

const SAMPLE_QUESTION: Question = {
  id: 'odds:req:3000:1000',
  category: 'odds',
  prompt: { title: 'オッズ計算', situation: ['行1'] },
  choices: [
    { id: 'call', label: 'コール' },
    { id: 'fold', label: 'フォールド' },
  ],
  correctChoiceId: 'call',
  explanation: ['解説'],
};

describe('renderQuestionCard の正誤記号・aria-live・フォーカス管理', () => {
  it('解説パネルには role=status と aria-live=polite が最初から付与されている', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert
    const panel = shell.querySelector('.explanation-panel');
    expect(panel?.getAttribute('role')).toBe('status');
    expect(panel?.getAttribute('aria-live')).toBe('polite');
  });

  it('正解ボタンには✓、選択した誤答ボタンには✗が記号として追加される（色に依存しないフィードバック）', () => {
    // Arrange
    const shell = document.createElement('main');
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Act: 誤答（fold）を選ぶ
    shell.querySelector<HTMLButtonElement>('[data-choice-id="fold"]')?.click();

    // Assert
    const correctButton = shell.querySelector('[data-choice-id="call"]');
    const chosenButton = shell.querySelector('[data-choice-id="fold"]');
    expect(correctButton?.querySelector('.choice-button__mark')?.textContent).toBe('✓');
    expect(correctButton?.textContent).toContain('正解');
    expect(chosenButton?.querySelector('.choice-button__mark')?.textContent).toBe('✗');
    expect(chosenButton?.textContent).toContain('不正解');
  });

  it('回答確定後、次へボタンにフォーカスが移る', () => {
    // Arrange
    const shell = document.createElement('main');
    document.body.appendChild(shell);
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Act
    shell.querySelector<HTMLButtonElement>('[data-choice-id="call"]')?.click();

    // Assert
    expect(document.activeElement?.classList.contains('next-button')).toBe(true);
    document.body.removeChild(shell);
  });

  it('新しい問題が表示されると、見出しに tabindex=-1 が付与されフォーカスされる', () => {
    // Arrange
    const shell = document.createElement('main');
    document.body.appendChild(shell);

    // Act
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert
    const title = shell.querySelector('.question-title');
    expect(title?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(title);
    document.body.removeChild(shell);
  });

  it('mixed出題時のみ、ヘッダーに実際のカテゴリ名のサブラベルが表示される', () => {
    // Arrange & Act
    const mixedShell = document.createElement('main');
    renderQuestionCard(
      mixedShell,
      SAMPLE_QUESTION,
      'mixed',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    const singleShell = document.createElement('main');
    renderQuestionCard(
      singleShell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert
    expect(mixedShell.querySelector('.drill-header__subcategory')?.textContent).toContain(
      CATEGORY_LABELS.odds,
    );
    expect(singleShell.querySelector('.drill-header__subcategory')).toBeNull();
  });

  it(`${SESSION_LENGTH}問目の回答後は「次へ」ボタンが「結果を見る」になる`, () => {
    // Arrange
    const shell = document.createElement('main');
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: SESSION_LENGTH - 1, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Act
    shell.querySelector<HTMLButtonElement>('[data-choice-id="call"]')?.click();

    // Assert
    expect(shell.querySelector('.next-button')?.textContent?.trim()).toBe('結果を見る');
  });

  it(`${SESSION_LENGTH}問未満のときは「次へ」ボタンの表記のまま`, () => {
    // Arrange
    const shell = document.createElement('main');
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Act
    shell.querySelector<HTMLButtonElement>('[data-choice-id="call"]')?.click();

    // Assert
    expect(shell.querySelector('.next-button')?.textContent?.trim()).toBe('次へ');
  });
});

const QUESTION_WITH_BOARD: Question = {
  id: 'outscount:test:1',
  category: 'outscount',
  prompt: {
    title: 'アウツを数える',
    situation: ['フラッシュドロー。アウツは何枚？'],
    hand: ['As', 'Ks'],
    board: ['Qs', '7s', '2h'],
  },
  choices: [
    { id: '9', label: '9枚' },
    { id: '8', label: '8枚' },
  ],
  correctChoiceId: '9',
  explanation: ['解説'],
};

describe('renderQuestionCard のボード表示', () => {
  it('question.prompt.boardがあるとき、手札の上にコミュニティカードが表示される', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderQuestionCard(
      shell,
      QUESTION_WITH_BOARD,
      'outscount',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert: ボードが描画され、手札より前（DOM順で上）に出現する
    const questionCard = shell.querySelector('.question-card');
    expect(questionCard?.querySelector('.board')).not.toBeNull();
    expect(questionCard?.querySelectorAll('.board .playing-card')).toHaveLength(3);
    expect(questionCard?.querySelector('.hand')).not.toBeNull();
    const html = questionCard?.innerHTML ?? '';
    expect(html.indexOf('class="board"')).toBeGreaterThanOrEqual(0);
    expect(html.indexOf('class="board"')).toBeLessThan(html.indexOf('class="hand"'));
  });

  it('question.prompt.boardが無い場合はボード要素が描画されない', () => {
    // Arrange
    const shell = document.createElement('main');

    // Act
    renderQuestionCard(
      shell,
      SAMPLE_QUESTION,
      'odds',
      { answered: 0, correct: 0, correctStreak: 0, bestStreak: 0, answeredIds: new Set() },
      () => {},
      () => {},
    );

    // Assert
    expect(shell.querySelector('.board')).toBeNull();
  });
});

describe('renderDrill のセッション終端', () => {
  afterEach(() => {
    learningApi._configureForTest(createMemoryStore());
  });

  it(`${SESSION_LENGTH}問回答すると結果サマリーが表示される`, () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderDrill(root, 'preflop');
    for (let i = 0; i < SESSION_LENGTH; i += 1) {
      const shell = root.querySelector('.screen--drill');
      shell?.querySelector<HTMLButtonElement>('.choice-button')?.click();
      shell?.querySelector<HTMLButtonElement>('.next-button')?.click();
    }

    // Assert
    const summary = root.querySelector('.session-summary');
    expect(summary).not.toBeNull();
    expect(summary?.textContent).toContain(`/${SESSION_LENGTH}`);
    expect(root.querySelector('.question-card')).toBeNull();
  });

  it('サマリーの「もう10問」で同カテゴリの新しいセッションが始まる', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    const root = document.createElement('div');
    renderDrill(root, 'preflop');
    for (let i = 0; i < SESSION_LENGTH; i += 1) {
      const shell = root.querySelector('.screen--drill');
      shell?.querySelector<HTMLButtonElement>('.choice-button')?.click();
      shell?.querySelector<HTMLButtonElement>('.next-button')?.click();
    }

    // Act
    root.querySelector<HTMLButtonElement>('.session-summary__restart')?.click();

    // Assert
    expect(root.querySelector('.session-summary')).toBeNull();
    expect(root.querySelector('.question-card')).not.toBeNull();
    expect(root.querySelector('.drill-header__session')?.textContent).toBe(
      `0/${SESSION_LENGTH}問 連続0`,
    );
  });

  it('セッション未完了のまま#homeへ戻った場合はサマリーを表示しない（drillシェルを差し替えないため）', () => {
    // Arrange
    learningApi._configureForTest(createMemoryStore());
    const root = document.createElement('div');

    // Act
    renderDrill(root, 'preflop');
    const shell = root.querySelector('.screen--drill');
    shell?.querySelector<HTMLButtonElement>('.choice-button')?.click();

    // Assert: 1問しか回答していないのでサマリーは出ない
    expect(root.querySelector('.session-summary')).toBeNull();
    expect(root.querySelector('.back-button')?.getAttribute('href')).toBe('#home');
  });
});
