import { useQuery } from '@tanstack/react-query';
import { ApiError, getJson } from '../../app/api/client';

export type InvoiceStatus = 'DRAFT' | 'PENDING' | 'COMPLETED';
export interface Invoice { id: string; billingMonth: string; student: { name: string; nickname: string | null }; schoolClass: { id: string; name: string }; status: InvoiceStatus; total: number; createdAt: string; updatedAt: string; }
export interface InvoiceList { data: Invoice[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface InvoiceFilters { billingMonth: string; search: string; status: '' | InvoiceStatus; classId: string; page: number; }

function invalid(): never { throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); }
export function parseInvoice(value: unknown): Invoice {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>; const student = item.student as Record<string, unknown>; const schoolClass = item.schoolClass as Record<string, unknown>;
  if (typeof item.id !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(item.billingMonth as string) || !student || typeof student.name !== 'string' || (student.nickname !== null && typeof student.nickname !== 'string') || !schoolClass || typeof schoolClass.id !== 'string' || typeof schoolClass.name !== 'string' || !['DRAFT', 'PENDING', 'COMPLETED'].includes(item.status as string) || !Number.isSafeInteger(item.total) || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) return invalid();
  return { id: item.id, billingMonth: item.billingMonth as string, student: { name: student.name, nickname: student.nickname as string | null }, schoolClass: { id: schoolClass.id, name: schoolClass.name }, status: item.status as InvoiceStatus, total: item.total as number, createdAt: item.createdAt, updatedAt: item.updatedAt };
}
function parseList(value: unknown): InvoiceList {
  if (!value || typeof value !== 'object') return invalid();
  const response = value as { data?: unknown; meta?: unknown }; const meta = response.meta as Record<string, unknown>;
  if (!Array.isArray(response.data) || !meta || !['page', 'pageSize', 'total', 'pageCount'].every((key) => Number.isSafeInteger(meta[key])) || (meta.page as number) < 1 || (meta.pageSize as number) < 1 || (meta.total as number) < 0 || (meta.pageCount as number) !== Math.max(1, Math.ceil((meta.total as number) / (meta.pageSize as number)))) return invalid();
  return { data: response.data.map(parseInvoice), meta: meta as InvoiceList['meta'] };
}
function parseAction(value: unknown): Invoice { if (!value || typeof value !== 'object' || !('data' in value)) return invalid(); return parseInvoice(value.data); }
function queryString(filters: InvoiceFilters): string { const params = new URLSearchParams({ billingMonth: filters.billingMonth, page: String(filters.page) }); if (filters.search) params.set('search', filters.search); if (filters.status) params.set('status', filters.status); if (filters.classId) params.set('classId', filters.classId); return params.toString(); }

export function useInvoices(filters: InvoiceFilters, enabled = true) { return useQuery({ queryKey: ['invoices', filters], enabled, queryFn: () => getJson<unknown>(`/invoices?${queryString(filters)}`).then(parseList) }); }
export function useInvoice(id: string) { return useQuery({ queryKey: ['invoices', id], enabled: Boolean(id), queryFn: () => getJson<unknown>(`/invoices/${id}`).then(parseAction) }); }
