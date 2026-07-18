import { describe, expect, test } from 'vitest';
import { handClassOf, parseRange, randomCardsForClass } from './handNotation';

describe('parseRange - ペア表記', () => {
  test('XX+ はそのペアからAAまでを展開する', () => {
    // Arrange
    const notation = '55+';

    // Act
    const result = parseRange(notation);

    // Assert
    expect([...result].sort()).toEqual(['55', '66', '77', '88', '99', 'AA', 'JJ', 'KK', 'QQ', 'TT'].sort());
  });

  test('XX-YY は高いペアから低いペアまでの範囲を展開する', () => {
    // Arrange
    const notation = '77-55';

    // Act
    const result = parseRange(notation);

    // Assert
    expect([...result].sort()).toEqual(['55', '66', '77']);
  });

  test('単体のペア表記はそのまま1件になる', () => {
    // Arrange & Act
    const result = parseRange('22');

    // Assert
    expect([...result]).toEqual(['22']);
  });
});

describe('parseRange - スーテッド/オフスーツ表記', () => {
  test('XYs+ はキッカーをその値からハイカードの一つ下まで展開する（ATs+）', () => {
    // Arrange & Act
    const result = parseRange('ATs+');

    // Assert
    expect([...result].sort()).toEqual(['AJs', 'AKs', 'AQs', 'ATs'].sort());
  });

  test('XYo+ はオフスーツでも同様に展開する（K5o+）', () => {
    // Arrange & Act
    const result = parseRange('K5o+');

    // Assert
    expect([...result].sort()).toEqual(['K5o', 'K6o', 'K7o', 'K8o', 'K9o', 'KJo', 'KQo', 'KTo'].sort());
  });

  test('XYs-XYs はキッカー範囲を展開する（A5s-A4s）', () => {
    // Arrange & Act
    const result = parseRange('A5s-A4s');

    // Assert
    expect([...result].sort()).toEqual(['A4s', 'A5s']);
  });

  test('単体のスーテッド表記はそのまま1件になる（54s）', () => {
    // Arrange & Act
    const result = parseRange('54s');

    // Assert
    expect([...result]).toEqual(['54s']);
  });

  test('カンマ区切りの複数トークンをまとめて展開できる', () => {
    // Arrange & Act
    const result = parseRange('22, AKo, 54s');

    // Assert
    expect([...result].sort()).toEqual(['22', '54s', 'AKo'].sort());
  });
});

describe('parseRange - 不正トークン', () => {
  test('順序が逆のトークンは意味のあるメッセージ付きで例外を投げる', () => {
    // Arrange
    const notation = '9Ts';

    // Act & Assert
    expect(() => parseRange(notation)).toThrow(/高札と低札の順序|不正/);
  });

  test('未知のランク文字は例外を投げる', () => {
    // Arrange
    const notation = 'X9s';

    // Act & Assert
    expect(() => parseRange(notation)).toThrow();
  });

  test('形式として成立しない文字列は例外を投げる', () => {
    // Arrange
    const notation = 'hello';

    // Act & Assert
    expect(() => parseRange(notation)).toThrow(/不正なレンジトークン/);
  });

  test('空文字列は例外を投げる', () => {
    // Arrange & Act & Assert
    expect(() => parseRange('')).toThrow();
  });
});

describe('handClassOf', () => {
  test('スーテッドの2枚からハンドクラスを得る', () => {
    // Arrange
    const card1 = 'Ks' as const;
    const card2 = '9s' as const;

    // Act
    const result = handClassOf(card1, card2);

    // Assert
    expect(result).toBe('K9s');
  });

  test('オフスーツの2枚からハンドクラスを得る', () => {
    // Arrange & Act
    const result = handClassOf('Ah', '9s');

    // Assert
    expect(result).toBe('A9o');
  });

  test('順序が逆でも高いランクが先に来る', () => {
    // Arrange & Act
    const result = handClassOf('9s', 'Ah');

    // Assert
    expect(result).toBe('A9o');
  });

  test('ペアはそのままランク2文字になる', () => {
    // Arrange & Act
    const result = handClassOf('Th', 'Td');

    // Assert
    expect(result).toBe('TT');
  });
});

describe('randomCardsForClass', () => {
  test('ペアは同ランク・異スートの2枚を返す', () => {
    // Arrange
    const rng = () => 0.1;

    // Act
    const [c1, c2] = randomCardsForClass('TT', rng);

    // Assert
    expect(c1[0]).toBe('T');
    expect(c2[0]).toBe('T');
    expect(c1[1]).not.toBe(c2[1]);
  });

  test('スーテッドは同スートの2枚を返す', () => {
    // Arrange
    const rng = () => 0.42;

    // Act
    const [c1, c2] = randomCardsForClass('AKs', rng);

    // Assert
    expect(c1[0]).toBe('A');
    expect(c2[0]).toBe('K');
    expect(c1[1]).toBe(c2[1]);
  });

  test('オフスーツは異スートの2枚を返す', () => {
    // Arrange
    const rng = () => 0.77;

    // Act
    const [c1, c2] = randomCardsForClass('AKo', rng);

    // Assert
    expect(c1[0]).toBe('A');
    expect(c2[0]).toBe('K');
    expect(c1[1]).not.toBe(c2[1]);
  });

  test('得られたカードから handClassOf で元のハンドクラスへ復元できる', () => {
    // Arrange
    const rng = () => 0.9;
    const handClass = 'QJo';

    // Act
    const [c1, c2] = randomCardsForClass(handClass, rng);

    // Assert
    expect(handClassOf(c1, c2)).toBe(handClass);
  });
});
