import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { App } from './app';

describe('Parent PWA login shell', () => {
  it('shows only the Parent Google sign-in surface when bootstrap is unauthorized', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 401 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tiếp tục với Google' }).getAttribute('href')).toBe('/api/parent/auth/google');
  });
  it('clears the protected surface and routes to login even when logout fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'parent-1', email: 'parent@example.com', displayName: null } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'csrf' } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 })));
    window.history.pushState({}, '', '/');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }));
    expect(await screen.findByRole('heading', { name: 'Dành cho phụ huynh' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Hóa đơn cần thanh toán' })).toBeNull();
  });
});
