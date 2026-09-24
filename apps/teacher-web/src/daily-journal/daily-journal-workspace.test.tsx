import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DailyJournalWorkspace } from './daily-journal-workspace';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const roster = { data: { schoolId: 'school', classId: 'class', journalDate: '2026-09-24', students: [{ studentId: 'student', fullName: 'Bé An', studentCode: 'AN-1', status: 'MISSING', version: null, updatedAt: null, text: null, media: [] }] } };

describe('DailyJournalWorkspace', () => {
  it('keeps server-confirmed status and focuses a save validation error', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(roster)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { message: 'Cần nhập nhận xét.', fieldErrors: { text: 'Cần nhập nhận xét.' } } }), { status: 400 }));
    vi.stubGlobal('fetch', fetch);
    render(<DailyJournalWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã lớp nhận xét'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An');
    fireEvent.click(screen.getByRole('button', { name: 'Viết nhận xét' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nhận xét' }));
    const [error] = await screen.findAllByRole('alert');
    expect(document.activeElement).toBe(error);
    expect(screen.getAllByText('Chưa có nhận xét')).toHaveLength(2);
  });

  it('rejects invalid local image types before upload and retains the draft', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(roster)));
    vi.stubGlobal('fetch', fetch);
    render(<DailyJournalWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã lớp nhận xét'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An');
    fireEvent.click(screen.getByRole('button', { name: 'Viết nhận xét' }));
    fireEvent.change(screen.getByLabelText('Ảnh trong ngày'), { target: { files: [new File(['bad'], 'bad.gif', { type: 'image/gif' })] } });
    expect(await screen.findByText(/Chỉ nhận JPEG/)).toBeTruthy();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('renders server-confirmed context, keeps attached media while editing, and clears protected state when class changes', async () => {
    const current = { data: { ...roster.data, students: [{ ...roster.data.students[0], status: 'CURRENT', version: 2, text: 'Bản đã lưu', media: [{ id: 'media', contentType: 'image/png' }] }] } };
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(current)));
    vi.stubGlobal('fetch', fetch);
    render(<DailyJournalWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã lớp nhận xét'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Trường: school · Lớp: class · Ngày: 2026-09-24');
    fireEvent.click(screen.getByRole('button', { name: 'Xem/Sửa' }));
    expect(screen.getByRole('link', { name: 'Xem ảnh' }).getAttribute('href')).toBe('/api/teacher/schools/school/daily-journal-media/media');
    fireEvent.change(screen.getByLabelText('Mã lớp nhận xét'), { target: { value: 'class-2' } });
    expect(screen.queryByText('Bản đã lưu')).toBeNull();
  });

  it('shows the reviewed empty state after filters remove all students', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify(roster)));
    vi.stubGlobal('fetch', fetch);
    render(<DailyJournalWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã lớp nhận xét'), { target: { value: 'class' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An');
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Không có' } });
    expect(screen.getByText('Không có học sinh phù hợp với bộ lọc đang chọn.')).toBeTruthy();
  });
});
