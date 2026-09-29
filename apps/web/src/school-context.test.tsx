import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { SchoolContext } from './school-context';

const schoolA = { schoolId: 'uuid-a', schoolSlug: 'peakland', schoolName: 'Trường Peakland' };
const schoolB = { schoolId: 'uuid-b', schoolSlug: 'sunrise', schoolName: 'Trường Sunrise' };
const context = (school = schoolA) => ({ ...school, membershipId: `member-${school.schoolId}`, capabilities: ['SCHOOL_CONTEXT_READ', 'ROSTER_MANAGE'], navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'roster', label: 'Danh bộ' }] });
const fetchFor = () => vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url === '/api/app/schools' ? { data: [schoolA, schoolB] } : url.endsWith('/uuid-a') ? { data: context(schoolA) } : url.endsWith('/uuid-b') ? { data: context(schoolB) } : url.includes('/overview') ? { data: { date: '2026-02-09', isToday: true, metrics: { students: 0, staff: 0, present: 0, approvedLeave: 0, pickedUp: 0, unresolved: { label: 'Chưa đến lớp', count: 0 }, notRecorded: 0 }, classes: [] } } : url.includes('/students?') ? { data: [{ id: 'student-a', studentCode: 'S1', fullName: 'Bé An', hasPhoto: false, enrollment: { id: 'enrollment-a', lifecycle: 'ENROLLED', effectiveFrom: '2026-01-01', classroom: null }, relatives: { mother: null, father: null, otherRelativeCount: 0 } }], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } } : url.includes('/school-years') ? { data: [{ id: 'year-a', name: 'Năm 2026', startsOn: '2026-01-01', endsOn: '2027-01-01', isActive: true }] } : { data: [], meta: { page: 1, pageSize: 25, totalItems: 0, totalPages: 1 } }))));
const renderContext = () => render(<BrowserRouter><SchoolContext clear={vi.fn()} userIdentityId="identity-a" /></BrowserRouter>);
afterEach(() => { vi.unstubAllGlobals(); localStorage.clear(); window.history.replaceState({}, '', '/'); });
describe('SchoolContext Home-only chooser', () => {
  it('renders the School list only at Home and opens the authorized overview from its row action', async () => {
    vi.stubGlobal('fetch', fetchFor()); renderContext(); const chooser = await screen.findByRole('table', { name: 'Danh sách trường được cấp quyền' }); expect(within(chooser).getByRole('row', { name: /Trường Peakland Mở trường/ })).toBeTruthy(); fireEvent.click(within(chooser).getAllByRole('button', { name: 'Mở trường' })[0]!);
    const heading = await screen.findByRole('heading', { name: 'Tổng quan vận hành' }); await waitFor(() => expect(document.activeElement).toBe(heading)); expect(screen.queryByRole('table', { name: 'Danh sách trường được cấp quyền' })).toBeNull(); expect(screen.getByText('Trường Peakland')).toBeTruthy();
  });
  it('accepts an authorized direct slug and clears an unknown selector to Home', async () => {
    window.history.replaceState({}, '', '/schools/peakland/overview'); vi.stubGlobal('fetch', fetchFor()); renderContext(); await screen.findByRole('heading', { name: 'Tổng quan vận hành' });
    window.history.pushState({}, '', '/schools/unknown/overview'); fireEvent.popState(window); await screen.findByRole('table', { name: 'Danh sách trường được cấp quyền' }); expect(window.location.pathname).toBe('/');
  });
  it('guards a dirty workspace when returning Home and discards only explicitly', async () => {
    window.history.replaceState({}, '', '/schools/peakland/students'); vi.stubGlobal('fetch', fetchFor()); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' })); await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' })); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
    fireEvent.click(screen.getByRole('button', { name: 'Về trang chủ' })); fireEvent.click(await screen.findByRole('button', { name: 'Bỏ thay đổi' })); await waitFor(() => expect(screen.getByRole('table', { name: 'Danh sách trường được cấp quyền' })).toBeTruthy());
  });
  it('lets the staff intake modal request the shell leave guard without losing its draft', async () => {
    window.history.replaceState({}, '', '/schools/peakland/staff'); vi.stubGlobal('fetch', fetchFor()); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm nhân viên' }));
    const intake = await screen.findByRole('dialog', { name: 'Tạo hồ sơ nhân viên' }); fireEvent.change(screen.getByLabelText('Email liên hệ'), { target: { value: 'draft@example.com' } }); fireEvent.click(within(intake).getByRole('button', { name: 'Về trang chủ' }));
    await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' })); expect((screen.getByLabelText('Email liên hệ') as HTMLInputElement).value).toBe('draft@example.com');
  });
  it('guards browser Back to Home and restores the scoped route on stay', async () => {
    window.history.replaceState({}, '', '/'); window.history.pushState({}, '', '/schools/peakland/students'); vi.stubGlobal('fetch', fetchFor()); renderContext(); fireEvent.click(await screen.findByRole('button', { name: 'Thêm học sinh' })); fireEvent.change(await screen.findByLabelText('Họ và tên'), { target: { value: 'Bé An' } });
    window.history.back(); fireEvent.popState(window); await screen.findByRole('dialog', { name: 'Rời không gian làm việc?' }); fireEvent.click(screen.getByRole('button', { name: 'Ở lại' }));
    expect(window.location.pathname).toBe('/schools/peakland/students'); expect((screen.getByLabelText('Họ và tên') as HTMLInputElement).value).toBe('Bé An');
  });
});
