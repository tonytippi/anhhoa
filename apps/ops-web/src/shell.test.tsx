import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'ops_csrf=; Max-Age=0'; });

describe('OpsShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<OpsShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByRole('table', { name: 'Danh sách trường của nền tảng' })).toBeNull();
  });

  it('clears protected content before a logout request settles', async () => {
    let settleLogout!: () => void;
    document.cookie = 'ops_csrf=csrf-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'ops', userIdentityId: 'id', email: 'a@example.com' } }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
    render(<OpsShell />);
    await screen.findByRole('button', { name: 'Khởi tạo trường' });
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByRole('button', { name: 'Khởi tạo trường' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập với Google' }).getAttribute('href')).toBe('/api/ops/auth/google/start');
    await waitFor(() => expect((fetch as ReturnType<typeof vi.fn>).mock.calls).toContainEqual(['/api/ops/auth/logout', expect.objectContaining({ headers: { 'x-csrf-token': 'csrf-value' } })]));
    settleLogout();
  });
  it('persists a timed-out operation, disables duplicates, reconciles it, then reloads server state', async () => {
    document.cookie = 'ops_csrf=csrf-value';
    let finishReconcile!: (response: Response) => void; const reconciliation = new Promise<Response>((resolve) => { finishReconcile = resolve; }); const timedOut = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'ops', userIdentityId: 'id', email: 'a@example.com' } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockRejectedValueOnce(new TypeError('network')).mockReturnValueOnce(reconciliation).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })));
    vi.stubGlobal('fetch', timedOut); vi.stubGlobal('crypto', { randomUUID: vi.fn().mockReturnValueOnce('11111111-1111-4111-8111-111111111111').mockReturnValue('22222222-2222-4222-8222-222222222222') });
    render(<OpsShell />); await screen.findByRole('button', { name: 'Khởi tạo trường' }); fireEvent.click(screen.getByRole('button', { name: 'Khởi tạo trường' })); fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường A' } }); fireEvent.change(screen.getByLabelText('Mã trường'), { target: { value: 'truong-a' } }); fireEvent.change(screen.getByLabelText('Tiền tố mã học sinh'), { target: { value: 'pe' } }); fireEvent.change(screen.getByLabelText('Email chủ sở hữu đầu tiên'), { target: { value: 'a@example.com' } }); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận' }));
    await screen.findByRole('alert'); expect(sessionStorage.getItem('passionedu.ops.pending-operation')).toContain('11111111-1111-4111-8111-111111111111'); expect(screen.getByRole('button', { name: 'Khởi tạo trường' }).hasAttribute('disabled')).toBe(true); expect(timedOut).toHaveBeenCalledWith('/api/ops/operations/11111111-1111-4111-8111-111111111111', { credentials: 'include' }); finishReconcile(new Response(JSON.stringify({ data: { id: '11111111-1111-4111-8111-111111111111', status: 'COMPLETED' } }))); await waitFor(() => expect(sessionStorage.getItem('passionedu.ops.pending-operation')).toBeNull());
  });
  it('submits the normalized student-code prefix and displays persisted prefix data', async () => {
    const session = new Response(JSON.stringify({ data: { audience: 'ops', userIdentityId: 'id', email: 'a@example.com' } }));
    const schools = new Response(JSON.stringify({ data: [{ id: 'school-a', name: 'Trường A', slug: 'truong-a', studentCodePrefix: 'PE', status: 'ACTIVE', ownerEmail: 'a@example.com', ownerBound: true, updatedAt: '2026-01-01T00:00:00.000Z' }] }));
    const fetch = vi.fn().mockResolvedValueOnce(session).mockResolvedValueOnce(schools);
    vi.stubGlobal('fetch', fetch); render(<OpsShell />); fireEvent.click(await screen.findByRole('button', { name: 'Khởi tạo trường' })); fireEvent.change(screen.getByLabelText('Tiền tố mã học sinh'), { target: { value: 'pe' } }); expect((screen.getByLabelText('Tiền tố mã học sinh') as HTMLInputElement).value).toBe('PE'); expect(await screen.findByText('PE')).toBeTruthy();
  });
  it('traps dialog focus and closes on Escape with focus returned to its opener', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'ops', userIdentityId: 'id', email: 'a@example.com' } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] })))); render(<OpsShell />); const opener = await screen.findByRole('button', { name: 'Khởi tạo trường' }); fireEvent.click(opener); const first = screen.getByLabelText('Tên trường'); const confirm = screen.getByRole('button', { name: 'Xác nhận' }); expect(document.activeElement).toBe(first); confirm.focus(); fireEvent.keyDown(document, { key: 'Tab' }); expect(document.activeElement).toBe(first); fireEvent.keyDown(document, { key: 'Escape' }); expect(screen.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(opener);
  });
});
