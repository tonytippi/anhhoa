import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TeacherShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'teacher_csrf=; Max-Age=0'; });

describe('TeacherShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<TeacherShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng vận hành lớp đang được khởi tạo.')).toBeNull();
  });

  it('clears protected content before a logout request settles', async () => {
    let settleLogout!: () => void;
    document.cookie = 'teacher_csrf=csrf-value';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'teacher', userIdentityId: 'id', email: 'a@example.com' } }))).mockImplementationOnce(() => new Promise<void>((resolve) => { settleLogout = resolve; })));
    render(<TeacherShell />);
    await screen.findByText('Cổng vận hành lớp đang được khởi tạo.');
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    expect(screen.queryByText('Cổng vận hành lớp đang được khởi tạo.')).toBeNull();
    expect(screen.getByRole('link', { name: 'Đăng nhập với Google' }).getAttribute('href')).toBe('/api/teacher/auth/google/start');
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith('/api/teacher/auth/logout', expect.objectContaining({ headers: { 'x-csrf-token': 'csrf-value' } })));
    settleLogout();
  });
});
