import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type StudentStatus = 'ACTIVE' | 'INACTIVE';
export interface Student { id: string; fullName: string; nickname: string | null; classId: string | null; status: StudentStatus; createdAt: string; updatedAt: string; }
export interface StudentList { data: Student[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }
export interface StudentFilters { search: string; status: '' | StudentStatus; page: number; }
export interface StudentInput { fullName: string; nickname?: string | null; }

function parseStudent(value: unknown): Student {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.fullName !== 'string' || (item.nickname !== null && typeof item.nickname !== 'string') || (item.classId !== null && (typeof item.classId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item.classId))) || (item.status !== 'ACTIVE' && item.status !== 'INACTIVE') || typeof item.createdAt !== 'string' || Number.isNaN(Date.parse(item.createdAt)) || typeof item.updatedAt !== 'string' || Number.isNaN(Date.parse(item.updatedAt))) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { id: item.id, fullName: item.fullName, nickname: item.nickname, classId: item.classId, status: item.status, createdAt: item.createdAt, updatedAt: item.updatedAt } as Student;
}
function parseList(value: unknown): StudentList {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const response = value as { data?: unknown; meta?: unknown };
  if (!Array.isArray(response.data) || !response.meta || typeof response.meta !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const meta = response.meta as Record<string, unknown>;
  if (!['page', 'pageSize', 'total', 'pageCount'].every((key) => Number.isSafeInteger(meta[key])) || (meta.page as number) < 1 || (meta.pageSize as number) < 1 || (meta.total as number) < 0 || (meta.pageCount as number) !== Math.max(1, Math.ceil((meta.total as number) / (meta.pageSize as number)))) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { data: response.data.map(parseStudent), meta: meta as StudentList['meta'] };
}
function parseAction(value: unknown): Student { if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); return parseStudent(value.data); }
function queryString(filters: StudentFilters): string { const params = new URLSearchParams({ page: String(filters.page) }); if (filters.search) params.set('search', filters.search); if (filters.status) params.set('status', filters.status); return params.toString(); }

export function useStudents(filters: StudentFilters) { return useQuery({ queryKey: ['students', filters], queryFn: () => getJson<unknown>(`/students?${queryString(filters)}`).then(parseList) }); }
export function useSaveStudent() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id?: string; input: StudentInput }) => requestJson<unknown>(id ? `/students/${id}` : '/students', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['students'] }) }); }
export function useStudentStatus() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, status }: { id: string; status: StudentStatus }) => requestJson<unknown>(`/students/${id}/${status === 'ACTIVE' ? 'reactivate' : 'withdraw'}`, { method: 'POST' }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['students'] }) }); }
