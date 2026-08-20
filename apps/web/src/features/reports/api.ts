import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from '../../app/api/client';

export interface MonthlyReport { billingMonth: string; counts: { draft: number; pending: number; completed: number }; totalCollected: number; cashCollected: number; transferCollected: number; transferBreakdown: { bankCode: string; accountNumber: string; accountHolderName: string; total: number }[]; }
const monthPattern = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/;
function invalid(): never { throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); }

export function parseMonthlyReport(value: unknown): MonthlyReport {
  if (!value || typeof value !== 'object' || !('data' in value)) return invalid();
  const data = value.data as Record<string, unknown>; const counts = data.counts as Record<string, unknown>;
  if (!counts || typeof data.billingMonth !== 'string' || !monthPattern.test(data.billingMonth) || !['draft', 'pending', 'completed'].every((key) => Number.isSafeInteger(counts[key]) && (counts[key] as number) >= 0) || !['totalCollected', 'cashCollected', 'transferCollected'].every((key) => Number.isSafeInteger(data[key]) && (data[key] as number) >= 0) || (data.totalCollected as number) !== (data.cashCollected as number) + (data.transferCollected as number) || !Array.isArray(data.transferBreakdown)) return invalid();
  const transferBreakdown = data.transferBreakdown.map((value) => { const item = value as Record<string, unknown>; if (!item || !['bankCode', 'accountNumber', 'accountHolderName'].every((key) => typeof item[key] === 'string') || !Number.isSafeInteger(item.total) || (item.total as number) < 0) return invalid(); return { bankCode: item.bankCode as string, accountNumber: item.accountNumber as string, accountHolderName: item.accountHolderName as string, total: item.total as number }; });
  if (transferBreakdown.reduce((total, account) => total + account.total, 0) !== data.transferCollected) return invalid();
  return { billingMonth: data.billingMonth, counts: { draft: counts.draft as number, pending: counts.pending as number, completed: counts.completed as number }, totalCollected: data.totalCollected as number, cashCollected: data.cashCollected as number, transferCollected: data.transferCollected as number, transferBreakdown };
}

export function useMonthlyReport(billingMonth: string, enabled = true) { return useQuery({ queryKey: ['reports', 'monthly', billingMonth], enabled, placeholderData: (previousData) => previousData, queryFn: () => getJson<unknown>(`/reports/monthly?billingMonth=${billingMonth}`).then(parseMonthlyReport) }); }
