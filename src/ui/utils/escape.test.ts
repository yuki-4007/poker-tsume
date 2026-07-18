import { describe, expect, it } from 'vitest';
import { escapeHtml } from './escape';

describe('escapeHtml', () => {
  it('& < > " \' の5文字をすべてHTMLエンティティに変換する', () => {
    // Arrange
    const input = `& < > " '`;

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).toBe('&amp; &lt; &gt; &quot; &#39;');
  });

  it('scriptタグを含む文字列をタグとして解釈されない形にエスケープする', () => {
    // Arrange
    const input = '<script>alert(1)</script>';

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).not.toContain('<script>');
    expect(result).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('属性値を抜け出そうとする文字列のダブルクォートをエスケープする', () => {
    // Arrange
    const input = '"onmouseover=alert(1) x="';

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).not.toContain('"');
    expect(result).toBe('&quot;onmouseover=alert(1) x=&quot;');
  });

  it('シングルクォートを使った属性抜け出しもエスケープする', () => {
    // Arrange
    const input = "'onmouseover='alert(1)";

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).not.toContain("'");
    expect(result).toBe('&#39;onmouseover=&#39;alert(1)');
  });

  it('危険文字を含まない通常の文字列はそのまま返す', () => {
    // Arrange
    const input = 'BTNからAKsでオープンレイズ';

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).toBe(input);
  });

  it('空文字列を渡すと空文字列を返す', () => {
    // Act
    const result = escapeHtml('');

    // Assert
    expect(result).toBe('');
  });

  it('&が最初に処理されても二重エスケープにならない', () => {
    // Arrange: すでにエンティティ化済みの文字列を渡すケース
    const input = '&lt;script&gt;';

    // Act
    const result = escapeHtml(input);

    // Assert
    expect(result).toBe('&amp;lt;script&amp;gt;');
  });
});
