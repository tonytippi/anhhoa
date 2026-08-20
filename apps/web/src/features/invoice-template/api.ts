import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, getJson, requestJson } from '../../app/api/client';

export type AmountSource = 'FIXED' | 'CLASS_TUITION';
export interface InvoiceTemplateItem { id: string; description: string; feeGroup: string | null; position: number; amountSource: AmountSource; fixedAmount?: number; createdAt: string; updatedAt: string; }
export interface InvoiceTemplate { id: string; items: InvoiceTemplateItem[]; createdAt: string; updatedAt: string; }
export interface InvoiceTemplateInput { description: string; feeGroup?: string; amountSource: AmountSource; fixedAmount?: number; }

function parseItem(value: unknown): InvoiceTemplateItem {
  if (!value || typeof value !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || typeof item.description !== 'string' || (item.feeGroup !== null && typeof item.feeGroup !== 'string') || !Number.isSafeInteger(item.position) || (item.position as number) < 0 || (item.amountSource !== 'FIXED' && item.amountSource !== 'CLASS_TUITION') || typeof item.createdAt !== 'string' || typeof item.updatedAt !== 'string') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  if (item.amountSource === 'FIXED' && !Number.isSafeInteger(item.fixedAmount)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  if (item.amountSource === 'CLASS_TUITION' && 'fixedAmount' in item) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return item as unknown as InvoiceTemplateItem;
}
function parseTemplate(value: unknown): InvoiceTemplate {
  if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const data = (value as { data: unknown }).data;
  if (!data || typeof data !== 'object') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  const template = data as Record<string, unknown>;
  if (typeof template.id !== 'string' || !Array.isArray(template.items) || typeof template.createdAt !== 'string' || typeof template.updatedAt !== 'string') throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.');
  return { id: template.id, items: template.items.map(parseItem), createdAt: template.createdAt, updatedAt: template.updatedAt };
}
function parseAction(value: unknown): InvoiceTemplateItem { if (!value || typeof value !== 'object' || !('data' in value)) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); return parseItem((value as { data: unknown }).data); }
function parseDelete(value: unknown, id: string): { id: string } { if (!value || typeof value !== 'object' || !('data' in value) || !(value as { data: unknown }).data || typeof (value as { data: { id?: unknown } }).data.id !== 'string' || (value as { data: { id: string } }).data.id !== id) throw new ApiError(502, 'INVALID_RESPONSE', 'Phản hồi API không hợp lệ.'); return { id }; }
export function useInvoiceTemplate() { return useQuery({ queryKey: ['invoice-template'], queryFn: () => getJson<unknown>('/invoice-template').then(parseTemplate) }); }
export function useSaveInvoiceTemplateItem() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, input }: { id?: string; input: InvoiceTemplateInput }) => requestJson<unknown>(id ? `/invoice-template/items/${id}` : '/invoice-template/items', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(input) }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['invoice-template'] }) }); }
export function useMoveInvoiceTemplateItem() { const client = useQueryClient(); return useMutation({ mutationFn: ({ id, direction }: { id: string; direction: 'up' | 'down' }) => requestJson<unknown>(`/invoice-template/items/${id}/move-${direction}`, { method: 'POST' }).then(parseAction), onSuccess: () => client.invalidateQueries({ queryKey: ['invoice-template'] }) }); }
export function useDeleteInvoiceTemplateItem() { const client = useQueryClient(); return useMutation({ mutationFn: (id: string) => requestJson<unknown>(`/invoice-template/items/${id}`, { method: 'DELETE' }).then((value) => parseDelete(value, id)), onSuccess: () => client.invalidateQueries({ queryKey: ['invoice-template'] }) }); }
