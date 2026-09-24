import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { SchoolContext } from './school-context';

const context = { schoolId: 'a', schoolName: 'Trường A', membershipId: 'member-a', capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'], navigation: [{ id: 'roster', label: 'Danh bộ' }] };
const userIdentityId = 'identity-a';
const storageKey = `passionedu:app:selected-school:${userIdentityId}`;
const renderSchoolContext = (clear = vi.fn()) => render(<BrowserRouter><SchoolContext clear={clear} userIdentityId={userIdentityId} /></BrowserRouter>);
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
describe('SchoolContext', () => {
  it('clears a denied rendered School while preserving the chooser and alternative School', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'b', schoolName: 'Trường B' }] })));
    const clear = vi.fn(); vi.stubGlobal('fetch', fetch); renderSchoolContext(clear); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); await waitFor(() => expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull()); expect(screen.getByRole('option', { name: 'Trường B' })).toBeTruthy(); expect(localStorage.getItem(storageKey)).toBeNull(); expect(clear).not.toHaveBeenCalled();
  });
  it('exposes semantic presentation hooks for the chooser and school workspace', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context })));
    vi.stubGlobal('fetch', fetch); const { container } = renderSchoolContext();
    await screen.findByRole('heading', { name: 'PassionEdu - Trường A' });
    expect(container.querySelector('.school-context-switcher')).toBeNull();
    expect(container.querySelector('.school-context-heading')).not.toBeNull();
    expect(container.querySelector('.school-context-navigation')).not.toBeNull();
  });
  it('keeps the authenticated shell when loading Schools fails without a 401', async () => {
    const clear = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    renderSchoolContext(clear);
    expect(await screen.findByText('Không thể tải danh sách trường.')).toBeTruthy();
    expect(clear).not.toHaveBeenCalled();
  });
  it('keeps the open School when the browser returns to the foreground', async () => {
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: context })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); renderSchoolContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường A' }); fireEvent.focus(window);
    await new Promise((resolve) => window.setTimeout(resolve, 0)); expect(screen.getByRole('heading', { name: 'PassionEdu - Trường A' })).toBeTruthy();
  });
  it('does not let delayed success or denial for A overwrite selected School B', async () => {
    let resolveA!: (response: Response) => void; const delayedA = new Promise<Response>((resolve) => { resolveA = resolve; }); const contextB = { ...context, schoolId: 'b', schoolName: 'Trường B' };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockReturnValueOnce(delayedA).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextB })));
    const clear = vi.fn(); vi.stubGlobal('fetch', fetch); renderSchoolContext(clear); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); resolveA(new Response(null, { status: 404 })); await screen.findByRole('heading', { name: 'PassionEdu - Trường B' }); expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull(); expect(clear).not.toHaveBeenCalled();
  });
  it('exposes server-projected roster navigation and protects dirty roster input on switch', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); renderSchoolContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'Học sinh' }); expect(screen.getByRole('button', { name: 'Phụ huynh' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Nhân viên' })).toBeTruthy(); expect(screen.getByRole('button', { name: 'Lớp học' })).toBeTruthy(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
    expect((await screen.findByRole('dialog', { name: 'Đổi trường?' })).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi'); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
  it('keeps the empty student intake open when focus returns from the file chooser', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' }));
    await screen.findByRole('dialog', { name: 'Tạo học sinh và ghi danh' });
    const callsBeforeFocus = fetch.mock.calls.length;
    fireEvent.focus(window);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(callsBeforeFocus);
    expect(screen.getByRole('dialog', { name: 'Tạo học sinh và ghi danh' })).toBeTruthy();
  });
  it('keeps roster mounted without new context, list, or parent requests after foreground events', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    let studentReads = 0;
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      if (url.includes('/students?')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: `student-${studentReads}`, studentCode: `S${studentReads + 1}`, fullName: studentReads++ ? 'Bé Bình' : 'Bé An', hasPhoto: false, enrollment: { id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', classroom: null }, relatives: { mother: null, father: null, otherRelativeCount: 0 } }], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    expect(await screen.findByText('Bé An')).toBeTruthy();
    const before = fetch.mock.calls.length;
    fireEvent.focus(window); fireEvent(document, new Event('visibilitychange'));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetch).toHaveBeenCalledTimes(before);
    expect(screen.getByText('Bé An')).toBeTruthy();
  });
  it('selects people and class destinations without rendering configuration controls', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân viên' }));
    expect(await screen.findByRole('heading', { name: 'Nhân viên' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nhân viên' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Tạo năm học' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Lớp học' }));
    expect(await screen.findByRole('heading', { name: 'Lớp học' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Lớp học' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('button', { name: 'Tạo chức danh' })).toBeNull();
  });
  it('opens the independent parent list from the Phụ huynh submenu', async () => {
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      if (url.includes('/school-years/year-a/parents?')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'parent-a', fullName: 'Mai Trần', phone: '0900', email: null, children: [] }], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Phụ huynh' }));
    expect(await screen.findByText('Mai Trần')).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/school-years/year-a/parents?'))).toBe(true);
  });
  it('integrates Settings navigation and guards a dirty Settings form before switching School', async () => {
    const settingsContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE'] as const, navigation: [{ id: 'settings', label: 'Cấu hình trường' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: settingsContext })));
      if (url.endsWith('/settings')) return Promise.resolve(new Response(JSON.stringify({ data: { asOf: '2026-01-01', timezone: 'Asia/Ho_Chi_Minh', profile: null, calendar: null } })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình trường' }));
    await screen.findByRole('heading', { name: 'Cấu hình trường' });
    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường mới' } });
    fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
    expect((await screen.findByRole('dialog')).textContent).toContain('Biểu mẫu đang có nội dung chưa gửi');
    expect((screen.getByLabelText('Tên trường') as HTMLInputElement).value).toBe('Trường mới');
  });
  it('restores a server-validated saved School for the same identity', async () => {
    localStorage.setItem(storageKey, 'b');
    const contextB = { ...context, schoolId: 'b', schoolName: 'Trường B' };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextB })));
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    await screen.findByRole('heading', { name: 'PassionEdu - Trường B' });
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/b', { credentials: 'include' });
    expect((screen.getByLabelText('Chọn trường') as HTMLSelectElement).value).toBe('b');
  });
  it('keeps the chooser for multiple Schools without a valid saved selection', async () => {
    localStorage.setItem(storageKey, 'stale');
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    await screen.findByLabelText('Chọn trường');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(localStorage.getItem(storageKey)).toBeNull();
  });
  it('persists only a successful selection and keeps identities isolated', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: context })));
    vi.stubGlobal('fetch', fetch); renderSchoolContext();
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Trường A' });
    expect(localStorage.getItem(storageKey)).toBe('a');
    const identityBKey = 'passionedu:app:selected-school:identity-b';
    expect(localStorage.getItem(identityBKey)).toBeNull();
    const contextFetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
    vi.stubGlobal('fetch', contextFetch);
    render(<BrowserRouter><SchoolContext clear={vi.fn()} userIdentityId="identity-b" /></BrowserRouter>);
    await screen.findAllByLabelText('Chọn trường');
    expect(contextFetch).toHaveBeenCalledTimes(1);
  });
  it('clears the prior context when the authenticated identity changes', async () => {
    localStorage.setItem(storageKey, 'a');
    let schoolListReads = 0;
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: schoolListReads++ ? [{ schoolId: 'b', schoolName: 'Trường B' }] : [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: context })));
      if (url === '/api/app/schools/b') return Promise.resolve(new Response(JSON.stringify({ data: { ...context, schoolId: 'b', schoolName: 'Trường B' } })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    const view = renderSchoolContext();
    await screen.findByRole('heading', { name: 'PassionEdu - Trường A' });
    view.rerender(<BrowserRouter><SchoolContext clear={vi.fn()} userIdentityId="identity-b" /></BrowserRouter>);
    await screen.findByRole('option', { name: 'Trường B' });
    expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường A' })).toBeNull();
  });
  it('resolves an authorized deep link before rendering its School workspace', async () => {
    window.history.replaceState({}, '', '/schools/a/staff');
    const rosterContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'] as const, navigation: [{ id: 'roster', label: 'Danh bộ' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: rosterContext })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    expect(screen.queryByRole('heading', { name: 'Nhân viên' })).toBeNull();
    await screen.findByRole('heading', { name: 'Nhân viên' });
    expect(window.location.pathname).toBe('/schools/a/staff');
  });
  it('replaces a denied page with the first server-authorized destination', async () => {
    window.history.replaceState({}, '', '/schools/a/students');
    const settingsContext = { ...context, capabilities: ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE'] as const, navigation: [{ id: 'settings', label: 'Cấu hình trường' }] };
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: settingsContext })));
      if (url.endsWith('/settings')) return Promise.resolve(new Response(JSON.stringify({ data: { asOf: '2026-01-01', timezone: 'Asia/Ho_Chi_Minh', profile: null, calendar: null } })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    await screen.findByRole('heading', { name: 'Cấu hình trường' });
    expect(window.location.pathname).toBe('/schools/a/settings');
    expect(screen.queryByRole('heading', { name: 'Học sinh' })).toBeNull();
  });
  it('canonicalizes bare and unsupported School paths without resolving a context', async () => {
    window.history.replaceState({}, '', '/schools/a');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    await screen.findByLabelText('Chọn trường');
    expect(window.location.pathname).toBe('/');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a deep-linked School absent from the chooser before context fetch', async () => {
    window.history.replaceState({}, '', '/schools/stale/staff');
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    await screen.findByLabelText('Chọn trường');
    expect(window.location.pathname).toBe('/');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('rejects a mismatched School context payload', async () => {
    window.history.replaceState({}, '', '/schools/a/staff');
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...context, schoolId: 'b', schoolName: 'Trường B' } })));
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    await screen.findByLabelText('Chọn trường');
    await waitFor(() => expect(window.location.pathname).toBe('/'));
    expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường B' })).toBeNull();
  });
  it('retries the same URL after a transient context error', async () => {
    window.history.replaceState({}, '', '/schools/a/staff');
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: context })));
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' }));
    await screen.findByRole('heading', { name: 'Nhân viên' });
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/a', { credentials: 'include' });
  });
  it('updates URL from navigation and restores the prior page through browser history', async () => {
    window.history.replaceState({}, '', '/schools/a/students');
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: context })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân viên' }));
    await screen.findByRole('heading', { name: 'Nhân viên' });
    expect(window.location.pathname).toBe('/schools/a/staff');
    window.history.back();
    window.dispatchEvent(new PopStateEvent('popstate'));
    await screen.findByRole('heading', { name: 'Học sinh' });
    expect(window.location.pathname).toBe('/schools/a/students');
  });
  it('guards a history School change while roster input is dirty and restores route A on stay', async () => {
    window.history.replaceState({}, '', '/schools/a/students');
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] })));
      if (url === '/api/app/schools/a') return Promise.resolve(new Response(JSON.stringify({ data: context })));
      if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
      return Promise.resolve(new Response(JSON.stringify({ data: [] })));
    });
    vi.stubGlobal('fetch', fetch);
    renderSchoolContext();
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' }));
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    window.history.pushState({}, '', '/schools/b/students');
    fireEvent.popState(window);
    await screen.findByRole('dialog', { name: 'Đổi trường?' });
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
    fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    await waitFor(() => expect(window.location.pathname).toBe('/schools/a/students'));
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
});
