import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolContext } from './school-context';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('Teacher SchoolContext', () => {
  it('does not expose access management and switches School when no mutation is pending', async () => {
    const fetch = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/schools') ? { data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] } : input.includes('operational-queue') ? { data: { attendanceOn: '2026-09-24', operating: true, explanation: 'Hệ thống xác nhận.', classes: [] } } : input.endsWith('/a') ? { data: { schoolId: 'a', schoolName: 'Trường A', navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'access', label: 'Quản lý truy cập' }, { id: 'attendance', label: 'Điểm danh' }] } } : { data: { schoolId: 'b', schoolName: 'Trường B', navigation: [{ id: 'overview', label: 'Tổng quan' }] } }))));
    vi.stubGlobal('fetch', fetch);
    render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    expect(screen.queryByText('Quản lý truy cập')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Hàng đợi lớp' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường B' });
  });
  it('does not render the queue without server-returned overview navigation', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { schoolId: 'a', schoolName: 'Trường A', navigation: [{ id: 'attendance', label: 'Điểm danh' }] } })));
    vi.stubGlobal('fetch', fetch); render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    expect(screen.queryByRole('heading', { name: 'Hàng đợi lớp' })).toBeNull();
  });
  it('shows the School-wide handover workspace only from server navigation', async () => {
    const fetch = vi.fn((input: string) => Promise.resolve(new Response(JSON.stringify(input.endsWith('/schools') ? { data: [{ schoolId: 'a', schoolName: 'Trường A' }] } : input.includes('operational-queue') ? { data: { attendanceOn: '2026-09-24', operating: true, explanation: 'Hệ thống xác nhận.', classes: [] } } : { data: { schoolId: 'a', schoolName: 'Trường A', navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'handover', label: 'Bàn giao' }] } }))));
    vi.stubGlobal('fetch', fetch);
    render(<SchoolContext clear={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } });
    await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' });
    expect(screen.getByRole('heading', { name: 'Bàn giao - tham chiếu vận hành' })).toBeTruthy();
    expect(screen.queryByLabelText('Mã lớp')).toBeNull();
  });
});
