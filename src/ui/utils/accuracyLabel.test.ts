import { describe, expect, it } from 'vitest';
import { describeAccuracy, MIN_SAMPLE_FOR_ACCURACY } from './accuracyLabel';

describe('describeAccuracy', () => {
  it('total=0のときは kind=none を返す', () => {
    // Act
    const result = describeAccuracy(0, 0);

    // Assert
    expect(result).toEqual({ kind: 'none' });
  });

  it(`0 < total < ${MIN_SAMPLE_FOR_ACCURACY} のときは kind=learning を返す（正答率0%を出さないため）`, () => {
    // Act & Assert
    for (let total = 1; total < MIN_SAMPLE_FOR_ACCURACY; total += 1) {
      expect(describeAccuracy(total, 0)).toEqual({ kind: 'learning' });
      expect(describeAccuracy(total, 1)).toEqual({ kind: 'learning' });
    }
  });

  it(`total >= ${MIN_SAMPLE_FOR_ACCURACY} のときは kind=measured で四捨五入した%を返す`, () => {
    // Act
    const result = describeAccuracy(MIN_SAMPLE_FOR_ACCURACY, 2 / 3);

    // Assert
    expect(result).toEqual({ kind: 'measured', percent: 67 });
  });

  it('total=0のときはaccuracyの値に関わらずnone扱いになる', () => {
    // Act
    const result = describeAccuracy(0, 0.9);

    // Assert
    expect(result).toEqual({ kind: 'none' });
  });
});
