import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { SchoolContext } from './school-context';

const identityId = 'identity-a';
const schoolA = { schoolId: 'uuid-a', schoolSlug: 'peakland', schoolName: 'Trường Peakland' };
const schoolB = { schoolId: 'uuid-b', schoolSlug: 'sunrise', schoolName: 'Trường Sunrise' };
const contextA = { ...schoolA, membershipId: 'member-a', capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'], navigation: [{ id: 'roster', label: 'Danh bộ' }] };
const contextB = { ...contextA, ...schoolB, membershipId: 'member-b' };
const storageKey = (identity = identityId) => `passionedu:app:selected-school:${identity}`;
const renderContext = (clear = vi.fn(), identity = identityId) => render(<BrowserRouter><SchoolContext clear={clear} userIdentityId={identity} /></BrowserRouter>);
const rosterFetch = (schools = [schoolA], contexts = new Map([[schoolA.schoolId, contextA], [schoolB.schoolId, contextB]])) => vi.fn((url: string) => {
  if (url === '/api/app/schools') return Promise.resolve(new Response(JSON.stringify({ data: schools })));
  const match = /\/api\/app\/schools\/(uuid-[ab])$/.exec(url);
  if (match) return Promise.resolve(new Response(JSON.stringify({ data: contexts.get(match[1]!) })));
  if (url.endsWith('/school-years')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] })));
  if (url.includes('/students?')) return Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'student-a', studentCode: 'S1', fullName: 'Bé An', hasPhoto: false, enrollment: { id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', classroom: null }, relatives: { mother: null, father: null, otherRelativeCount: 0 } }], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } })));
  return Promise.resolve(new Response(JSON.stringify({ data: [] })));
});

afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('SchoolContext slug routes', () => {
  it('opens Tổng quan as the first authorized destination and accepts its slug deep link', async () => {
    const overviewContext = { ...contextA, navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'roster', label: 'Danh bộ' }] };
    window.history.replaceState({}, '', '/schools/peakland/overview');
    const fetch = rosterFetch([schoolA], new Map([[schoolA.schoolId, overviewContext]]));
    fetch.mockImplementation((url: string) => url.endsWith('/overview') ? Promise.resolve(new Response(JSON.stringify({ data: { date: '2026-02-09', isToday: true, metrics: { students: 0, staff: 0, present: 0, approvedLeave: 0, pickedUp: 0, unresolved: { label: 'Chưa đến lớp', count: 0 }, notRecorded: 0 }, classes: [] } }))) : rosterFetch([schoolA], new Map([[schoolA.schoolId, overviewContext]]))(url));
    vi.stubGlobal('fetch', fetch); renderContext();
    await screen.findByRole('heading', { name: 'Tổng quan vận hành' });
    expect(screen.getByRole('button', { name: 'Tổng quan' }).getAttribute('aria-current')).toBe('page');
    expect(window.location.pathname).toBe('/schools/peakland/overview');
  });
  it('keeps a valid overview date query in the GET request and URL', async () => {
    const overviewContext = { ...contextA, navigation: [{ id: 'overview', label: 'Tổng quan' }] };
    window.history.replaceState({}, '', '/schools/peakland/overview?date=2026-02-08');
    const fetch = rosterFetch([schoolA], new Map([[schoolA.schoolId, overviewContext]]));
    fetch.mockImplementation((url: string) => url.includes('/overview?date=2026-02-08') ? Promise.resolve(new Response(JSON.stringify({ data: { date: '2026-02-08', isToday: false, metrics: { students: 0, staff: 0, present: 0, approvedLeave: 0, pickedUp: 0, unresolved: { label: 'Nghỉ không phép', count: 0 }, notRecorded: 0 }, classes: [] } }))) : rosterFetch([schoolA], new Map([[schoolA.schoolId, overviewContext]]))(url));
    vi.stubGlobal('fetch', fetch); renderContext(); await screen.findByRole('heading', { name: 'Tổng quan vận hành' });
    expect(fetch.mock.calls.some(([url]) => url === '/api/app/schools/uuid-a/overview?date=2026-02-08')).toBe(true); expect(window.location.search).toBe('?date=2026-02-08');
  });
  it('resolves a slug deep link with UUID context and workspace requests', async () => {
    window.history.replaceState({}, '', '/schools/peakland/staff'); const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext();
    await screen.findByRole('heading', { name: 'Nhân viên' });
    expect(window.location.pathname).toBe('/schools/peakland/staff'); expect(fetch).toHaveBeenCalledWith('/api/app/schools/uuid-a', { credentials: 'include' });
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/api/app/schools/uuid-a/roster/staff?'))).toBe(true);
    expect(fetch.mock.calls.some(([url]) => String(url).includes('/schools/peakland/'))).toBe(false);
  });
  it('renders an authorized overview route', async () => {
    const overviewContext = { ...contextA, navigation: [{ id: 'overview', label: 'Tổng quan vận hành' }] };
    window.history.replaceState({}, '', '/schools/peakland/overview');
    const fetch = rosterFetch([schoolA], new Map([[schoolA.schoolId, overviewContext]]));
    vi.stubGlobal('fetch', fetch); renderContext();
    await screen.findByRole('heading', { name: 'Tổng quan vận hành' });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/uuid-a/overview', expect.objectContaining({ credentials: 'include' })));
  });
  it('canonicalizes an authorized legacy UUID bookmark before rendering protected UI', async () => {
    window.history.replaceState({}, '', '/schools/uuid-a/students'); let resolveContext!: (value: Response) => void;
    const fetch = vi.fn((url: string) => url === '/api/app/schools' ? Promise.resolve(new Response(JSON.stringify({ data: [schoolA] }))) : new Promise<Response>((resolve) => { resolveContext = resolve; })); vi.stubGlobal('fetch', fetch); renderContext();
    await waitFor(() => expect(window.location.pathname).toBe('/schools/peakland/students')); expect(screen.queryByRole('heading', { name: 'Học sinh' })).toBeNull(); resolveContext(new Response(JSON.stringify({ data: contextA }))); await screen.findByRole('heading', { name: 'Học sinh' });
  });
  it.each(['stale-slug', 'uuid-stale'])('returns to chooser without context fetch for unknown selector %s', async (selector) => {
    window.history.replaceState({}, '', `/schools/${selector}/staff`); const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext(); await screen.findByLabelText('Chọn trường'); await waitFor(() => expect(window.location.pathname).toBe('/')); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([{ schoolSlug: 'other' }, { schoolId: 'uuid-b' }, undefined, null])('clears protected UI for a malformed or mismatched context response', async (data) => {
    window.history.replaceState({}, '', '/schools/peakland/staff'); const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolA] }))).mockResolvedValueOnce(new Response(JSON.stringify(data === undefined ? {} : { data: data === null ? null : { ...contextA, ...data } }))); vi.stubGlobal('fetch', fetch); renderContext(); await waitFor(() => expect(window.location.pathname).toBe('/')); expect(screen.queryByRole('heading', { name: /PassionEdu/ })).toBeNull();
  });
  it('clears a denied rendered School while preserving chooser, alternative, and storage clearing', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolA, schoolB] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextA }))).mockResolvedValueOnce(new Response(null, { status: 404 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolB] }))); const clear = vi.fn(); vi.stubGlobal('fetch', fetch); renderContext(clear); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'uuid-a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Trường Peakland' }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'uuid-b' } }); await screen.findByRole('option', { name: 'Trường Sunrise' }); expect(localStorage.getItem(storageKey())).toBeNull(); expect(clear).not.toHaveBeenCalled();
  });
  it('does not let a delayed A denial overwrite selected School B', async () => {
    let resolveA!: (response: Response) => void; const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolA, schoolB] }))).mockReturnValueOnce(new Promise<Response>((resolve) => { resolveA = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextB }))); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'uuid-a' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'uuid-b' } }); resolveA(new Response(null, { status: 404 })); await screen.findByRole('heading', { name: 'PassionEdu - Trường Sunrise' });
  });
  it('does not let a delayed A success overwrite selected School B', async () => {
    let resolveA!: (response: Response) => void; const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolA, schoolB] }))).mockReturnValueOnce(new Promise<Response>((resolve) => { resolveA = resolve; })).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextB }))); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'uuid-a' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'uuid-b' } }); resolveA(new Response(JSON.stringify({ data: contextA }))); await screen.findByRole('heading', { name: 'PassionEdu - Trường Sunrise' }); expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường Peakland' })).toBeNull();
  });
  it('guards a dirty chooser School switch', async () => {
    const fetch = rosterFetch([schoolA, schoolB]); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'uuid-a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'uuid-b' } }); expect(await screen.findByRole('dialog', { name: 'Đổi trường?' })).toBeTruthy(); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
  it('guards a dirty history School switch and restores the slug route on stay', async () => {
    window.history.replaceState({}, '', '/schools/peakland/students'); const fetch = rosterFetch([schoolA, schoolB]); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } }); window.history.pushState({}, '', '/schools/sunrise/students'); fireEvent.popState(window); await screen.findByRole('dialog', { name: 'Đổi trường?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' })); await waitFor(() => expect(window.location.pathname).toBe('/schools/peakland/students')); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
  it('does not remount an open intake after focus or file-picker return', async () => {
    const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); const before = fetch.mock.calls.length; fireEvent.focus(window); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(before + 1)); expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/app/schools'); expect(screen.getByRole('dialog', { name: 'Tạo học sinh và ghi danh' })).toBeTruthy();
  });
  it('re-authorizes the School chooser on foreground events without remounting workspace data', async () => {
    const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext(); await screen.findByText('Bé An'); const before = fetch.mock.calls.length; fireEvent.focus(window); await waitFor(() => expect(fetch).toHaveBeenCalledTimes(before + 1)); expect(fetch.mock.calls.at(-1)?.[0]).toBe('/api/app/schools');
  });
  it('keeps shell for chooser 500 but clears shell for chooser 401', async () => {
    const clear500 = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 }))); renderContext(clear500); await screen.findByText('Không thể tải danh sách trường.'); expect(clear500).not.toHaveBeenCalled();
    const clear401 = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 }))); renderContext(clear401); await waitFor(() => expect(clear401).toHaveBeenCalled());
  });
  it('clears previous context when identity changes', async () => {
    localStorage.setItem(storageKey(), 'uuid-a'); let reads = 0; const fetch = rosterFetch(); fetch.mockImplementation((url: string) => url === '/api/app/schools' ? Promise.resolve(new Response(JSON.stringify({ data: reads++ ? [schoolB] : [schoolA] }))) : url === '/api/app/schools/uuid-b' ? Promise.resolve(new Response(JSON.stringify({ data: contextB }))) : url === '/api/app/schools/uuid-a' ? Promise.resolve(new Response(JSON.stringify({ data: contextA }))) : Promise.resolve(new Response(JSON.stringify({ data: [] })))); vi.stubGlobal('fetch', fetch); const view = renderContext(); await screen.findByRole('heading', { name: 'PassionEdu - Trường Peakland' }); view.rerender(<BrowserRouter><SchoolContext clear={vi.fn()} userIdentityId="identity-b" /></BrowserRouter>); await screen.findByRole('option', { name: 'Trường Sunrise' }); expect(screen.queryByRole('heading', { name: 'PassionEdu - Trường Peakland' })).toBeNull();
  });
  it('restores only a same-identity persisted UUID selection', async () => {
    localStorage.setItem(storageKey(), 'uuid-a'); const fetch = rosterFetch([schoolA, schoolB]); vi.stubGlobal('fetch', fetch); const first = renderContext(); await screen.findByRole('heading', { name: 'PassionEdu - Trường Peakland' }); expect(window.location.pathname).toBe('/schools/peakland/students'); first.unmount(); window.history.replaceState({}, '', '/'); const second = rosterFetch([schoolA, schoolB]); vi.stubGlobal('fetch', second); renderContext(vi.fn(), 'identity-b'); await screen.findByLabelText('Chọn trường'); expect(second).toHaveBeenCalledTimes(1);
  });
  it('forgets a stale persisted selection and keeps the chooser open', async () => {
    localStorage.setItem(storageKey(), 'uuid-stale'); const fetch = rosterFetch([schoolA, schoolB]); vi.stubGlobal('fetch', fetch); renderContext(); await screen.findByLabelText('Chọn trường'); expect(localStorage.getItem(storageKey())).toBeNull(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps chooser and workspace presentation hooks', async () => {
    const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); const view = renderContext(); await screen.findByRole('heading', { name: 'PassionEdu - Trường Peakland' }); expect(view.container.querySelector('.school-context-switcher')).toBeNull(); expect(view.container.querySelector('.school-context-heading')).not.toBeNull(); expect(view.container.querySelector('.school-context-navigation')).not.toBeNull();
  });
  it('renders people and class destinations without configuration controls', async () => {
    const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Nhân viên' })); await screen.findByRole('heading', { name: 'Nhân viên' }); expect(screen.queryByRole('button', { name: 'Tạo năm học' })).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Lớp học' })); await screen.findByRole('heading', { name: 'Lớp học' }); expect(screen.queryByRole('button', { name: 'Tạo chức danh' })).toBeNull();
  });
  it('opens the independent parent list', async () => {
    const fetch = rosterFetch(); fetch.mockImplementation((url: string) => url.includes('/school-years/year-a/parents?') ? Promise.resolve(new Response(JSON.stringify({ data: [{ id: 'parent-a', fullName: 'Mai Trần', phone: '0900', email: null, children: [] }], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } }))) : rosterFetch()(url)); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Phụ huynh' })); await screen.findByText('Mai Trần');
  });
  it('guards a dirty settings form before switching School', async () => {
    const settings = { ...contextA, capabilities: ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE'], navigation: [{ id: 'settings', label: 'Cấu hình trường' }] }; const fetch = rosterFetch([schoolA, schoolB], new Map([[schoolA.schoolId, settings], [schoolB.schoolId, contextB]])); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'uuid-a' } }); fireEvent.click(await screen.findByRole('button', { name: 'Cấu hình trường' })); await screen.findByRole('heading', { name: 'Cấu hình trường' }); fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường mới' } }); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'uuid-b' } }); expect(await screen.findByRole('dialog', { name: 'Đổi trường?' })).toBeTruthy(); expect((screen.getByLabelText('Tên trường') as HTMLInputElement).value).toBe('Trường mới');
  });
  it('falls back from a denied page to the first authorized slug page', async () => {
    window.history.replaceState({}, '', '/schools/peakland/students'); const settings = { ...contextA, capabilities: ['SCHOOL_CONTEXT_READ', 'SETTINGS_MANAGE'], navigation: [{ id: 'settings', label: 'Cấu hình trường' }] }; const fetch = rosterFetch([schoolA], new Map([[schoolA.schoolId, settings]])); vi.stubGlobal('fetch', fetch); renderContext(); await screen.findByRole('heading', { name: 'Cấu hình trường' }); expect(window.location.pathname).toBe('/schools/peakland/settings');
  });
  it('retries a transient context error', async () => {
    window.history.replaceState({}, '', '/schools/peakland/staff'); const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [schoolA] }))).mockResolvedValueOnce(new Response(null, { status: 500 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: contextA }))); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thử lại' })); await screen.findByRole('heading', { name: 'Nhân viên' });
  });
  it('uses slug navigation paths and restores the prior page through browser history', async () => {
    window.history.replaceState({}, '', '/schools/peakland/students'); const fetch = rosterFetch(); vi.stubGlobal('fetch', fetch); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Nhân viên' })); await screen.findByRole('heading', { name: 'Nhân viên' }); expect(window.location.pathname).toBe('/schools/peakland/staff'); window.history.back(); window.dispatchEvent(new PopStateEvent('popstate')); await screen.findByRole('heading', { name: 'Học sinh' }); expect(window.location.pathname).toBe('/schools/peakland/students');
  });
});
