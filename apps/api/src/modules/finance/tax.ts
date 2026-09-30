// Decision 2026-09-30: a receivable's tax category decides its VAT rate and the account it is paid into.
export const taxCategories = ["NOT_DECLARED", "EXEMPT", "VAT_0", "VAT_5", "VAT_8", "VAT_10"] as const;
export type TaxCategory = (typeof taxCategories)[number];
export type PaymentChannel = "SCHOOL" | "PERSONAL";

const rates: Record<TaxCategory, number | null> = { NOT_DECLARED: null, EXEMPT: null, VAT_0: 0, VAT_5: 5, VAT_8: 8, VAT_10: 10 };

export function isTaxCategory(value: unknown): value is TaxCategory {
  return typeof value === "string" && (taxCategories as readonly string[]).includes(value);
}

export function taxChannel(category: TaxCategory): PaymentChannel {
  return category === "NOT_DECLARED" ? "PERSONAL" : "SCHOOL";
}

export function vatRate(category: TaxCategory): number | null {
  return rates[category];
}

// VAT is charged on net after discount, per line, rounded half-up to whole VND.
export function vatAmount(netAmount: bigint, rate: number | null): bigint {
  return rate == null ? 0n : (netAmount * BigInt(rate) + 50n) / 100n;
}

export function taxedLine(netAmount: bigint, category: TaxCategory) {
  const rate = vatRate(category);
  const vat = vatAmount(netAmount, rate);
  return { taxCategorySnapshot: category, vatRateSnapshot: rate, vatAmount: vat, amount: netAmount + vat };
}

// VAT part of a VAT-inclusive amount: amount - round_half_up(amount * 100 / (100 + rate)).
// For amount = net + vatAmount(net, rate) it returns exactly vatAmount(net, rate).
export function includedVat(amount: bigint, rate: number | null): bigint {
  if (!rate) return 0n;
  const divisor = BigInt(100 + rate);
  return amount - (amount * 200n + divisor) / (2n * divisor);
}
