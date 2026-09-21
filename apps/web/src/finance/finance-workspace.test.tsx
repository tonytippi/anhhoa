import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FinanceWorkspace } from './finance-workspace';

const catalog = { groups: [], receivables: [] };
const run = { id: '11111111-1111-4111-8111-111111111111', schoolYearId: 'year-a', billingMonth: '2026-09', type: 'MONTHLY', status: 'DRAFT', version: 2, selectedStudentIds: ['22222222-2222-4222-8222-222222222222'] };
const candidates = { schoolYears: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', closedAt: null }], students: [{ id: run.selectedStudentIds[0], studentCode: 'HS001', fullName: 'Bé An' }] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('FinanceWorkspace', () => {
  it('renders server preview eligible rows and categorized skips without local classification', async () => {
    const preview = { run, fingerprint: 'server-fingerprint', eligible: [{ studentId: run.selectedStudentIds[0], studentCode: 'HS001', fullName: 'Bé An', className: 'Lá 1' }], skips: [{ studentId: '33333333-3333-4333-8333-333333333333', reason: 'CLASS_INACTIVE' }] };
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('/preview') ? response(preview) : url.includes('collection-run-candidates') ? response(candidates) : url.includes('collection-runs') ? response({ runs: [run] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết' })); fireEvent.click(screen.getByRole('button', { name: 'Xem trước từ máy chủ' }));
    expect(await screen.findByText('HS001 / Bé An')).toBeTruthy(); expect(screen.getByText((_, element) => element?.tagName === 'TD' && element.textContent?.includes('Lớp được phân công đã ngừng hoạt động.') === true)).toBeTruthy(); expect(screen.queryByText('CLASS_INACTIVE')).toBeNull();
  });
  it('keeps a stale preview error and selection for refresh', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, options?: RequestInit) => { if (options?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ error: { message: 'Bản xem trước đã cũ.' } }), { status: 409 })); if (url.includes('/preview')) return Promise.resolve(response({ run, fingerprint: 'old', eligible: [], skips: [] })); return Promise.resolve(url.includes('collection-run-candidates') ? response(candidates) : url.includes('collection-runs') ? response({ runs: [run] }) : response(catalog)); }));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết' })); fireEvent.click(screen.getByRole('button', { name: 'Xem trước từ máy chủ' })); await screen.findByRole('button', { name: 'Xác nhận preview và chuyển READY' }); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận preview và chuyển READY' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Bản xem trước đã cũ.'); expect((screen.getByLabelText('Chọn HS001 Bé An') as HTMLInputElement).checked).toBe(true);
  });
  it('reconciles an uncertain command instead of retrying it', async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => options?.method === 'POST' ? Promise.resolve(new Response(null, { status: 503 })) : url.includes('/operations/') ? response({ status: 'PENDING' }) : url.includes('collection-run-candidates') ? response(candidates) : url.includes('collection-runs') ? response({ runs: [] }) : response(catalog)); vi.stubGlobal('fetch', fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Năm học'), { target: { value: 'year-a' } }); fireEvent.change(screen.getByLabelText('Tháng thu'), { target: { value: '2026-09' } }); fireEvent.submit(screen.getByRole('button', { name: 'Mở hoặc vào đợt thu' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-finance-operation')).toContain('school-a')); expect(fetch.mock.calls.some(([url]) => url.includes('/operations/'))).toBe(true);
  });
  it('does not deny access for a missing finance resource', async () => {
    const denied = vi.fn();
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('/preview') ? new Response(JSON.stringify({ error: { message: 'Không tìm thấy đợt thu.' } }), { status: 404 }) : url.includes('collection-run-candidates') ? response(candidates) : url.includes('collection-runs') ? response({ runs: [run] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Mở chi tiết' })); fireEvent.click(screen.getByRole('button', { name: 'Xem trước từ máy chủ' }));
    await screen.findByRole('alert'); expect(denied).not.toHaveBeenCalled();
  });
});
