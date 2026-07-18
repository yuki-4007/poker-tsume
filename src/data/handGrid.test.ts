import { describe, expect, test } from 'vitest';
import { ALL_HAND_CLASSES, cellToClass, classToCell, computeBoundarySet, isValidHandClass, neighborsOf } from './handGrid';

describe('ALL_HAND_CLASSES', () => {
  test('169通り全てのハンドクラスを重複なく含む', () => {
    // Arrange & Act
    const unique = new Set(ALL_HAND_CLASSES);

    // Assert
    expect(ALL_HAND_CLASSES.length).toBe(169);
    expect(unique.size).toBe(169);
  });
});

describe('classToCell / cellToClass', () => {
  test('相互変換が一致する（ペア）', () => {
    // Arrange & Act
    const cell = classToCell('TT');

    // Assert
    expect(cellToClass(cell)).toBe('TT');
  });

  test('相互変換が一致する（スーテッド）', () => {
    // Arrange & Act
    const cell = classToCell('AKs');

    // Assert
    expect(cellToClass(cell)).toBe('AKs');
    expect(cell.type).toBe('s');
  });
});

describe('isValidHandClass', () => {
  test('正しい形式は true', () => {
    expect(isValidHandClass('AA')).toBe(true);
    expect(isValidHandClass('AKs')).toBe(true);
    expect(isValidHandClass('72o')).toBe(true);
  });

  test('順序が逆・不正な形式は false', () => {
    expect(isValidHandClass('9Ts')).toBe(false);
    expect(isValidHandClass('XYs')).toBe(false);
    expect(isValidHandClass('A')).toBe(false);
    expect(isValidHandClass('AKx')).toBe(false);
  });
});

describe('neighborsOf', () => {
  test('ペアの隣接は上下のペアになる', () => {
    // Arrange
    const cell = classToCell('55');

    // Act
    const neighbors = neighborsOf(cell).map(cellToClass);

    // Assert
    expect(neighbors.sort()).toEqual(['44', '66']);
  });

  test('スーテッドの隣接はキッカー・ハイカードの隣接セルになる', () => {
    // Arrange
    const cell = classToCell('ATs');

    // Act
    const neighbors = neighborsOf(cell).map(cellToClass);

    // Assert（KTs: hi-1, A9s: lo+1, AJs: lo-1。hi+1はloと衝突するため無し）
    expect(neighbors.sort()).toEqual(['A9s', 'AJs', 'KTs'].sort());
  });
});

describe('computeBoundarySet', () => {
  test('レンジ全体がinの場合は境界が発生しない箇所を含む一方、範囲の内外があれば境界が検出される', () => {
    // Arrange: TT+ のみをinとするレンジ
    const inRangeSet = new Set(['TT', 'JJ', 'QQ', 'KK', 'AA']);
    const isInRange = (handClass: string): boolean => inRangeSet.has(handClass);

    // Act
    const boundary = computeBoundarySet(isInRange);

    // Assert: 99(外側でTTと隣接)とTT(内側で99と隣接)は境界、QQ(内側で両隣JJ・KKともin)は境界でない
    expect(boundary.has('99')).toBe(true);
    expect(boundary.has('TT')).toBe(true);
    expect(boundary.has('QQ')).toBe(false);
  });
});
