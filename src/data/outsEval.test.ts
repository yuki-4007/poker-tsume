import { describe, expect, test } from 'vitest';
import type { CardStr } from '../types';
import { classifyOuts, countOuts, makesFlush, makesStraight, unseenCards } from './outsEval';

describe('unseenCards / countOuts - 基礎', () => {
  test('unseenCards は既知5枚を除いた47枚を返す', () => {
    const known: CardStr[] = ['As', 'Ks', 'Qs', '7s', '2h'];
    expect(unseenCards(known).length).toBe(47);
  });

  test('countOuts は predicate を満たす未見カードの枚数を数える', () => {
    const known: CardStr[] = ['As', 'Ks', 'Qs', '7s', '2h'];
    // 手計算: ♠は13枚中4枚（As,Ks,Qs,7s）が見えているので残り9枚
    expect(countOuts(known, (c) => c[1] === 's')).toBe(9);
  });
});

describe('makesFlush / makesStraight - 単体判定', () => {
  test('同スート5枚目でフラッシュ完成と判定する', () => {
    const known: CardStr[] = ['As', 'Ks', 'Qs', '7s', '2h'];
    expect(makesFlush(known, '3s')).toBe(true);
    expect(makesFlush(known, '3h')).toBe(false);
  });

  test('5連続ランクでストレート完成と判定する（エースをローとしても扱う）', () => {
    // 手計算: 2,3,4,5 に A(ロー) を加えると A-2-3-4-5 のホイールが完成する
    const known: CardStr[] = ['2c', '3d', '4h', '5s', 'Kd'];
    expect(makesStraight(known, 'Ac')).toBe(true);
    expect(makesStraight(known, '9c')).toBe(false);
  });
});

// ------------------------------------------------------------
// classifyOuts - 各テンプレート最低2ケース（手計算で検証済み）
// ------------------------------------------------------------

describe('classifyOuts - フラッシュドロー(9)', () => {
  test('As Ks / Qs 7s 2h: ♠が4枚見えており残り9枚。ペア・ストレートドロー無し', () => {
    // 手計算: ♠13枚 - 見えている4枚(As,Ks,Qs,7s) = 9枚。ランクはA,K,Q,7,2で連続なし
    const result = classifyOuts(['As', 'Ks'], ['Qs', '7s', '2h']);
    expect(result?.kind).toBe('flush');
    expect(result?.outs).toBe(9);
    expect(result?.flushSuit).toBe('s');
  });

  test('9h 3h / Jh 4h Kd: ♥が4枚見えており残り9枚', () => {
    const result = classifyOuts(['9h', '3h'], ['Jh', '4h', 'Kd']);
    expect(result?.kind).toBe('flush');
    expect(result?.outs).toBe(9);
    expect(result?.flushSuit).toBe('h');
  });
});

describe('classifyOuts - OESD(8)', () => {
  test('9c 8d / 7h 6s 2c: 6-7-8-9の4連続。5か10でストレート完成、8枚', () => {
    // 手計算: 完成ランクは5と10の2種、各4枚ずつ見えていないので4+4=8枚
    const result = classifyOuts(['9c', '8d'], ['7h', '6s', '2c']);
    expect(result?.kind).toBe('oesd');
    expect(result?.outs).toBe(8);
    expect(result?.straightRanks).toEqual(['T', '5']);
  });

  test('7s 6h / 5d 4c Kd: 4-5-6-7の4連続。3か8でストレート完成、8枚', () => {
    const result = classifyOuts(['7s', '6h'], ['5d', '4c', 'Kd']);
    expect(result?.kind).toBe('oesd');
    expect(result?.outs).toBe(8);
    expect(result?.straightRanks).toEqual(['8', '3']);
  });
});

describe('classifyOuts - ガットショット(4)', () => {
  test('9c 8d / 6h 5s 2c: 5,6,8,9で7だけ欠けている。7のみ完成、4枚', () => {
    // 手計算: 7は残り4枚見えていないので4枚のみ
    const result = classifyOuts(['9c', '8d'], ['6h', '5s', '2c']);
    expect(result?.kind).toBe('gutshot');
    expect(result?.outs).toBe(4);
    expect(result?.straightRanks).toEqual(['7']);
  });

  test('Qc Jd / 9h 8s 3c: 8,9,11,12でT(10)だけ欠けている。Tのみ完成、4枚', () => {
    const result = classifyOuts(['Qc', 'Jd'], ['9h', '8s', '3c']);
    expect(result?.kind).toBe('gutshot');
    expect(result?.outs).toBe(4);
    expect(result?.straightRanks).toEqual(['T']);
  });
});

describe('classifyOuts - ポケットペア→セット(2)', () => {
  test('7c 7d / Ks 9h 2s: 77のポケットペア。Kがオーバーカードでボード未ペア。7が残り2枚', () => {
    // 手計算: 7は4枚中2枚(7c,7d)が既知なので残り4-2=2枚
    const result = classifyOuts(['7c', '7d'], ['Ks', '9h', '2s']);
    expect(result?.kind).toBe('pocketPair');
    expect(result?.outs).toBe(2);
    expect(result?.pocketRank).toBe('7');
  });

  test('Th Td / As 7c 3d: TTのポケットペア。Aがオーバーカードでボード未ペア。Tが残り2枚', () => {
    const result = classifyOuts(['Th', 'Td'], ['As', '7c', '3d']);
    expect(result?.kind).toBe('pocketPair');
    expect(result?.outs).toBe(2);
    expect(result?.pocketRank).toBe('T');
  });
});

describe('classifyOuts - オーバーカード2枚(6)', () => {
  test('As Kd / 9h 7d 2c: A,Kはボード最高ランク(9)より上。各3枚ずつで6枚', () => {
    // 手計算: Aは残り3枚、Kは残り3枚。3+3=6枚
    const result = classifyOuts(['As', 'Kd'], ['9h', '7d', '2c']);
    expect(result?.kind).toBe('overcards');
    expect(result?.outs).toBe(6);
    expect(result?.overcardRanks).toEqual(['A', 'K']);
  });

  test('Qs Jc / 8h 5d 2c: Q,Jはボード最高ランク(8)より上。各3枚ずつで6枚', () => {
    const result = classifyOuts(['Qs', 'Jc'], ['8h', '5d', '2c']);
    expect(result?.kind).toBe('overcards');
    expect(result?.outs).toBe(6);
    expect(result?.overcardRanks).toEqual(['Q', 'J']);
  });
});

describe('classifyOuts - フラッシュ+ガットショット(12)', () => {
  test('9s 8s / 6s 5s 2h: ♠4枚(9,8,6,5)＋7だけ欠けた中抜け。重複1枚を除き12枚', () => {
    // 手計算: フラッシュ9枚 + ガットショット4枚 - 重複(7s)1枚 = 12枚
    const result = classifyOuts(['9s', '8s'], ['6s', '5s', '2h']);
    expect(result?.kind).toBe('flushGutshot');
    expect(result?.outs).toBe(12);
  });

  test('Kd Qd / Td 9d 3h: ♦4枚(K,Q,T,9)＋Jだけ欠けた中抜け。重複1枚を除き12枚', () => {
    const result = classifyOuts(['Kd', 'Qd'], ['Td', '9d', '3h']);
    expect(result?.kind).toBe('flushGutshot');
    expect(result?.outs).toBe(12);
  });
});

describe('classifyOuts - フラッシュ+OESD(15)', () => {
  test('9s 8s / 7s 6s 2h: ♠4枚(9,8,7,6)のOESD。重複2枚を除き15枚', () => {
    // 手計算: フラッシュ9枚 + OESD8枚 - 重複2枚 = 15枚
    const result = classifyOuts(['9s', '8s'], ['7s', '6s', '2h']);
    expect(result?.kind).toBe('flushOesd');
    expect(result?.outs).toBe(15);
  });

  test('8c 7c / 6c 5c Kd: ♣4枚(8,7,6,5)のOESD。重複2枚を除き15枚', () => {
    const result = classifyOuts(['8c', '7c'], ['6c', '5c', 'Kd']);
    expect(result?.kind).toBe('flushOesd');
    expect(result?.outs).toBe(15);
  });
});

describe('classifyOuts - 想定外の混入は null', () => {
  test('既にフラッシュが完成している（同スート5枚）は null', () => {
    const result = classifyOuts(['As', 'Ks'], ['Qs', '7s', '3s']);
    expect(result).toBeNull();
  });

  test('ボードにペアがある（意図しないペア）は null', () => {
    const result = classifyOuts(['As', 'Kd'], ['9h', '9c', '2c']);
    expect(result).toBeNull();
  });

  test('重複カード（同一カードが手札とボードに重複）は null', () => {
    const result = classifyOuts(['As', 'Ks'], ['As', '7s', '2h']);
    expect(result).toBeNull();
  });

  test('board が3枚でない場合は null', () => {
    const result = classifyOuts(['As', 'Ks'], ['Qs', '7s']);
    expect(result).toBeNull();
  });

  test('ポケットペアでボードに同ランクがある（既にトリップス）は null', () => {
    const result = classifyOuts(['7c', '7d'], ['7h', '9h', '2s']);
    expect(result).toBeNull();
  });
});
