import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolContext } from './school-context';

const schoolA = { schoolId: 'a', schoolSlug: 'truong-a', schoolName: 'Trường A' };
const schoolB = { schoolId: 'b', schoolSlug: 'truong-b', schoolName: 'Trường B' };
const navigation = [{ id: 'overview', label: 'Tổng quan' }, { id: 'attendance', label: 'Điểm danh' }, { id: 'daily-journal', label: 'Nhận xét trong ngày' }, { id: 'handover', label: 'Bàn giao' }, { id: 'messages', label: 'Tin nhắn phụ huynh' }];
const classes = { teacherName: 'Cô Lan', classes: [{ classId: 'class-1', className: 'Mầm 3-4 tuổi', schoolYearName: '2026-2027' }] };
const roster = { photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 's1', fullName: 'Bé An', studentCode: 'AH-1', state: 'NOT_RECORDED', evidenceId: null, updatedAt: null }] };
type Reply = { body: unknown; status?: number };
const respond = (routes: Array<[RegExp, Reply | ((init?: RequestInit) => Reply)]>) => vi.fn((input: string, init?: RequestInit) => {
  const match = routes.find(([pattern]) => pattern.test(input));
  const reply = match ? (typeof match[1] === 'function' ? match[1](init) : match[1]) : { body: { data: null } };
  return Promise.resolve(new Response(JSON.stringify(reply.body), { status: reply.status ?? 200 }));
});
const base = (extra: Array<[RegExp, Reply | ((init?: RequestInit) => Reply)]> = [], features?: object) => respond([
  ...extra,
  [/\/api\/teacher\/schools$/, { body: { data: [schoolA, schoolB] } }],
  [/\/schools\/a$/, { body: { data: { ...schoolA, navigation, ...(features ? { features } : {}) } } }],
  [/\/schools\/b$/, { body: { data: { ...schoolB, navigation } } }],
  [/\/classes\?/, { body: { data: classes } }],
  [/attendance-roster/, { body: { data: roster } }],
  [/handover-roster/, { body: { data: { photoEvidenceMode: 'OPTIONAL', students: [] } } }],
  [/daily-journal-roster/, { body: { data: { students: [{ studentId: 's1', fullName: 'Bé An', studentCode: 'AH-1', status: 'MISSING', version: null, updatedAt: null, text: null, media: [] }] } } }],
  [/class-notes\?/, { body: { data: null } }],
  [/message-threads/, { body: { data: { students: [] } } }],
]);

afterEach(() => { cleanup(); vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });

describe('Teacher SchoolContext', () => {
  it('chooses a School on Home and opens the assigned Class of the day', async () => {
    vi.stubGlobal('fetch', base());
    render(<SchoolContext clear={vi.fn()} />);
    fireEvent.click(within(await screen.findByRole('list', { name: 'Chọn trường' })).getByRole('button', { name: /Trường A/ }));
    expect(await screen.findByRole('heading', { name: 'Mầm 3-4 tuổi' })).toBeTruthy();
    expect(window.location.pathname).toBe('/schools/truong-a');
    expect(await screen.findByText('Bé An')).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: 'Điều hướng trường' });
    expect(nav.textContent).toContain('Lớp hôm nay'); expect(nav.textContent).toContain('Nhận xét trong ngày'); expect(nav.textContent).toContain('Tin nhắn phụ huynh');
  });

  it('returns Home for an unknown slug and for a malformed context', async () => {
    window.history.replaceState({}, '', '/schools/unknown'); vi.stubGlobal('fetch', base()); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByRole('list', { name: 'Chọn trường' }); expect(window.location.pathname).toBe('/');
    cleanup(); window.history.replaceState({}, '', '/schools/truong-a'); vi.stubGlobal('fetch', base([[/\/schools\/a$/, { body: { data: {} } }]])); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByRole('list', { name: 'Chọn trường' }); expect(window.location.pathname).toBe('/');
  });

  it('records attendance with idempotency headers and reloads the server-confirmed roster', async () => {
    document.cookie = 'teacher_csrf=csrf-value';
    let state = 'NOT_RECORDED';
    const fetch = base([
      [/\/attendance$/, () => { state = 'PRESENT'; return { body: { data: { id: 'op', status: 'COMPLETED', outcome: {} } } }; }],
      [/attendance-roster/, () => ({ body: { data: { ...roster, students: [{ ...roster.students[0], state, updatedAt: state === 'PRESENT' ? '2026-09-05T01:00:00.000Z' : null }] } } })],
    ]);
    window.history.replaceState({}, '', '/schools/truong-a'); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhận trẻ' }));
    await screen.findByText('Có mặt');
    const post = fetch.mock.calls.find(([url, init]) => String(url).endsWith('/attendance') && init?.method === 'POST')!;
    const headers = post[1]!.headers as Record<string, string>;
    expect(headers['x-csrf-token']).toBe('csrf-value'); expect(headers['idempotency-key']).toMatch(/^[0-9a-f-]{36}$/); expect(headers['x-operation-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(String(post[1]!.body))).toMatchObject({ classId: 'class-1', studentId: 's1', state: 'PRESENT', evidenceId: null });
    document.cookie = 'teacher_csrf=; Max-Age=0';
  });

  it('reconciles an unknown attendance outcome before allowing a resend', async () => {
    const fetch = base([
      [/\/attendance$/, { body: {}, status: 504 }],
      [/\/operations\//, { body: { data: { status: 'PENDING' } } }],
    ]);
    window.history.replaceState({}, '', '/schools/truong-a'); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhận trẻ' }));
    await screen.findByText(/Chưa xác nhận được kết quả/);
    fireEvent.click(screen.getByRole('button', { name: 'Kiểm tra lại kết quả' }));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/operations/'))).toHaveLength(2));
    expect(fetch.mock.calls.filter(([url, init]) => String(url).endsWith('/attendance') && init?.method === 'POST')).toHaveLength(1);
    fireEvent.click(screen.getByRole('link', { name: /Về trang chủ/ }));
    expect(await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    expect(window.location.pathname).toBe('/schools/truong-a');
  });

  it('hides journal and handover entry points when the School features turn them off', async () => {
    window.history.replaceState({}, '', '/schools/truong-a');
    vi.stubGlobal('fetch', base([], { dailyJournal: false, handover: false }));
    render(<SchoolContext clear={vi.fn()} />);
    await screen.findByText('Bé An');
    expect(screen.getByRole('navigation', { name: 'Điều hướng trường' }).textContent).not.toContain('Nhận xét trong ngày');
    expect(screen.queryByText('Đã trả trẻ')).toBeNull(); expect(screen.queryByText('Tiến độ nhận xét')).toBeNull();
  });

  it('shows an empty state when the teacher has no Class assigned today', async () => {
    window.history.replaceState({}, '', '/schools/truong-a');
    vi.stubGlobal('fetch', base([[/\/classes\?/, { body: { data: { teacherName: 'Cô Lan', classes: [] } } }]]));
    render(<SchoolContext clear={vi.fn()} />);
    expect(await screen.findByRole('heading', { name: 'Chưa được phân công lớp' })).toBeTruthy();
  });
});
