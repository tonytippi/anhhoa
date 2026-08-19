import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type ClassStatus = 'ACTIVE' | 'ARCHIVED';
export interface SchoolClass { id: string; name: string; monthlyTuition: number; status: ClassStatus; createdAt: string; updatedAt: string; activeStudentCount: number; }
export interface ClassList { data: SchoolClass[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface ClassFilters { search: string; status: '' | ClassStatus; page: number; }
export interface ClassInput { name: string; monthlyTuition: number; }

function parseClass(value: unknown): SchoolClass {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || !Number.isSafeInteger(item.monthlyTuition) || (item.status !== 'ACTIVE' && item.status !== 'ARCHIVED') || !Number.isSafeInteger(item.activeStudentCount) || (item.activeStudentCount as number) < 0 || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { id: item.id, name: item.name, monthlyTuition: item.monthlyTuition as number, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt, activeStudentCount: item.activeStudentCount as number };
}
function parseList(value: unknown): ClassList {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const response = value as { data?: unknown; meta?: unknown };
  if (!Array.isArray(response.data) || !response.meta || typeof response.meta !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const meta = response.meta as Record<string, unknown>;
  if (!['page', 'pageSize', 'total', 'pageCount'].every((key) => Number.isSafeInteger(meta[key])) || (meta.page as number) < 1 || (meta.pageSize as number) < 1 || (meta.total as number) < 0 || (meta.pageCount as number) !== Math.max(1, Math.ceil((meta.total as number) / (meta.pageSize as number)))) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { data: response.data.map(parseClass), meta: meta as ClassList['meta'] };
}
function parseAction(value: unknown): SchoolClass {
  if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return parseClass(value.data);
}
function queryString(filters: ClassFilters): string { const params = new URLSearchParams({ page: String(filters.page) }); if (filters.search) params.set('search', filters.search); if (filters.status) params.set('status', filters.status); return params.toString(); }

export function useClasses(filters: ClassFilters) { return useQuery({ queryKey: ['classes', filters], queryFn: () => getJson<unknown>(`/classes?${queryString(filters)}`).then(parseList) }); }
export function useSaveClass() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id?: string; input: ClassInput }) => requestJson<unknown>(id ? `/classes/${id}` : '/classes', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }) }); }
export function useArchiveClass() { const client = useQueryClient(); return useMutation({ mutationFn: (id: string) => requestJson<unknown>(`/classes/${id}/archive`, { method: 'POST' }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }) }); }
