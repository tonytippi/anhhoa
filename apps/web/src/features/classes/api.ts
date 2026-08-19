import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type ClassStatus = 'ACTIVE' | 'ARCHIVED';
export interface SchoolClass { id: string; name: string; monthlyTuition: number; status: ClassStatus; createdAt: string; updatedAt: string; activeStudentCount: number; }
export interface ClassList { data: SchoolClass[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface ClassFilters { search: string; status: '' | ClassStatus; page: number; pageSize?: number; }
export interface ClassInput { name: string; monthlyTuition: number; }
export interface TransferResult { source: SchoolClass; destination: SchoolClass; affectedStudentCount: number; operationId: string; }
export interface PendingOperation { operationId: string; state: 'PENDING'; }

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
function parseTransfer(value: unknown): TransferResult | PendingOperation {
  if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const data = value.data as Record<string, unknown>;
  if (data?.state === 'PENDING' && typeof data.operationId === 'string') return { operationId: data.operationId, state: 'PENDING' };
  if (!data || !Number.isSafeInteger(data.affectedStudentCount) || (data.affectedStudentCount as number) < 0 || typeof data.operationId !== 'string') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { source: parseClass(data.source), destination: parseClass(data.destination), affectedStudentCount: data.affectedStudentCount as number, operationId: data.operationId };
}
function parseOperation(value: unknown): TransferResult | PendingOperation {
  if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const data = value.data as Record<string, unknown>;
  if (data?.state === 'PENDING' && typeof data.operationId === 'string') return { operationId: data.operationId, state: 'PENDING' };
  return parseTransfer(value);
}
function queryString(filters: ClassFilters): string { const params = new URLSearchParams({ page: String(filters.page) }); if (filters.pageSize) params.set('pageSize', String(filters.pageSize)); if (filters.search) params.set('search', filters.search); if (filters.status) params.set('status', filters.status); return params.toString(); }

export function useClasses(filters: ClassFilters, enabled = true) { return useQuery({ queryKey: ['classes', filters], queryFn: () => getJson<unknown>(`/classes?${queryString(filters)}`).then(parseList), enabled }); }
export function useClass(id: string) { return useQuery({ queryKey: ['classes', id], queryFn: () => getJson<unknown>(`/classes/${id}`).then(parseAction), enabled: Boolean(id) }); }
export function useActiveClassesForPicker(enabled = true) {
  return useQuery({
    queryKey: ['classes', 'active-picker'],
    enabled,
    queryFn: async () => {
      const first = await getJson<unknown>('/classes?page=1&pageSize=100&status=ACTIVE').then(parseList);
      const pages = [first];
      for (let page = 2; page <= first.meta.pageCount; page += 1) pages.push(await getJson<unknown>(`/classes?page=${page}&pageSize=100&status=ACTIVE`).then(parseList));
      return { data: pages.flatMap((result) => result.data) };
    },
  });
}
export function useSaveClass() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id?: string; input: ClassInput }) => requestJson<unknown>(id ? `/classes/${id}` : '/classes', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }) }); }
export function useArchiveClass() { const client = useQueryClient(); return useMutation({ mutationFn: (id: string) => requestJson<unknown>(`/classes/${id}/archive`, { method: 'POST' }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['classes'] }) }); }
export function useTransferClass() {
  return useMutation({ mutationFn: ({ sourceClassId, destinationClassId, operationId }: { sourceClassId: string; destinationClassId: string; operationId: string }) => requestJson<unknown>(`/classes/${sourceClassId}/transfer`, { method: 'POST', headers: { 'Idempotency-Key': operationId }, body: JSON.stringify({ destinationClassId }) }).then(parseTransfer) });
}
export function getOperation(operationId: string) { return getJson<unknown>(`/operations/${operationId}`).then(parseOperation); }
