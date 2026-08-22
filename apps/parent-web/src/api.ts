export class ApiError extends Error { constructor(readonly status: number) { super('Yêu cầu không thành công.'); } }
const base = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');
let csrfToken: string | undefined;

export interface ParentStudent { id: string; fullName: string; nickname: string | null; }
export interface ParentInvoice {
  id: string;
  student: { id: string; name: string; nickname: string | null };
  billingMonth: string;
  status: 'PENDING' | 'COMPLETED';
  total: number;
  paymentMethod: 'TRANSFER' | 'CASH';
  items: ParentInvoiceItem[];
}
export interface ParentInvoiceItem { description: string; feeGroup: string; amount: number; position: number; }
export interface ParentInvoicePage { data: ParentInvoice[]; meta: { page: number; pageSize: number; total: number; pageCount: number }; }

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') {
    if (!csrfToken) csrfToken = (await request<{ data: { csrfToken: string } }>('/parent/auth/csrf')).data.csrfToken;
    headers.set('X-CSRF-Token', csrfToken);
  }
  const response = await fetch(`${base}${path}`, { ...init, headers, credentials: 'include' });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}

export function clearClientSession(): void { csrfToken = undefined; }

export function parentStudents(): Promise<ParentStudent[]> {
  return request<{ data: ParentStudent[] }>('/parent/students').then((result) => result.data);
}

export async function pendingInvoices(studentId?: string): Promise<ParentInvoice[]> {
  const invoices: ParentInvoice[] = [];
  for (let page = 1; ; page += 1) {
    const params = new URLSearchParams({ status: 'PENDING', page: String(page), pageSize: '100' });
    if (studentId) params.set('studentId', studentId);
    const result = await request<ParentInvoicePage>(`/parent/invoices?${params}`);
    invoices.push(...result.data);
    if (page >= result.meta.pageCount) return invoices;
  }
}

export function parentInvoice(invoiceId: string): Promise<ParentInvoice> {
  return request<{ data: ParentInvoice }>(`/parent/invoices/${invoiceId}`).then((result) => result.data);
}

export function completedInvoices(filters: { studentId?: string; billingMonth?: string; page: number }): Promise<ParentInvoicePage> {
  const params = new URLSearchParams({ status: 'COMPLETED', page: String(filters.page), pageSize: '20' });
  if (filters.studentId) params.set('studentId', filters.studentId);
  if (filters.billingMonth) params.set('billingMonth', filters.billingMonth);
  return request<ParentInvoicePage>(`/parent/invoices?${params}`);
}
