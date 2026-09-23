import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RosterWorkspace } from './roster-workspace';

const year = { id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true };
const classroom = { id: 'class-a', schoolYearId: 'year-a', name: 'Lớp Mầm', status: 'ACTIVE', activeStudentCount: 0 };
const position = { id: 'position-a', code: 'GIAO_VIEN', name: 'Giáo viên', status: 'ACTIVE', capabilities: ['ROSTER_MANAGE'] };
const staffProfile = { id: 'staff-a', fullName: 'Cô Mai', email: 'mai@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội', employmentStatus: 'ACTIVE', primaryPositionId: position.id, primaryPosition: { id: position.id, code: position.code, name: position.name, status: position.status }, schoolMembershipId: null };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const error = (fieldErrors: Record<string, string>) => new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.', fieldErrors } }), { status: 400 });
const rosterFetch = (post = response({ id: 'operation' })) => vi.fn((url: string, options?: RequestInit) => {
  if (options?.method === 'POST') return Promise.resolve(post);
  return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
});

afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('RosterWorkspace', () => {
  it('keeps invalid SchoolYear input, focuses the summary, and renders field errors', async () => {
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? error({ name: 'Tên cần từ 1 đến 100 ký tự.' }) : response([])));
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
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? error({ name: 'Tên lớp là bắt buộc.' }) : response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year])));
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
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [currentStudent] : url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year, nextYear]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect((await screen.findAllByText('Lớp Mầm')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Bé An')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Năm 2027' }));
    expect(screen.getByRole('heading', { name: 'Thêm lớp cho Năm 2027' })).toBeTruthy();
    expect(screen.queryByText('Lớp Mầm')).toBeNull();
    expect(screen.queryByText('Bé An')).toBeNull();
    expect(screen.getByText('Năm học này chưa có lớp.')).toBeTruthy();
    expect(screen.getByText('Năm học này chưa có học sinh.')).toBeTruthy();
    resolveClasses(response([nextClassroom]));
    resolveStudents(response([nextStudent]));
    expect((await screen.findAllByText('Lớp Lá')).length).toBeGreaterThan(0);
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
    fireEvent.change(screen.getAllByLabelText('Ngày hiệu lực', { selector: 'input' }).at(-1)!, { target: { value: '2026-01-01' } });
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

  it('links staged profile, photo, and Parent errors to their inputs', async () => {
    const fetch = rosterFetch(error({ personalIdentifier: 'Mã định danh đã tồn tại.', photo: 'Ảnh không hợp lệ.' }));
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Mã định danh cá nhân'), { target: { value: 'ID-1' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    expect((await screen.findByLabelText('Mã định danh cá nhân')).getAttribute('aria-describedby')).toBe('personalIdentifier-error');
    expect(screen.getByLabelText('Ảnh hồ sơ').getAttribute('aria-describedby')).toBe('photo-error');
  });

  it('does not recreate a confirmed Student when the staged photo fails, and retains the intake', async () => {
    const created = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [{ id: 'enrollment-a', lifecycle: 'WAITING_FOR_CLASS', effectiveFrom: '2026-01-01', endedOn: null, schoolYear: { name: 'Năm 2026' }, classroom: null }] };
    const file = new File(['photo'], 'photo.png', { type: 'image/png' });
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith('/students') && options?.method === 'POST') return Promise.resolve(response({ outcome: { id: 'student-a' } }));
      if (url.endsWith('/photo') && options?.method === 'POST') return Promise.resolve(error({ photo: 'Tệp không hợp lệ.' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [created] : url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '2022-01-01' } });
    fireEvent.click(screen.getByLabelText('Chờ xếp lớp'));
    fireEvent.change(screen.getAllByLabelText('Ngày hiệu lực', { selector: 'input' }).at(-1)!, { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Ảnh hồ sơ'), { target: { files: [file] } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    expect(await screen.findByText('Dữ liệu không hợp lệ.')).toBeTruthy();
    expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    await waitFor(() => expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/students') && options?.method === 'POST')).toHaveLength(1));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/photo') && options?.method === 'POST')).toHaveLength(2);
  });

  it('does not recreate a confirmed Student when the staged Parent link fails', async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (url.endsWith('/students') && options?.method === 'POST') return Promise.resolve(response({ outcome: { id: 'student-a' } }));
      if (url.endsWith('/parents') && options?.method === 'POST') return Promise.resolve(error({ email: 'Email không hợp lệ.' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [] : url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.change(screen.getByLabelText('Ngày sinh'), { target: { value: '2022-01-01' } });
    fireEvent.change(screen.getAllByLabelText('Ngày hiệu lực', { selector: 'input' }).at(-1)!, { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Họ và tên phụ huynh'), { target: { value: 'Mai Trần' } });
    fireEvent.change(screen.getByLabelText('Email phụ huynh'), { target: { value: 'invalid' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    expect(await screen.findByText('Dữ liệu không hợp lệ.')).toBeTruthy();
    expect((screen.getByLabelText('Email phụ huynh') as HTMLInputElement).value).toBe('invalid');
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    await waitFor(() => expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/students') && options?.method === 'POST')).toHaveLength(1));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/parents') && options?.method === 'POST')).toHaveLength(2);
  });

  it('creates and displays a Parent link only after server confirmation', async () => {
    const student = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [] };
    let linkReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      if (url.endsWith('/parents')) return Promise.resolve(response(linkReads++ ? [{ id: 'link-a', studentId: 'student-a', status: 'ACTIVE', parent: { fullName: 'Mai Trần', email: 'mai@example.com', phone: '0900000000', bound: false } }] : []));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [student] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên phụ huynh Bé An'), { target: { value: 'Mai Trần' } });
    fireEvent.change(screen.getByLabelText('Email phụ huynh Bé An'), { target: { value: 'Mai@example.com' } });
    fireEvent.change(screen.getByLabelText('Số điện thoại phụ huynh Bé An'), { target: { value: '0900000000' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo liên kết' }).closest('form')!);
    expect(await screen.findByText('Mai Trần (mai@example.com) - Đang chờ')).toBeTruthy();
    expect(fetch.mock.calls.some(([url, options]) => url === '/api/app/schools/school-a/roster/students/student-a/parents' && (options as RequestInit)?.method === 'POST' && JSON.parse((options as RequestInit).body as string).email === 'Mai@example.com')).toBe(true);
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

  it('keeps a closed SchoolYear read-only while retaining its roster history', async () => {
    const closedYear = { ...year, closedAt: '2026-12-31T00:00:00.000Z' };
    const student = { id: 'student-a', studentCode: 'S1', fullName: 'Bé An', dateOfBirth: '2022-01-01', enrollments: [{ id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', endedOn: null, schoolYear: { name: 'Năm 2026' }, classroom: { name: 'Lớp Mầm' } }] };
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [student] : url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [closedYear]))));
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText('Năm học đã đóng. Danh bộ và lịch sử chỉ có thể xem.')).toBeTruthy();
    expect(await screen.findByText('Bé An')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Tạo kết quả xem trước' }).closest('fieldset')?.disabled).toBe(true);
    expect(screen.getByLabelText('Trạng thái Bé An').closest('fieldset')?.disabled).toBe(true);
  });

  it('previews movable and excluded rows then submits only the server movable IDs after named confirmation', async () => {
    const otherClass = { ...classroom, id: 'class-b', name: 'Lớp Chồi' };
    const preview = { fingerprint: 'preview-a', movable: [{ enrollmentId: 'enrollment-a', student: { fullName: 'Bé An' } }], excluded: [{ enrollmentId: 'enrollment-b', student: { fullName: 'Bé Bình' }, reason: 'Đã có enrollment' }], destination: { schoolYearName: 'Năm 2026', className: 'Lớp Chồi' } };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      void options;
      void options;
      if (url.endsWith('/transitions/preview')) return Promise.resolve(response(preview));
      if (url.endsWith('/transitions')) return Promise.resolve(response({ id: 'operation' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom, otherClass] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Chuyển danh bộ' });
    await screen.findAllByText('Lớp Mầm');
    fireEvent.change(screen.getByLabelText('Lớp nguồn'), { target: { value: classroom.id } });
    await waitFor(() => expect((screen.getByLabelText('Lớp nguồn') as HTMLSelectElement).value).toBe(classroom.id));
    fireEvent.change(screen.getByLabelText('Lớp đích'), { target: { value: otherClass.id } });
    await waitFor(() => expect((screen.getByLabelText('Lớp đích') as HTMLSelectElement).value).toBe(otherClass.id));
    const transitionForm = screen.getByRole('heading', { name: 'Chuyển danh bộ' }).closest('form')!;
    fireEvent.change(transitionForm.querySelector('input[type="date"]')!, { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Điều lớp' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo kết quả xem trước' }).closest('form')!);
    expect(await screen.findByText('Bé An: Có thể chuyển')).toBeTruthy();
    expect(screen.getByText('Bé Bình: Không chuyển, Đã có enrollment')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nhập CHUYỂN DANH BỘ để xác nhận'), { target: { value: 'CHUYỂN DANH BỘ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển danh bộ' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/transitions', expect.objectContaining({ body: JSON.stringify({ kind: 'CLASS_TRANSFER', sourceClassId: 'class-a', destinationSchoolYearId: 'year-a', destinationClassId: 'class-b', effectiveFrom: '2026-06-01', reason: 'Điều lớp', confirmation: 'CHUYỂN DANH BỘ', sourceSchoolYearId: 'year-a', selectedEnrollmentIds: ['enrollment-a'], previewFingerprint: 'preview-a' }) })));
  });

  it('reconciles a timed-out transition once without replaying its command', async () => {
    const preview = { fingerprint: 'preview-a', movable: [{ enrollmentId: 'enrollment-a', student: { fullName: 'Bé An' } }], excluded: [], destination: { schoolYearName: 'Năm 2026', className: 'Lớp Mầm' } };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      void options;
      if (url.endsWith('/transitions/preview')) return Promise.resolve(response(preview));
      if (url.endsWith('/transitions')) return Promise.reject(new TypeError('timeout'));
      if (url.includes('/operations/')) return Promise.resolve(response({ status: 'PENDING' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Chuyển danh bộ' });
    fireEvent.change(screen.getByLabelText('Lớp nguồn'), { target: { value: classroom.id } });
    fireEvent.change(screen.getByLabelText('Lớp đích'), { target: { value: classroom.id } });
    const transitionForm = screen.getByRole('heading', { name: 'Chuyển danh bộ' }).closest('form')!;
    fireEvent.change(transitionForm.querySelector('input[type="date"]')!, { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('Lý do'), { target: { value: 'Điều lớp' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo kết quả xem trước' }).closest('form')!);
    await screen.findByText('Bé An: Có thể chuyển');
    fireEvent.change(screen.getByLabelText('Nhập CHUYỂN DANH BỘ để xác nhận'), { target: { value: 'CHUYỂN DANH BỘ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chuyển danh bộ' }));
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toContain('transition'));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/transitions') && options?.method === 'POST')).toHaveLength(1);
  });

  it('previews close-year then submits the named confirmation with its server fingerprint', async () => {
    const preview = { fingerprint: 'close-preview-a', assignments: [{ assignmentId: 'placement-a', student: { fullName: 'Bé An' } }] };
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/close-year/preview')) return Promise.resolve(response(preview));
      if (url.endsWith('/close-year')) return Promise.resolve(response({ id: 'operation-a' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const closeForm = (await screen.findByRole('heading', { name: 'Đóng năm học' })).closest('form')!;
    fireEvent.change(screen.getByLabelText('Ngày đóng năm học'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Lý do đóng năm học'), { target: { value: 'Kết năm' } });
    fireEvent.submit(closeForm);
    expect(await screen.findByText('Bé An')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Nhập ĐÓNG NĂM HỌC để xác nhận'), { target: { value: 'ĐÓNG NĂM HỌC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng năm học' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/close-year', expect.objectContaining({ body: JSON.stringify({ schoolYearId: 'year-a', effectiveTo: '2026-12-31', reason: 'Kết năm', previewFingerprint: 'close-preview-a', confirmation: 'ĐÓNG NĂM HỌC' }) })));
  });

  it('reconciles a timed-out close-year command without a duplicate POST', async () => {
    const preview = { fingerprint: 'close-preview-a', assignments: [] };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      void options;
      if (url.endsWith('/close-year/preview')) return Promise.resolve(response(preview));
      if (url.endsWith('/close-year')) return Promise.reject(new TypeError('timeout'));
      if (url.includes('/operations/')) return Promise.resolve(response({ status: 'PENDING' }));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const closeForm = (await screen.findByRole('heading', { name: 'Đóng năm học' })).closest('form')!;
    fireEvent.change(screen.getByLabelText('Ngày đóng năm học'), { target: { value: '2026-12-31' } });
    fireEvent.change(screen.getByLabelText('Lý do đóng năm học'), { target: { value: 'Kết năm' } });
    fireEvent.submit(closeForm);
    await screen.findByRole('button', { name: 'Xác nhận đóng năm học' });
    fireEvent.change(screen.getByLabelText('Nhập ĐÓNG NĂM HỌC để xác nhận'), { target: { value: 'ĐÓNG NĂM HỌC' } });
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận đóng năm học' }));
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toContain('close-year'));
    expect(fetch.mock.calls.filter(([url, request]) => url.endsWith('/close-year') && request?.method === 'POST')).toHaveLength(1);
  });

  it('drops delayed transition preview after its source year changes', async () => {
    const nextYear = { id: 'year-b', name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01', isActive: false };
    let resolvePreview!: (value: Response) => void;
    const delayedPreview = new Promise<Response>((resolve) => { resolvePreview = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/transitions/preview')) return delayedPreview;
      return Promise.resolve(response(url.endsWith('/school-years') ? [year, nextYear] : url.includes('/year-b/') ? [] : url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year, nextYear]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Chuyển danh bộ' });
    fireEvent.change(screen.getByLabelText('Lớp nguồn'), { target: { value: classroom.id } });
    fireEvent.change(screen.getByLabelText('Lớp đích'), { target: { value: classroom.id } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo kết quả xem trước' }).closest('form')!);
    fireEvent.click(screen.getByRole('button', { name: 'Năm 2027' }));
    resolvePreview(response({ fingerprint: 'stale', movable: [{ enrollmentId: 'old', student: { fullName: 'Bé Cũ' } }], excluded: [], destination: { schoolYearName: 'Năm 2026', className: 'Lớp Mầm' } }));
    await screen.findByRole('heading', { name: 'Phân công nhân sự theo hiệu lực' });
    expect(screen.queryByText('Bé Cũ: Có thể chuyển')).toBeNull();
  });

  it('drops delayed destination classes after the destination selection changes', async () => {
    const nextYear = { id: 'year-b', name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01', isActive: false };
    let resolveDestination!: (value: Response) => void;
    const delayedDestination = new Promise<Response>((resolve) => { resolveDestination = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.includes('/school-years/year-b/classes')) return delayedDestination;
      return Promise.resolve(response(url.endsWith('/school-years') ? [year, nextYear] : url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year, nextYear]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Chuyển danh bộ' });
    fireEvent.change(screen.getByLabelText('Loại chuyển'), { target: { value: 'YEAR_TRANSITION' } });
    fireEvent.change(screen.getByLabelText('Năm học đích'), { target: { value: 'year-b' } });
    fireEvent.change(screen.getByLabelText('Năm học đích'), { target: { value: '' } });
    resolveDestination(response([{ id: 'class-old', schoolYearId: 'year-b', name: 'Lớp cũ', status: 'ACTIVE', activeStudentCount: 0 }]));
    await waitFor(() => expect(screen.queryByRole('option', { name: 'Lớp cũ' })).toBeNull());
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
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.reject(new TypeError('timeout'));
      if (url.includes('/operations/')) return Promise.resolve(response({ status: 'PENDING' }));
      if (url.endsWith('/classes')) return Promise.resolve(response([classroom]));
      if (url.endsWith('/students')) return Promise.reject(new TypeError('timeout'));
      return Promise.resolve(response(url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo học sinh' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toContain('school-a'));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/students') && options?.method === 'POST')).toHaveLength(1);
  });

  it('creates and edits a Staff profile only after server confirmation', async () => {
    const staff = staffProfile;
    const staffPath = '/api/app/schools/school-a/roster/staff';
    const assignmentsPath = '/api/app/schools/school-a/roster/school-years/year-a/staff-assignments';
    let staffReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      if (url === staffPath) return Promise.resolve(response(staffReads++ ? [{ ...staff, fullName: staffReads === 2 ? staff.fullName : 'Cô Mai đã sửa' }] : []));
      if (url === assignmentsPath) return Promise.resolve(response([]));
      return Promise.resolve(response(url.endsWith('/positions') ? [position] : url.endsWith('/classes') || url.endsWith('/students') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Họ và tên nhân sự'), { target: { value: 'Cô Mai' } });
    fireEvent.change(screen.getByLabelText('Email nhân sự'), { target: { value: staff.email } });
    fireEvent.change(screen.getByLabelText('Số điện thoại nhân sự'), { target: { value: staff.phone } });
    fireEvent.change(screen.getByLabelText('Ngày sinh nhân sự'), { target: { value: staff.dateOfBirth } });
    fireEvent.change(screen.getByLabelText('Giới tính'), { target: { value: staff.gender } });
    fireEvent.change(screen.getByLabelText('Địa chỉ'), { target: { value: staff.address } });
    fireEvent.change(screen.getByLabelText('Chức danh chính'), { target: { value: position.id } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu hồ sơ nhân sự' }).closest('form')!);
    expect((await screen.findAllByText('Cô Mai')).length).toBeGreaterThan(0);
    expect(fetch).toHaveBeenCalledWith(staffPath, expect.anything());
    expect(fetch).toHaveBeenCalledWith(assignmentsPath, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Sửa hồ sơ' }));
    fireEvent.change(screen.getByLabelText('Họ và tên nhân sự'), { target: { value: 'Cô Mai đã sửa' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu thay đổi hồ sơ' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/staff/staff-a', expect.objectContaining({ method: 'POST', body: JSON.stringify({ fullName: 'Cô Mai đã sửa', email: staff.email, phone: staff.phone, dateOfBirth: staff.dateOfBirth, gender: staff.gender, address: staff.address, employmentStatus: staff.employmentStatus, primaryPositionId: staff.primaryPositionId, schoolMembershipId: null }) })));
    expect((await screen.findAllByText('Cô Mai đã sửa')).length).toBeGreaterThan(0);
  });

  it('renames, changes capabilities, and inactivates a Position only after server reconciliation', async () => {
    let currentPosition = position;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      if (url.endsWith('/positions')) return Promise.resolve(response([currentPosition]));
      return Promise.resolve(response(url.endsWith('/classes') || url.endsWith('/students') || url.endsWith('/staff') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('button', { name: 'Đổi tên Giáo viên' });
    fireEvent.click(screen.getByRole('button', { name: 'Đổi tên Giáo viên' }));
    fireEvent.change(screen.getByLabelText('Tên chức danh mới'), { target: { value: 'Giáo viên chủ nhiệm' } });
    fireEvent.change(screen.getByLabelText('Lý do đổi tên chức danh'), { target: { value: 'Chuẩn hóa' } });
    currentPosition = { ...currentPosition, name: 'Giáo viên chủ nhiệm' };
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu tên chức danh' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/positions/position-a/name', expect.objectContaining({ method: 'POST', body: JSON.stringify({ name: 'Giáo viên chủ nhiệm', reason: 'Chuẩn hóa' }) })));
    await screen.findByRole('button', { name: 'Cấp capability cho Giáo viên chủ nhiệm' });
    fireEvent.click(screen.getByRole('button', { name: 'Cấp capability cho Giáo viên chủ nhiệm' }));
    fireEvent.change(screen.getByLabelText('Capability cần cấp'), { target: { value: 'ATTENDANCE_WRITE' } });
    fireEvent.change(screen.getByLabelText('Lý do cấp capability'), { target: { value: 'Điểm danh' } });
    currentPosition = { ...currentPosition, capabilities: [...currentPosition.capabilities, 'ATTENDANCE_WRITE'] };
    fireEvent.submit(screen.getByRole('button', { name: 'Cấp capability' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/positions/position-a/grants', expect.objectContaining({ body: JSON.stringify({ capability: 'ATTENDANCE_WRITE', reason: 'Điểm danh' }) })));
    await screen.findByRole('button', { name: 'Thu hồi Điểm danh của Giáo viên chủ nhiệm' });
    fireEvent.click(screen.getByRole('button', { name: 'Thu hồi Điểm danh của Giáo viên chủ nhiệm' }));
    fireEvent.change(screen.getByLabelText('Lý do thu hồi capability'), { target: { value: 'Không còn cần' } });
    currentPosition = { ...currentPosition, capabilities: ['ROSTER_MANAGE'] };
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận thu hồi capability' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/positions/position-a/grants/ATTENDANCE_WRITE/revoke', expect.objectContaining({ body: JSON.stringify({ reason: 'Không còn cần' }) })));
    await screen.findByRole('button', { name: 'Ngừng hiệu lực Giáo viên chủ nhiệm' });
    fireEvent.click(screen.getByRole('button', { name: 'Ngừng hiệu lực Giáo viên chủ nhiệm' }));
    fireEvent.change(screen.getByLabelText('Lý do ngừng hiệu lực chức danh'), { target: { value: 'Ngừng dùng' } });
    fireEvent.change(screen.getByLabelText('Nhập NGỪNG HIỆU LỰC để xác nhận'), { target: { value: 'NGỪNG HIỆU LỰC' } });
    currentPosition = { ...currentPosition, status: 'INACTIVE' };
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận ngừng hiệu lực' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/positions/position-a/inactivate', expect.objectContaining({ body: JSON.stringify({ reason: 'Ngừng dùng' }) })));
    expect((await screen.findAllByText('Không hiệu lực')).length).toBeGreaterThan(0);
  });

  it('retains Staff and assignment input and focuses the server validation summary', async () => {
    const staff = staffProfile;
    let posts = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(posts++ ? error({ reason: 'Lý do phân công là bắt buộc.' }) : error({ email: 'Email không hợp lệ.' }));
      return Promise.resolve(response(url.endsWith('/staff') ? [staff] : url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Email nhân sự'), { target: { value: 'invalid' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu hồ sơ nhân sự' }).closest('form')!);
    expect(await screen.findByText('Email không hợp lệ.')).toBeTruthy();
    expect((screen.getByLabelText('Email nhân sự') as HTMLInputElement).value).toBe('invalid');
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    fireEvent.change(screen.getByLabelText('Nhân sự'), { target: { value: staff.id } });
    fireEvent.change(screen.getByLabelText('Lớp phân công'), { target: { value: classroom.id } });
    fireEvent.change(screen.getByLabelText('Ngày hiệu lực phân công'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Lý do phân công'), { target: { value: ' ' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu phân công' }).closest('form')!);
    expect(await screen.findByText('Lý do phân công là bắt buộc.')).toBeTruthy();
    expect((screen.getByLabelText('Lý do phân công') as HTMLInputElement).value).toBe(' ');
    expect(screen.getByLabelText('Lý do phân công').getAttribute('aria-describedby')).toBe('assignment-reason-error');
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
  });

  it('reconciles a timed-out assignment mutation without replaying its POST', async () => {
    const staff = staffProfile;
    let resolveOperation!: (value: Response) => void;
    const operation = new Promise<Response>((resolve) => { resolveOperation = resolve; });
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.reject(new TypeError('timeout'));
      if (url.includes('/operations/')) return operation;
      return Promise.resolve(response(url.endsWith('/staff') ? [staff] : url.endsWith('/classes') ? [classroom] : url.endsWith('/students') || url.endsWith('/staff-assignments') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2026' });
    fireEvent.change(screen.getByLabelText('Nhân sự'), { target: { value: staff.id } });
    fireEvent.change(screen.getByLabelText('Lớp phân công'), { target: { value: classroom.id } });
    fireEvent.change(screen.getByLabelText('Ngày hiệu lực phân công'), { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Lý do phân công'), { target: { value: 'Phân công' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu phân công' }).closest('form')!);
    const assignmentPath = '/api/app/schools/school-a/roster/staff/staff-a/assignments';
    await waitFor(() => expect(fetch.mock.calls.filter(([url, options]) => url === assignmentPath && options?.method === 'POST')).toHaveLength(1));
    const saved = JSON.parse(sessionStorage.getItem('passionedu.app.pending-roster-operation')!) as { id: string; schoolId: string; kind: string };
    expect(saved).toMatchObject({ schoolId: 'school-a', kind: 'assignment' });
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/app/schools/school-a/operations/${saved.id}`, expect.objectContaining({ credentials: 'include' })));
    resolveOperation(response({ status: 'COMPLETED' }));
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-roster-operation')).toBeNull());
    expect(fetch.mock.calls.filter(([url, options]) => url === assignmentPath && options?.method === 'POST')).toHaveLength(1);
  });

  it('ignores stale Staff reads after a School switch', async () => {
    let resolveStaff!: (value: Response) => void;
    const delayedStaff = new Promise<Response>((resolve) => { resolveStaff = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools/school-a/roster/staff') return delayedStaff;
      if (url.endsWith('/school-years')) return Promise.resolve(response([year]));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : []));
    });
    vi.stubGlobal('fetch', fetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveStaff(response([{ id: 'staff-a', fullName: 'Cô Cũ', email: 'cu@example.com', phone: '0900000000', dateOfBirth: '1990-01-01', gender: 'Nữ', address: 'Hà Nội' }]));
    await screen.findByText('Năm học của Trường B');
    expect(screen.queryByText('Cô Cũ')).toBeNull();
  });

  it('clears Positions immediately and ignores a stale Position response after a School switch', async () => {
    let resolvePositions!: (value: Response) => void;
    const delayedPositions = new Promise<Response>((resolve) => { resolvePositions = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url === '/api/app/schools/school-a/roster/positions') return delayedPositions;
      if (url.endsWith('/school-years')) return Promise.resolve(response([year]));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : []));
    });
    vi.stubGlobal('fetch', fetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolvePositions(response([{ ...position, name: 'Chức danh cũ' }]));
    await screen.findByText('Năm học của Trường B');
    expect(screen.queryByText('Chức danh cũ')).toBeNull();
  });

  it('ignores stale assignment reads after a School switch', async () => {
    let resolveAssignments!: (value: Response) => void;
    const delayedAssignments = new Promise<Response>((resolve) => { resolveAssignments = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.includes('/school-a/roster/school-years/year-a/staff-assignments')) return delayedAssignments;
      if (url.endsWith('/school-years')) return Promise.resolve(response([year]));
      return Promise.resolve(response(url.endsWith('/staff') ? [] : url.endsWith('/classes') ? [classroom] : []));
    });
    vi.stubGlobal('fetch', fetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2026' });
    view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveAssignments(response([{ id: 'assignment-a', staffProfileId: 'staff-a', effectiveFrom: '2026-01-01', effectiveTo: null, reason: 'Cũ', staff: { fullName: 'Cô Cũ' }, schoolYear: { id: year.id, name: year.name }, classroom: { id: classroom.id, name: classroom.name }, access: { status: 'NOT_PROVIDED' } }]));
    await screen.findByText('Năm học của Trường B');
    expect(screen.queryByText('Cũ')).toBeNull();
  });

  it('never renders a delayed old SchoolYear assignment after selecting another SchoolYear', async () => {
    const nextYear = { id: 'year-b', name: 'Năm 2027', startsOn: '2027-01-01', endsOn: '2028-01-01', isActive: false };
    let resolveOldAssignments!: (value: Response) => void;
    const oldAssignments = new Promise<Response>((resolve) => { resolveOldAssignments = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.endsWith('/school-years')) return Promise.resolve(response([year, nextYear]));
      if (url.includes('/school-years/year-a/staff-assignments')) return oldAssignments;
      if (url.includes('/school-years/year-b/staff-assignments')) return Promise.resolve(response([]));
      return Promise.resolve(response(url.endsWith('/staff') || url.endsWith('/students') ? [] : url.includes('/year-b/classes') ? [] : [classroom]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2026' });
    fireEvent.click(screen.getByRole('button', { name: 'Năm 2027' }));
    await screen.findByRole('heading', { name: 'Thêm lớp cho Năm 2027' });
    resolveOldAssignments(response([{ id: 'assignment-old', staffProfileId: 'staff-a', effectiveFrom: '2026-01-01', effectiveTo: null, reason: 'Phân công năm cũ', staff: { fullName: 'Cô Cũ' }, schoolYear: { id: year.id, name: year.name }, classroom: { id: classroom.id, name: classroom.name }, access: { status: 'NOT_PROVIDED' } }]));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/school-years/year-b/staff-assignments', expect.anything()));
    expect(screen.queryByText('Phân công năm cũ')).toBeNull();
    expect(screen.queryByText('Cô Cũ')).toBeNull();
  });

  it('creates and changes an assignment with distinct accessible labels', async () => {
    const staff = staffProfile;
    const assignment = { id: 'assignment-a', staffProfileId: staff.id, effectiveFrom: '2026-01-01', effectiveTo: null, reason: 'Phân công đầu năm', staff: { fullName: staff.fullName }, schoolYear: { id: year.id, name: year.name }, classroom: { id: classroom.id, name: classroom.name }, access: { status: 'NOT_PROVIDED' } };
    const staffPath = '/api/app/schools/school-a/roster/staff';
    const assignmentsPath = '/api/app/schools/school-a/roster/school-years/year-a/staff-assignments';
    let assignmentReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(response({ id: 'operation' }));
      if (url === staffPath) return Promise.resolve(response([staff]));
      if (url === assignmentsPath) return Promise.resolve(response(assignmentReads++ ? [assignment] : []));
      return Promise.resolve(response(url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Nhân sự'), { target: { value: staff.id } });
    fireEvent.change(screen.getByLabelText('Lớp phân công'), { target: { value: classroom.id } });
    fireEvent.change(screen.getByLabelText('Ngày hiệu lực phân công'), { target: { value: assignment.effectiveFrom } });
    fireEvent.change(screen.getByLabelText('Lý do phân công'), { target: { value: assignment.reason } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu phân công' }).closest('form')!);
    await screen.findByRole('button', { name: 'Sửa phân công Cô Mai tại Lớp Mầm' });
    expect(fetch).toHaveBeenCalledWith(assignmentsPath, expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'Sửa phân công Cô Mai tại Lớp Mầm' }));
    fireEvent.change(screen.getByLabelText('Lý do phân công'), { target: { value: 'Điều chỉnh' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Lưu thay đổi phân công' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/roster/staff-assignments/assignment-a/change', expect.objectContaining({ method: 'POST', body: JSON.stringify({ schoolYearId: year.id, classId: classroom.id, effectiveFrom: assignment.effectiveFrom, effectiveTo: null, reason: 'Điều chỉnh' }) })));
  });

  it('ends an open assignment in an accessible dialog and retains invalid input', async () => {
    const staff = staffProfile;
    const assignment = { id: 'assignment-a', staffProfileId: staff.id, effectiveFrom: '2026-01-01', effectiveTo: null, reason: 'Phân công đầu năm', endReason: null, staff: { fullName: staff.fullName }, schoolYear: { id: year.id, name: year.name }, classroom: { id: classroom.id, name: classroom.name }, access: { status: 'NOT_PROVIDED' } };
    const assignmentsPath = '/api/app/schools/school-a/roster/school-years/year-a/staff-assignments';
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.resolve(error({ effectiveTo: 'Ngày kết thúc phải sau ngày hiệu lực.' }));
      if (url.endsWith('/staff')) return Promise.resolve(response([staff]));
      if (url === assignmentsPath) return Promise.resolve(response([assignment]));
      return Promise.resolve(response(url.endsWith('/classes') || url.endsWith('/students') ? [] : [year]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Kết thúc phân công Cô Mai tại Lớp Mầm' }));
    const dialog = screen.getByRole('dialog', { name: 'Kết thúc phân công' });
    expect(dialog).toBeTruthy();
    const endDate = dialog.querySelector('input[type="date"]') as HTMLInputElement;
    const endReason = dialog.querySelector('input:not([type])') as HTMLInputElement;
    fireEvent.change(endDate, { target: { value: '2026-01-01' } });
    fireEvent.change(endReason, { target: { value: 'Điều chuyển' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Xác nhận kết thúc' }).closest('form')!);
    await screen.findByText('Ngày kết thúc phải sau ngày hiệu lực.');
    expect(endDate.value).toBe('2026-01-01');
    expect(endReason.value).toBe('Điều chuyển');
    expect(endDate.getAttribute('aria-describedby')).toBe('end-assignment-effectiveTo-error');
  });

  it('keeps focus inside the end dialog and restores its trigger on close', async () => {
    const staff = staffProfile;
    const assignment = { id: 'assignment-a', staffProfileId: staff.id, effectiveFrom: '2026-01-01', effectiveTo: null, reason: 'Phân công đầu năm', endReason: null, staff: { fullName: staff.fullName }, schoolYear: { id: year.id, name: year.name }, classroom: { id: classroom.id, name: classroom.name }, access: { status: 'NOT_PROVIDED' } };
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(response(url.endsWith('/staff') ? [staff] : url.endsWith('/staff-assignments') ? [assignment] : url.endsWith('/classes') ? [classroom] : url.endsWith('/students') ? [] : [year]))));
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const trigger = await screen.findByRole('button', { name: 'Kết thúc phân công Cô Mai tại Lớp Mầm' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Kết thúc phân công' });
    const [date, reason, cancel, confirm] = Array.from(dialog.querySelectorAll<HTMLElement>('input, button')) as [HTMLElement, HTMLElement, HTMLElement, HTMLElement];
    await waitFor(() => expect(document.activeElement).toBe(date));
    confirm.focus(); fireEvent.keyDown(confirm, { key: 'Tab' }); expect(document.activeElement).toBe(date);
    date.focus(); fireEvent.keyDown(date, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(confirm);
    fireEvent.click(cancel);
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(reason).toBeTruthy();
  });
});
