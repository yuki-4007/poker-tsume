import { describe, expect, test } from 'vitest';
import { getPositionPrinciple, getRfiNotation, isInOpenRange } from './ranges';

describe('isInOpenRange - UTG', () => {
  test('AJo は UTG レンジに含まれる（AJo+）', () => {
    expect(isInOpenRange('UTG', 'AJo')).toBe(true);
  });

  test('ATo は UTG レンジに含まれない', () => {
    expect(isInOpenRange('UTG', 'ATo')).toBe(false);
  });

  test('KTs は UTG レンジに含まれる（KTs+）', () => {
    expect(isInOpenRange('UTG', 'KTs')).toBe(true);
  });

  test('K9s は UTG レンジに含まれない', () => {
    expect(isInOpenRange('UTG', 'K9s')).toBe(false);
  });

  test('55 は UTG レンジに含まれる（55+）', () => {
    expect(isInOpenRange('UTG', '55')).toBe(true);
  });

  test('44 は UTG レンジに含まれない', () => {
    expect(isInOpenRange('UTG', '44')).toBe(false);
  });
});

describe('isInOpenRange - HJ', () => {
  test('A5s は HJ レンジに含まれる（単体指定）', () => {
    expect(isInOpenRange('HJ', 'A5s')).toBe(true);
  });

  test('A6s は HJ レンジに含まれない（A9s+の下、A5s/A4sの上で抜けている）', () => {
    expect(isInOpenRange('HJ', 'A6s')).toBe(false);
  });

  test('44 は HJ レンジに含まれる（44+）', () => {
    expect(isInOpenRange('HJ', '44')).toBe(true);
  });

  test('33 は HJ レンジに含まれない', () => {
    expect(isInOpenRange('HJ', '33')).toBe(false);
  });
});

describe('isInOpenRange - CO', () => {
  test('JTo は CO レンジに含まれる', () => {
    expect(isInOpenRange('CO', 'JTo')).toBe(true);
  });

  test('T9o は CO レンジに含まれない', () => {
    expect(isInOpenRange('CO', 'T9o')).toBe(false);
  });

  test('22 は CO レンジに含まれる（22+）', () => {
    expect(isInOpenRange('CO', '22')).toBe(true);
  });
});

describe('isInOpenRange - BTN', () => {
  test('K2s は BTN レンジに含まれる（K2s+）', () => {
    expect(isInOpenRange('BTN', 'K2s')).toBe(true);
  });

  test('A2o は BTN レンジに含まれる（A2o+）', () => {
    expect(isInOpenRange('BTN', 'A2o')).toBe(true);
  });

  test('98o は BTN レンジに含まれる（単体指定）', () => {
    expect(isInOpenRange('BTN', '98o')).toBe(true);
  });

  test('87o は BTN レンジに含まれない', () => {
    expect(isInOpenRange('BTN', '87o')).toBe(false);
  });
});

describe('isInOpenRange - SB', () => {
  test('54s は SB レンジに含まれる', () => {
    expect(isInOpenRange('SB', '54s')).toBe(true);
  });

  test('43s は SB レンジに含まれない', () => {
    expect(isInOpenRange('SB', '43s')).toBe(false);
  });

  test('T9o は SB レンジに含まれる（単体指定）', () => {
    expect(isInOpenRange('SB', 'T9o')).toBe(true);
  });

  test('98o は SB レンジに含まれない', () => {
    expect(isInOpenRange('SB', '98o')).toBe(false);
  });
});

describe('isInOpenRange - BB', () => {
  test('BB は常に false（オープン側の対象外）', () => {
    expect(isInOpenRange('BB', 'AA')).toBe(false);
  });
});

describe('getRfiNotation / getPositionPrinciple', () => {
  test('対象ポジションはレンジ全文と原則テキストが取得できる', () => {
    expect(getRfiNotation('UTG')).toContain('55+');
    expect(getPositionPrinciple('BTN')).toContain('BTN');
  });

  test('BB は対象外のため null になる', () => {
    expect(getRfiNotation('BB')).toBeNull();
    expect(getPositionPrinciple('BB')).toBeNull();
  });
});
