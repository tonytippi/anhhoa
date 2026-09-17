import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterWorkspace } from './roster-workspace';

const year = { id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true };
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('RosterWorkspace', () => {
  it('keeps invalid SchoolYear input, focuses the summary, and renders field errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.', fieldErrors: { name: 'Tên cần từ 1 đến 100 ký tự.' } } }), { status: 400 }));
    vi.stubGlobal('fetch', fetch); render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Tên năm học'), { target: { value: '   ' } }); fireEvent.submit(screen.getByRole('button', { name: 'Tạo năm học' }).closest('form')!);
    expect(await screen.findByText('Tên cần từ 1 đến 100 ký tự.')).toBeTruthy(); expect(document.activeElement?.getAttribute('role')).toBe('alert'); expect((screen.getByLabelText('Tên năm học') as HTMLInputElement).value).toBe('   ');
  });
  it('creates only from server confirmation and supports Class rename', async () => {
    const classroom = { id: 'class-a', schoolYearId: 'year-a', name: 'Lớp Mầm', status: 'ACTIVE', createdAt: '', updatedAt: '' };
    let classReads = 0; const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(new Response(JSON.stringify({ data: { id: 'rename-operation' } })));
      if (url.endsWith('/classes')) return Promise.resolve(new Response(JSON.stringify({ data: [classReads++ ? { ...classroom, name: 'Lớp Chồi' } : classroom] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [year] })));
    });
    vi.stubGlobal('fetch', fetch); render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText('Lớp Mầm')).toBeTruthy(); fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' })); fireEvent.change(screen.getByRole('dialog').querySelector('input')!, { target: { value: 'Lớp Chồi' } }); fireEvent.submit(screen.getByRole('button', { name: 'Lưu tên lớp' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/classes/class-a/name', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Lớp Chồi' }) }))); await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
  it('persists an uncertain mutation and reconciles its Operation without replaying the POST', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockRejectedValueOnce(new TypeError('timeout')).mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: 'PENDING' } })));
    vi.stubGlobal('fetch', fetch); render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Tên năm học'), { target: { value: 'Năm 2026' } }); fireEvent.submit(screen.getByRole('button', { name: 'Tạo năm học' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toContain('school-a')); expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/school-years') && options?.method === 'POST')).toHaveLength(1);
  });
  it('keeps class errors separate from SchoolYear errors and describes the invalid field', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [year] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Lớp không hợp lệ.', fieldErrors: { name: 'Tên lớp là bắt buộc.' } } }), { status: 400 }));
    vi.stubGlobal('fetch', fetch); render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />); await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2026' }); fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: ' ' } }); fireEvent.submit(screen.getByRole('button', { name: 'Tạo lớp' }).closest('form')!);
    expect(await screen.findByText('Tên lớp là bắt buộc.')).toBeTruthy(); expect(screen.getByLabelText('Tên lớp').getAttribute('aria-invalid')).toBe('true'); expect(screen.getByLabelText('Tên lớp').getAttribute('aria-describedby')).toBe('name-error'); expect(screen.queryByText('Tên cần từ 1 đến 100 ký tự.')).toBeNull();
  });
  it('ignores a delayed denied roster request after its school changes', async () => {
    let resolveA!: (response: Response) => void; const delayedA = new Promise<Response>((resolve) => { resolveA = resolve; }); const denied = vi.fn(); const fetch = vi.fn().mockReturnValueOnce(delayedA).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', fetch); const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />); view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={denied} />); resolveA(new Response(null, { status: 403 })); await screen.findByText('Năm học của Trường B'); expect(denied).not.toHaveBeenCalled();
  });
});
