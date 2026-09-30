import { describe, expect, it } from 'vitest';
import { includedVat, taxChannel, taxCategories, taxedLine, vatAmount, vatRate } from './tax.js';

describe('receivable tax', () => {
  it('routes only NOT_DECLARED to the personal account', () => {
    expect(taxCategories.map((category) => [category, taxChannel(category), vatRate(category)])).toEqual([
      ['NOT_DECLARED', 'PERSONAL', null], ['EXEMPT', 'SCHOOL', null], ['VAT_0', 'SCHOOL', 0], ['VAT_5', 'SCHOOL', 5], ['VAT_8', 'SCHOOL', 8], ['VAT_10', 'SCHOOL', 10],
    ]);
  });
  it('rounds VAT half-up to whole VND on net after discount', () => {
    expect(vatAmount(3150000n, 5)).toBe(157500n);
    expect(vatAmount(10n, 5)).toBe(1n); // 0.5 -> 1
    expect(vatAmount(9n, 5)).toBe(0n); // 0.45 -> 0
    expect(vatAmount(1234567n, 8)).toBe(98765n); // 98765.36
    expect(vatAmount(1000n, 0)).toBe(0n);
    expect(vatAmount(1000n, null)).toBe(0n);
    expect(taxedLine(3150000n, 'VAT_5')).toEqual({ taxCategorySnapshot: 'VAT_5', vatRateSnapshot: 5, vatAmount: 157500n, amount: 3307500n });
    expect(taxedLine(500n, 'EXEMPT')).toEqual({ taxCategorySnapshot: 'EXEMPT', vatRateSnapshot: null, vatAmount: 0n, amount: 500n });
  });
  it('stays exact at the maximum safe VND', () => {
    expect(vatAmount(9007199254740991n, 10)).toBe(900719925474099n);
  });
  it('splits the VAT back out of a VAT-inclusive refund amount', () => {
    for (const rate of [5, 8, 10]) for (let net = 0n; net < 3000n; net += 7n) expect(includedVat(net + vatAmount(net, rate), rate)).toBe(vatAmount(net, rate));
    expect(includedVat(110n, 10)).toBe(10n);
    expect(includedVat(55n, 10)).toBe(5n); // net 50
    expect(includedVat(1000n, 0)).toBe(0n);
    expect(includedVat(1000n, null)).toBe(0n);
  });
});
