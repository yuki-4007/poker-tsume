// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import type { CardStr } from '../../types';
import { renderCard, renderHand } from './card';

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
