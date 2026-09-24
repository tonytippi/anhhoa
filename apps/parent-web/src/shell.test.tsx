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

  it('renders only server-authorized Parent contexts as a chooser', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] } }))));
    render(<ParentShell />);
    expect(await screen.findByRole('heading', { name: 'Hôm nay', level: 1 })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bé An/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Bé Bình/ })).toBeTruthy();
  });
  it('loads protected media only after the Parent asks to view it', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentId: 'student-a', studentDisplayName: 'Bé An', journalDate: '2026-02-09', text: 'Ăn ngủ tốt', updatedAt: '2026-02-09T09:00:00.000Z', media: [{ id: 'media-a', contentType: 'image/png' }] } })))
      .mockResolvedValueOnce(new Response(new Blob(['image'], { type: 'image/png' })));
    vi.stubGlobal('fetch', fetch);
    render(<ParentShell />);
    await screen.findByRole('button', { name: 'Xem ảnh trong ngày' });
    expect(fetch).toHaveBeenCalledTimes(2);
    fireEvent.click(screen.getByRole('button', { name: 'Xem ảnh trong ngày' }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/daily-journal-media/media-a'), expect.objectContaining({ cache: 'no-store' }));
  });
  it('refreshes an authorized empty journal without removing the child context', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentId: 'student-a', studentDisplayName: 'Bé An', journalDate: '2026-02-09', text: 'Nội dung bảo vệ', updatedAt: '2026-02-09T09:00:00.000Z', media: [] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: null }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByText('Nội dung bảo vệ'); fireEvent.focus(window);
    await screen.findByText('Hôm nay chưa có nhận xét.'); expect(screen.queryByText('Nội dung bảo vệ')).toBeNull(); expect(screen.getByRole('heading', { name: 'Bé An' })).toBeTruthy();
  });
  it('clears session and child context after foreground authentication failure', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentId: 'student-a', studentDisplayName: 'Bé An', journalDate: '2026-02-09', text: 'Nội dung bảo vệ', updatedAt: '2026-02-09T09:00:00.000Z', media: [] } }))).mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByText('Nội dung bảo vệ'); fireEvent.focus(window);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' }); expect(screen.queryByText('Nội dung bảo vệ')).toBeNull();
  });
  it('treats a foreground 404 as context denial and removes the denied child card', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { studentId: 'student-a', studentDisplayName: 'Bé An', journalDate: '2026-02-09', text: 'Nội dung bảo vệ', updatedAt: '2026-02-09T09:00:00.000Z', media: [] } }))).mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); fireEvent.click(await screen.findByRole('button', { name: /Bé An/ })); await screen.findByText('Nội dung bảo vệ'); fireEvent.focus(window);
    await screen.findByRole('heading', { name: 'Hôm nay', level: 1 }); expect(screen.queryByText('Nội dung bảo vệ')).toBeNull(); expect(screen.queryByRole('button', { name: /Bé An/ })).toBeNull(); expect(screen.getByRole('button', { name: /Bé Bình/ })).toBeTruthy();
  });
  it('signs out when the initial protected journal read is unauthorized', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(null, { status: 401 }));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByRole('link', { name: 'Đăng nhập với Google' });
  });
  it('renders the normal empty journal state for an authorized child without a journal', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: null })));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByText('Hôm nay chưa có nhận xét.'); expect(screen.getByRole('heading', { name: 'Bé An' })).toBeTruthy();
  });
  it('returns to safe home when the initial protected journal read is denied', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }] } }))).mockResolvedValueOnce(new Response(null, { status: 404 }));
    vi.stubGlobal('fetch', fetch); render(<ParentShell />); await screen.findByText('Không còn quyền truy cập nội dung trẻ em.'); expect(screen.queryByRole('heading', { name: 'Bé An' })).toBeNull();
  });

});
