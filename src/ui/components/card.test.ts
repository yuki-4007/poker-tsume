// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { CardStr } from '../../types';
import { renderBoard, renderCard, renderHand } from './card';

const SAMPLE_HAND: readonly [CardStr, CardStr] = ['As', 'Kh'];

describe('renderCard', () => {
  it('ランクとスートを表すDOMを生成する（ダミー要素として安全）', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    container.innerHTML = renderCard('Ts');

    // Assert
    const card = container.querySelector('.playing-card');
    expect(card).not.toBeNull();
    expect(card?.classList.contains('suit-spade')).toBe(true);
    expect(card?.textContent).toContain('10');
  });
});

describe('renderHand のHTMLエスケープ', () => {
  it('labelにscriptタグを含む危険な文字列を渡してもscript要素として解釈されない', () => {
    // Arrange
    const container = document.createElement('div');
    const maliciousLabel = '<script>alert(1)</script>';

    // Act
    container.innerHTML = renderHand(SAMPLE_HAND, maliciousLabel);

    // Assert: script要素として実DOMツリーに現れない（＝文字列としてエスケープされた）
    expect(container.querySelector('script')).toBeNull();
    // エスケープされた文字列としてaria-label属性値に反映されている
    const handEl = container.querySelector('.hand');
    expect(handEl?.getAttribute('aria-label')).toBe(maliciousLabel);
  });

  it('labelに属性抜け出しを狙った文字列を渡してもaria-label以外の属性が注入されない', () => {
    // Arrange
    const container = document.createElement('div');
    const maliciousLabel = '"onmouseover=alert(1) x="';

    // Act
    container.innerHTML = renderHand(SAMPLE_HAND, maliciousLabel);

    // Assert: onmouseover属性が生成されていないこと
    const handEl = container.querySelector('.hand');
    expect(handEl?.hasAttribute('onmouseover')).toBe(false);
    expect(handEl?.getAttribute('aria-label')).toBe(maliciousLabel);
  });

  it('通常のラベルでは2枚のplaying-cardが描画される', () => {
    // Arrange
    const container = document.createElement('div');

    // Act
    container.innerHTML = renderHand(SAMPLE_HAND, 'あなたのハンド');

    // Assert
    expect(container.querySelectorAll('.playing-card')).toHaveLength(2);
    expect(container.querySelector('.hand')?.getAttribute('aria-label')).toBe('あなたのハンド');
  });
});

describe('renderBoard', () => {
  it('フロップ（3枚）のコミュニティカードが描画される', () => {
    // Arrange
    const container = document.createElement('div');
    const flop: readonly CardStr[] = ['Qs', '7s', '2h'];

    // Act
    container.innerHTML = renderBoard(flop, 'ボード');

    // Assert
    expect(container.querySelectorAll('.board .playing-card')).toHaveLength(3);
    expect(container.querySelector('.board__cards')?.getAttribute('aria-label')).toBe('ボード');
    expect(container.querySelector('.board__label')?.textContent).toBe('ボード');
  });

  it('ターン（4枚）のコミュニティカードにも対応する', () => {
    // Arrange
    const container = document.createElement('div');
    const turn: readonly CardStr[] = ['Qs', '7s', '2h', 'Ah'];

    // Act
    container.innerHTML = renderBoard(turn, 'ボード');

    // Assert
    expect(container.querySelectorAll('.board .playing-card')).toHaveLength(4);
  });

  it('labelにscriptタグを含む危険な文字列を渡してもscript要素として解釈されない', () => {
    // Arrange
    const container = document.createElement('div');
    const maliciousLabel = '<script>alert(1)</script>';

    // Act
    container.innerHTML = renderBoard(['Qs', '7s', '2h'], maliciousLabel);

    // Assert
    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('.board__cards')?.getAttribute('aria-label')).toBe(
      maliciousLabel,
    );
    expect(container.textContent).toContain(maliciousLabel);
  });

  it('labelに属性抜け出しを狙った文字列を渡しても属性注入が起きない', () => {
    // Arrange
    const container = document.createElement('div');
    const maliciousLabel = '"onmouseover=alert(1) x="';

    // Act
    container.innerHTML = renderBoard(['Qs', '7s', '2h'], maliciousLabel);

    // Assert
    const hasInjectedAttribute = Array.from(container.querySelectorAll('*')).some((el) =>
      el.hasAttribute('onmouseover'),
    );
    expect(hasInjectedAttribute).toBe(false);
    expect(container.querySelector('.board__cards')?.getAttribute('aria-label')).toBe(
      maliciousLabel,
    );
  });
});
