import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolContext } from './school-context';

const schoolA = { schoolId: 'a', schoolSlug: 'truong-a', schoolName: 'Trường A' };
const schoolB = { schoolId: 'b', schoolSlug: 'truong-b', schoolName: 'Trường B' };
const context = (school = schoolA) => ({ ...school, navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'attendance', label: 'Điểm danh' }] });
const fetchFor = (schools = [schoolA, schoolB]) => vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/schools') ? { data: schools } : input.endsWith('/a') ? { data: context(schoolA) } : input.endsWith('/b') ? { data: context(schoolB) } : input.includes('operational-queue') ? { data: { attendanceOn: '2026-09-24', operating: true, explanation: 'Hệ thống xác nhận.', classes: [] } } : { data: [] }))));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/'); });
describe('Teacher SchoolContext', () => {
  it('shows the chooser only on Home and focuses an authorized selected School heading', async () => {
    vi.stubGlobal('fetch', fetchFor()); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    const heading = await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    expect(document.activeElement).toBe(heading); expect(screen.queryByLabelText('Chọn trường')).toBeNull(); expect(screen.getByRole('button', { name: 'Về trang chủ' })).toBeTruthy();
  });
  it('loads an authorized direct slug and safely returns Home for an unknown slug', async () => {
    window.history.replaceState({}, '', '/schools/truong-a'); vi.stubGlobal('fetch', fetchFor()); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    cleanup(); window.history.replaceState({}, '', '/schools/unknown'); vi.stubGlobal('fetch', fetchFor()); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByLabelText('Chọn trường'); expect(window.location.pathname).toBe('/');
  });
  it('guards browser Back to Home and restores the scoped route on stay', async () => {
    window.history.replaceState({}, '', '/schools/truong-a'); vi.stubGlobal('fetch', fetchFor()); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' }); fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'lop-a' } });
    await waitFor(() => expect((screen.getByLabelText('Mã lớp') as HTMLInputElement).value).toBe('lop-a')); window.history.replaceState({}, '', '/'); fireEvent.popState(window); await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    expect(window.location.pathname).toBe('/schools/truong-a'); expect((screen.getByLabelText('Mã lớp') as HTMLInputElement).value).toBe('lop-a');
  });
  it('fails safely Home for malformed chooser and context responses', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{}] })))); render(<SchoolContext clear={vi.fn()} />); await screen.findByRole('alert'); cleanup();
    window.history.replaceState({}, '', '/schools/truong-a'); const fetch = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/schools') ? { data: [schoolA] } : { data: {} })))); vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    await screen.findByLabelText('Chọn trường'); expect(window.location.pathname).toBe('/');
  });
  it('keeps dirty input when staying and requires explicit discard before returning Home', async () => {
    vi.stubGlobal('fetch', fetchFor()); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'lop-a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' }));
    await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    expect((screen.getByLabelText('Mã lớp') as HTMLInputElement).value).toBe('lop-a');
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' })); fireEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' }));
    await waitFor(() => expect(screen.getByLabelText('Chọn trường')).toBeTruthy());
  });
  it('blocks pending Attendance navigation without discard and reconciles the existing Operation', async () => {
    const attendanceContext = { ...context(), navigation: [{ id: 'attendance', label: 'Điểm danh' }] };
    const fetch = vi.fn((input: string, init?: RequestInit) => Promise.resolve(new Response(JSON.stringify(
      input.endsWith('/schools') ? { data: [schoolA] }
        : input.endsWith('/a') ? { data: attendanceContext }
          : input.includes('/attendance-roster') ? { data: { classId: 'class', attendanceOn: '2026-09-24', photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 'student', fullName: 'Bé An', state: 'NOT_RECORDED', evidenceId: null, updatedAt: null }] } }
            : input.includes('/operations/') ? { data: { status: 'PENDING' } }
              : init?.method === 'POST' ? {} : { data: [] }
    ), init?.method === 'POST' ? { status: 504 } : undefined)));
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'class' } }); fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An'); fireEvent.click(screen.getByRole('button', { name: 'Có mặt' }));
    await screen.findByText('Kết quả chưa hoàn tất. Hãy kiểm tra lại kết quả với hệ thống.');
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' });
    expect(dialog.querySelector('.danger-action')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Đối soát thao tác' }));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes('/operations/'))).toHaveLength(2));
    expect(fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === 'POST')).toHaveLength(1);
  });
});
