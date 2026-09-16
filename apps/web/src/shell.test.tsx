import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'app_csrf=; Max-Age=0'; });

describe('AdminShell', () => {
  it('keeps protected content hidden after an unauthenticated startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<AdminShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng quản trị đang được khởi tạo.')).toBeNull();
  });

  it('clears protected content before a logout request settles', async () => {
    let settleLogout!: () => void;
    document.cookie = 'app_csrf=csrf-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'app', userIdentityId: 'id', email: 'a@example.com' } }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
    render(<AdminShell />);
    await screen.findByText('Cổng quản trị đang được khởi tạo.');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByText('Cổng quản trị đang được khởi tạo.')).toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập với Google' }).getAttribute('href')).toBe('/api/app/auth/google/start');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/app/auth/logout', expect.objectContaining({ headers: { 'x-csrf-token': 'csrf-value' } })));
    settleLogout();
  });
});
