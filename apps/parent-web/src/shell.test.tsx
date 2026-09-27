import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParentShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'parent_csrf=; Max-Age=0'; });

describe('ParentShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<ParentShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng phụ huynh đang được khởi tạo.')).toBeNull();
  });

  it('enters a single authorized School directly and keeps all of its children together', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] } }))));
    render(<ParentShell />);
    expect(await screen.findByRole('heading', { name: 'Hôm nay của các con' })).toBeTruthy();
    expect(screen.getByText('Trường A')).toBeTruthy();
    expect(screen.getByText('Bé An')).toBeTruthy();
    expect(screen.getByText('Bé Bình')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
  });

  it('shows only distinct authorized Schools in the chooser and clears it before entering a selected School', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] } }))));
    render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(screen.getByRole('button', { name: /Trường A/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Trường B/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Trường B/ }));
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Hôm nay của các con' })).toBeTruthy();
    expect(screen.getByText('Trường B')).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('clears protected content before a foreground revalidation denies the session', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Bé An')).toBeNull();
  });

});
