import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterWorkspace } from './roster-workspace';

const year = { id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true };
const classroom = { id: 'class-a', schoolYearId: 'year-a', name: 'Lớp Mầm', status: 'ACTIVE', activeStudentCount: 0 };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const error = (fieldErrors: Record<string, string>) => new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.', fieldErrors } }), { status: 400 });
const rosterFetch = (post = response({ id: 'operation' })) => vi.fn((url: string, options?: RequestInit) => {
  if (options?.method === 'POST') return Promise.resolve(post);
  return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [] : [year]));
});

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('RosterWorkspace', () => {
  it('keeps invalid SchoolYear input, focuses the summary, and renders field errors', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([])).mockResolvedValueOnce(error({ name: 'Tên cần từ 1 đến 100 ký tự.' }));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Tên năm học'), { target: { value: '   ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo năm học' }).closest('form')!);
    expect(await screen.findByText('Tên cần từ 1 đến 100 ký tự.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    expect((screen.getByLabelText('Tên năm học') as HTMLInputElement).value).toBe('   ');
  });

  it('creates only from server confirmation and supports Class rename', async () => {
    let classReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'rename-operation' }));
      if (url.endsWith('/classes')) return Promise.resolve(response([classReads++ ? { ...classroom, name: 'Lớp Chồi' } : classroom]));
      return Promise.resolve(response(url.endsWith('/students') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect((await screen.findAllByText('Lớp Mầm')).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên' }));
    fireEvent.change(screen.getByRole('dialog').querySelector('input')!, { target: { value: 'Lớp Chồi' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu tên lớp' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/classes/class-a/name', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Lớp Chồi' }) })));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('keeps class errors separate from SchoolYear errors and describes the invalid field', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response([year])).mockResolvedValueOnce(response([classroom])).mockResolvedValueOnce(response([])).mockResolvedValueOnce(error({ name: 'Tên lớp là bắt buộc.' }));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2026' });
    fireEvent.change(screen.getByLabelText('Tên lớp'), { target: { value: ' ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo lớp' }).closest('form')!);
    expect(await screen.findByText('Tên lớp là bắt buộc.')).toBeTruthy();
    expect(screen.getByLabelText('Tên lớp').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Tên lớp').getAttribute('aria-describedby')).toBe('name-error');
    expect(screen.queryByText('Tên cần từ 1 đến 100 ký tự.')).toBeNull();
  });

  it('ignores a delayed denied roster request after its school changes', async () => {
    let resolveA!: (value: Response) => void;
    const delayedA = new Promise<Response>((resolve) => { resolveA = resolve; });
    const denied = vi.fn();
    const fetch = vi.fn().mockReturnValueOnce(delayedA).mockResolvedValueOnce(response([]));
    vi.stubGlobal('fetch', fetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={denied} />);
    resolveA(new Response(null, { status: 403 }));
    await screen.findByText('Năm học của Trường B');
    expect(denied).not.toHaveBeenCalled();
  });

  it('replaces roster data when selecting another SchoolYear without showing the prior year data', async () => {
    const nextYear = { id: 'year-b', name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01', isActive: false };
    const nextClassroom = { id: 'class-b', schoolYearId: 'year-b', name: 'Lớp Lá', status: 'ACTIVE', activeStudentCount: 1 };
    const currentStudent = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [] };
    const nextStudent = { id: 'student-b', studentCode: 'S2', fullName: 'Bé Bình', dateOfBirth: '2023-01-01', enrollments: [] };
    let resolveClasses!: (value: Response) => void;
    let resolveStudents!: (value: Response) => void;
    const nextClasses = new Promise<Response>((resolve) => { resolveClasses = resolve; });
    const nextStudents = new Promise<Response>((resolve) => { resolveStudents = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/school-years')) return Promise.resolve(response([year, nextYear]));
      if (url.includes('/year-b/classes')) return nextClasses;
      if (url.includes('/year-b/students')) return nextStudents;
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : [currentStudent]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect((await screen.findAllByText('Lớp Mầm')).length).toBeGreaterThan(0);
    expect(screen.getByText('Bé An')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Năm 2027' }));
    expect(screen.getByRole('heading', { name: 'Thêm lớp cho Năm 2027' })).toBeTruthy();
    expect(screen.queryByText('Lớp Mầm')).toBeNull();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.getByText('Năm học này chưa có lớp.')).toBeTruthy();
    expect(screen.getByText('Năm học này chưa có học sinh.')).toBeTruthy();
    resolveClasses(response([nextClassroom]));
    resolveStudents(response([nextStudent]));
    expect(await screen.findByText('Lớp Lá')).toBeTruthy();
    expect(screen.getByText('Bé Bình')).toBeTruthy();
    expect(fetch.mock.calls.filter(([url]) => url.endsWith('/school-years'))).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/school-years/year-b/classes', expect.anything());
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/school-years/year-b/students', expect.anything());
  });

  it('creates Student only after server confirmation and displays server history', async () => {
    const student = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [{ id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', endedOn: null, schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Lớp Mầm' } }] };
    let studentReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? (studentReads++ ? [student] : []) : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '2022-01-01' } });
    fireEvent.change(screen.getByLabelText('Ngày hiệu lực'), { target: { value: '2026-01-01' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    await screen.findByText('S1');
    expect(screen.getAllByText('Đang nhập học').length).toBeGreaterThan(1);
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/students', expect.objectContaining({ method: 'POST' }));
  });

  it('keeps Student input and focuses the server field error', async () => {
    const fetch = rosterFetch(error({ fullName: 'Tên cần từ 1 đến 100 ký tự.' }));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: ' ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    expect(await screen.findByText('Tên cần từ 1 đến 100 ký tự.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe(' ');
  });

  it('uses server activeStudentCount to archive a Class without optimistic state', async () => {
    let classReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'archive-operation' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classReads++ ? { ...classroom, status: 'ARCHIVED' } : classroom] : url.endsWith('/students') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    vi.stubGlobal('confirm', vi.fn(() => true));
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu trữ' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/classes/class-a/archive', expect.objectContaining({ method: 'POST' })));
    expect(await screen.findByText('Đã lưu trữ')).toBeTruthy();
  });

  it('keeps the Class active when the server rejects archive for active students', async () => {
    const fetch = rosterFetch(new Response(JSON.stringify({ error: { message: 'Lớp còn học sinh đang nhập học.', activeStudentCount: 1 } }), { status: 409 }));
    vi.stubGlobal('fetch', fetch); vi.stubGlobal('confirm', vi.fn(() => true));
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu trữ' }));
    expect(await screen.findByText('Lớp còn học sinh đang nhập học.')).toBeTruthy();
    expect(screen.getAllByText('Đang hoạt động')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Lưu trữ' })).toBeTruthy();
  });

  it('does not render enrollment creation for a non-active SchoolYear', async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [] : [{ ...year, isActive: false }])));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText('Chỉ có thể tạo enrollment trong năm học đang hoạt động.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Tạo học sinh' })).toBeNull();
  });

  it('submits a lifecycle transition and refreshes server-confirmed history', async () => {
    const student = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [{ id: 'enrollment-a', lifecycle: 'WITHDRAWN', effectiveFrom: '2026-01-01', endedOn: '2026-03-01', schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Lớp Mầm' } }] };
    let reads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? (reads++ ? [student] : [{ ...student, enrollments: [{ ...student.enrollments[0], lifecycle: 'ENROLLED', endedOn: null }] }]) : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Trạng thái Bé An'), { target: { value: 'WITHDRAWN' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/enrollments/enrollment-a/lifecycle', expect.objectContaining({ method: 'POST' })));
    expect((await screen.findAllByText('Đã thôi học')).length).toBeGreaterThan(1);
  });

  it('submits an administrator-selected terminal date rather than deriving a UTC date', async () => {
    const student = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [{ id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', endedOn: null, schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Lớp Mầm' }, lifecycleHistory: [] }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? response({ id: 'operation' }) : response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [student] : [year])));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Ngày kết thúc Bé An'), { target: { value: '2026-09-16' } });
    fireEvent.change(screen.getByLabelText('Trạng thái Bé An'), { target: { value: 'WITHDRAWN' } });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/enrollments/enrollment-a/lifecycle', expect.objectContaining({ body: JSON.stringify({ lifecycle: 'WITHDRAWN', endedOn: '2026-09-16' }) })));
  });

  it('reconciles an uncertain mutation without replaying its POST', async () => {
    const fetch = rosterFetch();
    fetch.mockImplementationOnce(() => Promise.resolve(response([year]))).mockImplementationOnce(() => Promise.resolve(response([classroom]))).mockImplementationOnce(() => Promise.resolve(response([]))).mockRejectedValueOnce(new TypeError('timeout')).mockResolvedValueOnce(response({ status: 'PENDING' }));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toContain('school-a'));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/students') && options?.method === 'POST')).toHaveLength(1);
  });
});
