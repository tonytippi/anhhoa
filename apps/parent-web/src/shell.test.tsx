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
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.queryByText('Bé Bình')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Trường B/ }));
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
    const destination = await screen.findByRole('heading', { name: 'Hôm nay của các con' });
    expect(document.activeElement).toBe(destination);
    expect(screen.getByText('Trường B')).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('clears protected content before a foreground revalidation denies the session', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    const fallback = await screen.findByRole('heading', { name: 'PassionEdu' });
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('returns to the chooser when foreground refresh removes the selected School but leaves one alternative', async () => {
    const multiSchool = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    const alternativeOnly = { ...multiSchool, schools: [multiSchool.schools[1]!] };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: multiSchool }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: multiSchool }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: alternativeOnly })));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    fireEvent.click(screen.getByRole('button', { name: /Trường A/ }));
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.queryByText('Bé Bình')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Hôm nay của các con' })).toBeNull();
  });

  it('coalesces focus and visibility foreground events into one session refresh', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: session })));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not restore a workspace when a queued foreground refresh races with logout', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: session })));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(screen.getByRole('heading', { name: 'PassionEdu' })).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not run a queued foreground refresh after unmount', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: session })));
    vi.stubGlobal('fetch', fetch);
    const view = render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    view.unmount();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch).toHaveBeenCalledOnce();
  });

});
