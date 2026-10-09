import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); document.cookie = 'app_csrf=; Max-Age=0'; });

describe('AdminShell', () => {
  it('keeps protected content hidden after an unauthenticated startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<AdminShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng quản trị đang được khởi tạo.')).toBeNull();
    expect(document.querySelector('.admin-auth-shell')).not.toBeNull();
    expect(document.querySelector('.admin-auth-card')).not.toBeNull();
  });

  it('clears protected content before a logout request settles', async () => {
    let settleLogout!: () => void;
    document.cookie = 'app_csrf=csrf-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'app', userIdentityId: 'id', email: 'a@example.com' } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
    render(<AdminShell />);
    await screen.findByText('Đang tải ngữ cảnh trường...');
    expect(document.querySelector('.admin-app-shell')).not.toBeNull();
    expect(document.querySelector('.admin-main')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByText('Đang tải ngữ cảnh trường...')).toBeNull();
    expect(screen.getByRole('link', { name: 'Tiếp tục với a@example.com' }).getAttribute('href')).toBe('/api/app/auth/google/start?login_hint=a%40example.com');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/auth/logout', expect.objectContaining({ headers: { 'x-csrf-token': 'csrf-value' } })));
    settleLogout();
  });

  it('offers one-click sign-in for the last account and forgets it when switching accounts', async () => {
    localStorage.setItem('passionedu.lastAccount', JSON.stringify({ email: 'kien@example.com', displayName: 'Kiên Nguyễn', pictureUrl: null }));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<AdminShell />);
    const resume = await screen.findByRole('link', { name: /Tiếp tục với Kiên Nguyễn/ });
    expect(resume.getAttribute('href')).toBe('/api/app/auth/google/start?login_hint=kien%40example.com');
    expect(screen.getByText('kien@example.com')).toBeTruthy();
    const other = screen.getByRole('link', { name: 'Dùng tài khoản khác' });
    expect(other.getAttribute('href')).toBe('/api/app/auth/google/start?prompt=select_account');
    other.addEventListener('click', (event) => event.preventDefault());
    fireEvent.click(other);
    expect(localStorage.getItem('passionedu.lastAccount')).toBeNull();
  });
});
