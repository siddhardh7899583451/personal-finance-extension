import { describe, it, expect } from 'vitest';
import { toMinor, toMajor, formatMoney, addMinor, percentOf } from '../src/utils/money';

describe('money utils', () => {
  it('converts major to minor for INR', () => {
    expect(toMinor(100.5, 'INR')).toBe(10050);
    expect(toMinor('99.99', 'INR')).toBe(9999);
  });

  it('converts minor back to major', () => {
    expect(toMajor(10050, 'INR')).toBe(100.5);
  });

  it('formats INR', () => {
    const s = formatMoney(10050, 'INR');
    expect(s).toContain('100.50');
    expect(s).toContain('₹');
  });

  it('adds minor units safely', () => {
    expect(addMinor(100, 200, 50)).toBe(350);
  });

  it('computes percentage', () => {
    expect(percentOf(25, 100)).toBe(25);
    expect(percentOf(0, 0)).toBe(0);
  });
});
