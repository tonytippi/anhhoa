import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SchoolContext } from './school-context';
afterEach(() => vi.unstubAllGlobals());
describe('Teacher SchoolContext', () => {
  it('does not expose access management and guards a dirty School switch', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ schoolId: 'a', schoolName: 'Trường A' }, { schoolId: 'b', schoolName: 'Trường B' }] }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { schoolId: 'a', schoolName: 'Trường A', navigation: [{ id: 'overview', label: 'Tổng quan' }, { id: 'access', label: 'Quản lý truy cập' }] } })))); render(<SchoolContext clear={vi.fn()} />); fireEvent.change(await screen.findByLabelText('Chọn trường'), { target: { value: 'a' } }); await screen.findByRole('heading', { name: 'PassionEdu - Giáo viên - Trường A' }); expect(screen.queryByText('Quản lý truy cập')).toBeNull(); fireEvent.click(screen.getByRole('button', { name: 'Đánh dấu thay đổi chưa gửi' })); fireEvent.change(screen.getByLabelText('Chọn trường'), { target: { value: 'b' } }); expect((await screen.findByRole('dialog')).textContent).toContain('Thay đổi chưa gửi'); });
});
