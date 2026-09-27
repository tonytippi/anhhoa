import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParentShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'parent_csrf=; Max-Age=0'; });

function parentResponse(session: object, input: RequestInfo | URL) {
  const path = String(input);
  if (path.includes('/attendance?')) return Promise.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-a', studentDisplayName: 'Bé An', date: '2026-09-27', status: 'NOT_RECORDED', updatedAt: null }] })));
  if (path.includes('/daily-journal?')) return Promise.resolve(new Response(JSON.stringify({ data: null })));
  return Promise.resolve(new Response(JSON.stringify({ data: session })));
}
function deferred<T>() { let resolve!: (value: T) => void; return { promise: new Promise<T>((done) => { resolve = done; }), resolve }; }

describe('ParentShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<ParentShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng phụ huynh đang được khởi tạo.')).toBeNull();
  });

  it('enters a single authorized School directly and keeps all of its children together', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
    render(<ParentShell />);
    expect(await screen.findByRole('heading', { name: 'Hôm nay của các con' })).toBeTruthy();
    expect(screen.getByText('Trường A')).toBeTruthy();
    expect(screen.getByText('Bé An')).toBeTruthy();
    expect(screen.getByText('Bé Bình')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Chọn trường để xem' })).toBeNull();
  });

  it('renders the neutral attendance label from the server and loads no journal media before an explicit action', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Trường chưa ghi nhận');
    fireEvent.click(screen.getByRole('button', { name: /Bé An/ }));
    await screen.findByRole('heading', { name: 'Bé An' });
    expect(screen.getByText('Trường chưa ghi nhận')).toBeTruthy();
    expect(fetch.mock.calls.some(([input]) => String(input).includes('/daily-journal-media/'))).toBe(false);
  });

  it('clears child detail and focuses the safe fallback when its journal endpoint is denied', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    let denied = false;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => {
      if (String(input).includes('/daily-journal?') && denied) return Promise.resolve(new Response(null, { status: 403 }));
      return parentResponse(session, input);
    }));
    render(<ParentShell />);
    await screen.findByText('Bé An');
    await screen.findByText('Trường chưa ghi nhận');
    denied = true;
    fireEvent.click(screen.getByRole('button', { name: /Bé An/ }));
    const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé An')).toBeNull();
  });

  it('aborts concurrent child reads before another child response can commit after denial', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    const first = deferred<Response>(); const second = deferred<Response>();
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => { const path = String(input); if (path.includes('/auth/session')) return parentResponse(session, input); if (path.includes('student-a/attendance')) return first.promise; if (path.includes('student-b/attendance')) return second.promise; return Promise.resolve(new Response(JSON.stringify({ data: null }))); }));
    render(<ParentShell />);
    first.resolve(new Response(null, { status: 403 }));
    const fallback = await screen.findByRole('heading', { name: 'Chọn trường để xem' });
    second.resolve(new Response(JSON.stringify({ data: [{ studentId: 'student-b', studentDisplayName: 'Bé Bình', date: '2026-09-27', status: 'PRESENT', updatedAt: null }] })));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(document.activeElement).toBe(fallback);
    expect(screen.queryByText('Bé Bình')).toBeNull();
  });

  it('shows only distinct authorized Schools in the chooser and clears it before entering a selected School', async () => {
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] };
    vi.stubGlobal('fetch', vi.fn().mockImplementation((input) => parentResponse(session, input)));
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
    const session = { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    let sessionCalls = 0; const fetch = vi.fn().mockImplementation((input) => { if (String(input).includes('/auth/session')) return ++sessionCalls === 1 ? parentResponse(session, input) : new Response(null, { status: 401 }); return parentResponse(session, input); });
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
    let sessionCalls = 0; const fetch = vi.fn().mockImplementation((input) => { if (String(input).includes('/auth/session')) return parentResponse(++sessionCalls < 3 ? multiSchool : alternativeOnly, input); return parentResponse(multiSchool, input); });
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
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent(document, new Event('visibilitychange'));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(2);
  });

  it('does not restore a workspace when a queued foreground refresh races with logout', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    fireEvent.click(screen.getByRole('button', { name: 'Đăng xuất' }));
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(screen.getByRole('heading', { name: 'PassionEdu' })).toBeTruthy();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(1);
  });

  it('does not run a queued foreground refresh after unmount', async () => {
    const session = { audience: 'parent' as const, userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] };
    const fetch = vi.fn().mockImplementation((input) => parentResponse(session, input));
    vi.stubGlobal('fetch', fetch);
    const view = render(<ParentShell />);
    await screen.findByText('Bé An');
    fireEvent.focus(window);
    view.unmount();
    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));
    expect(fetch.mock.calls.filter(([input]) => String(input).includes('/auth/session'))).toHaveLength(1);
  });

});
