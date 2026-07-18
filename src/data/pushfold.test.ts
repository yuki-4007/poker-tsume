import { describe, expect, test } from 'vitest';
import { getPushNotation, shouldPush } from './pushfold';

describe('shouldPush - SB', () => {
  test('SB 5BB: J4s はプッシュ対象（J4s+）', () => {
    expect(shouldPush('SB', 5, 'J4s')).toBe(true);
  });

  test('SB 5BB: J3s はプッシュ対象外', () => {
    expect(shouldPush('SB', 5, 'J3s')).toBe(false);
  });

  test('SB 10BB: Q5s はプッシュ対象（Q5s+）', () => {
    expect(shouldPush('SB', 10, 'Q5s')).toBe(true);
  });

  test('SB 10BB: Q4s はプッシュ対象外', () => {
    expect(shouldPush('SB', 10, 'Q4s')).toBe(false);
  });

  test('SB 15BB: K7s はプッシュ対象（K7s+）', () => {
    expect(shouldPush('SB', 15, 'K7s')).toBe(true);
  });

  test('SB 15BB: K6s はプッシュ対象外', () => {
    expect(shouldPush('SB', 15, 'K6s')).toBe(false);
  });
});

describe('shouldPush - BTN', () => {
  test('BTN 5BB: Q4s はプッシュ対象（Q4s+）', () => {
    expect(shouldPush('BTN', 5, 'Q4s')).toBe(true);
  });

  test('BTN 5BB: Q3s はプッシュ対象外', () => {
    expect(shouldPush('BTN', 5, 'Q3s')).toBe(false);
  });

  test('BTN 10BB: K5s はプッシュ対象（K5s+）', () => {
    expect(shouldPush('BTN', 10, 'K5s')).toBe(true);
  });

  test('BTN 10BB: K4s はプッシュ対象外', () => {
    expect(shouldPush('BTN', 10, 'K4s')).toBe(false);
  });

  test('BTN 15BB: K9s はプッシュ対象（K9s+）', () => {
    expect(shouldPush('BTN', 15, 'K9s')).toBe(true);
  });

  test('BTN 15BB: K8s はプッシュ対象外', () => {
    expect(shouldPush('BTN', 15, 'K8s')).toBe(false);
  });
});

describe('getPushNotation', () => {
  test('レンジ表記全文を取得できる', () => {
    expect(getPushNotation('SB', 5)).toContain('22+');
    expect(getPushNotation('BTN', 15)).toContain('KJo+');
  });
});
