import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type ClassStatus = 'ACTIVE' | 'ARCHIVED';
export interface SchoolClass { id: string; name: string; monthlyTuition: number; status: ClassStatus; createdAt: string; updatedAt: string; activeStudents: { id: string; fullName: string }[]; }
export interface ClassList { data: SchoolClass[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface ClassFilters { search: string; status: '' | ClassStatus; page: number; }
export interface ClassInput { name: string; monthlyTuition: number; }

function parseClass(value: unknown): SchoolClass {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.name !== 'string' || !Number.isSafeInteger(item.monthlyTuition) || (item.status !== 'ACTIVE' && item.status !== 'ARCHIVED') || !Array.isArray(item.activeStudents)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { id: item.id, name: item.name, monthlyTuition: item.monthlyTuition as number, status: item.status, createdAt: String(item.createdAt), updatedAt: String(item.updatedAt), activeStudents: item.activeStudents.filter((student): student is { id: string; fullName: string } => !!student && typeof student === 'object' && typeof (student as Record<string, unknown>).id === 'string' && typeof (student as Record<string, unknown>).fullName === 'string') };
}
function parseList(value: unknown): ClassList {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const response = value as { data?: unknown; meta?: unknown };
  if (!Array.isArray(response.data) || !response.meta || typeof response.meta !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const meta = response.meta as Record<string, unknown>;
  if (!['page', 'pageSize', 'total', 'pageCount'].every((key) => Number.isSafeInteger(meta[key]))) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
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
