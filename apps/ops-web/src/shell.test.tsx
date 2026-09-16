import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpsShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'ops_csrf=; Max-Age=0'; });

describe('OpsShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<OpsShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Quản lý trường đang được khởi tạo.')).toBeNull();
  });

  it('clears protected content before a logout request settles', async () => {
    let settleLogout!: () => void;
    document.cookie = 'ops_csrf=csrf-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'ops', userIdentityId: 'id', email: 'a@example.com' } }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
    render(<OpsShell />);
    await screen.findByText('Quản lý trường đang được khởi tạo.');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByText('Quản lý trường đang được khởi tạo.')).toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập với Google' }).getAttribute('href')).toBe('/api/ops/auth/google/start');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/ops/auth/logout', expect.objectContaining({ headers: { 'x-csrf-token': 'csrf-value' } })));
    settleLogout();
  });
});
