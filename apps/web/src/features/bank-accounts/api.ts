import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type BankAccountStatus = 'ACTIVE' | 'INACTIVE';
export interface BankAccount { id: string; bankCode: string; accountNumber: string; accountHolderName: string; status: BankAccountStatus; createdAt: string; updatedAt: string; }
export interface BankAccountList { data: BankAccount[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface BankAccountFilters { search: string; status: '' | BankAccountStatus; page: number; pageSize?: number; }
export interface BankAccountInput { bankCode: string; accountNumber: string; accountHolderName: string; }

function invalid(): never { throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); }
function parseAccount(value: unknown): BankAccount {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.bankCode !== 'string' || typeof item.accountNumber !== 'string' || typeof item.accountHolderName !== 'string' || (item.status !== 'ACTIVE' && item.status !== 'INACTIVE') || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) return invalid();
  return item as unknown as BankAccount;
}
function parseList(value: unknown): BankAccountList {
  if (!value || typeof value !== 'object') return invalid();
  const response = value as { data?: unknown; meta?: unknown };
  if (!Array.isArray(response.data) || !response.meta || typeof response.meta !== 'object') return invalid();
  const meta = response.meta as Record<string, unknown>;
  if (!['page', 'pageSize', 'total', 'pageCount'].every((key) => Number.isSafeInteger(meta[key])) || (meta.page as number) < 1 || (meta.pageSize as number) < 1 || (meta.total as number) < 0 || (meta.pageCount as number) !== Math.max(1, Math.ceil((meta.total as number) / (meta.pageSize as number)))) return invalid();
  return { data: response.data.map(parseAccount), meta: meta as BankAccountList['meta'] };
}
function parseAction(value: unknown): BankAccount { if (!value || typeof value !== 'object' || !('data' in value)) return invalid(); return parseAccount(value.data); }
function queryString(filters: BankAccountFilters): string { const params = new URLSearchParams({ page: String(filters.page) }); if (filters.pageSize) params.set('pageSize', String(filters.pageSize)); if (filters.search) params.set('search', filters.search); if (filters.status) params.set('status', filters.status); return params.toString(); }

export function useBankAccounts(filters: BankAccountFilters, enabled = true) { return useQuery({ queryKey: ['bank-accounts', filters], enabled, queryFn: () => getJson<unknown>(`/bank-accounts?${queryString(filters)}`).then(parseList) }); }
export function useCreateBankAccount() { const client = useQueryClient(); return useMutation({ mutationFn: (input: BankAccountInput) => requestJson<unknown>('/bank-accounts', { method: 'POST', body: JSON.stringify(input) }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['bank-accounts'] }) }); }
export function useSetBankAccountStatus() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, status }: { id: string; status: BankAccountStatus }) => requestJson<unknown>(`/bank-accounts/${id}/${status === 'ACTIVE' ? 'activate' : 'deactivate'}`, { method: 'POST' }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['bank-accounts'] }) }); }
