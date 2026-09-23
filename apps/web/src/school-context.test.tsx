import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolContext } from './school-context';

const context = { schoolId: 'a', schoolName: 'Trường A', membershipId: 'member-a', capabilities: ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE'], navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'access', label: 'Quản lý truy cập' }] };
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });
describe('SchoolContext', () => {
  it('clears a denied rendered School while preserving the chooser and alternative School', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'b', schoolName: 'Trường B' }] })));
    const clear = vi.fn(); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={clear} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); await waitFor(() => expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull()); expect(screen.getByRole('option', { name: 'Trường B' })).toBeTruthy(); expect(clear).not.toHaveBeenCalled();
  });
  it('exposes semantic presentation hooks for the chooser and school workspace', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context })));
    vi.stubGlobal('fetch', fetch); const { container } = render(<SchoolContext clear={vi.fn()} />);
    await screen.findByLabelText('Chọn trường');
    expect(container.querySelector('.school-context-switcher')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Trường A' });
    expect(container.querySelector('.school-context-heading')).not.toBeNull();
    expect(container.querySelector('.school-context-navigation')).not.toBeNull();
  });
  it('revalidates the open School when the browser returns to the foreground', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'b', schoolName: 'Trường B' }] })));
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.focus(window);
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull()); expect(screen.getByRole('option', { name: 'Trường B' })).toBeTruthy();
  });
  it('does not let delayed success or denial for A overwrite selected School B', async () => {
    let resolveA!: (response: Response) => void; const delayedA = new Promise<Response>((resolve) => { resolveA = resolve; }); const contextB = { ...context, schoolId: 'b', schoolName: 'Trường B' };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockReturnValueOnce(delayedA).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextB })));
    const clear = vi.fn(); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={clear} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); resolveA(new Response(null, { status: 404 })); await screen.findByRole('heading', { name: 'PassionEdu - Trường B' }); expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull(); expect(clear).not.toHaveBeenCalled();
  });
  it('exposes server-projected roster navigation and protects dirty roster input on switch', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'Học sinh' }); expect(screen.getByRole('button', { name: 'Phụ huynh' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Nhân viên' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lớp học' })).toBeTruthy(); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
    expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi'); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
  it('selects people and class destinations without rendering configuration controls', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân viên' }));
    expect(await screen.findByRole('heading', { name: 'Nhân viên' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhân viên' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Tạo năm học' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lớp học' }));
    expect(await screen.findByRole('heading', { name: 'Lớp học' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lớp học' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Tạo chức danh' })).toBeNull();
  });
  it('integrates Settings navigation and guards a dirty Settings form before switching School', async () => {
    const settingsContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE'] as const, navigation: [{ id: 'settings', label: 'Cấu hình trường' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: settingsContext })));
      if (url.endsWith('/settings')) return Promise.resolve(new Response(JSON.stringify({ data: { asOf: '2026-01-01', timezone: 'Asia/Ho_Chi_Minh', profile: null, calendar: null } })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình trường' }));
    await screen.findByRole('heading', { name: 'Cấu hình trường' });
    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường mới' } });
    fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
    expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi');
    expect((screen.getByLabelText('Tên trường') as HTMLInputElement).value).toBe('Trường mới');
  });
});
