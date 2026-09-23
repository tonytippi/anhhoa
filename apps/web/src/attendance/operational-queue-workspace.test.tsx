import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationalQueueWorkspace } from './operational-queue-workspace';

const queue = (date = '2026-02-09') => ({ schoolId: 'school-a', attendanceOn: date, operating: true, explanation: 'Dữ liệu từ máy chủ.', classes: [{ classId: 'class-a', className: 'Mầm A', attendanceGapCount: 1, pendingLeaveCount: 1 }] });
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });

describe('OperationalQueueWorkspace', () => {
  afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

  it('opens a server-filtered read-only destination from a queue count', async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes('/items?') ? response({ attendanceOn: '2026-02-09', classId: 'class-a', className: 'Mầm A', status: 'NOT_RECORDED', operating: true, explanation: 'Dữ liệu từ máy chủ.', students: [{ studentId: 'student-a', studentName: 'Bé An', studentCode: 'AN-01' }] }) : response(queue())));
    vi.stubGlobal('fetch', fetch);
    render(<OperationalQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: '1 học sinh' }));
    await screen.findByText('Bé An');
    expect(window.location.search).toMatch(/^\?date=\d{4}-\d{2}-\d{2}&classId=class-a&status=NOT_RECORDED$/);
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/^\/api\/app\/schools\/school-a\/operational-queue\/items\?date=\d{4}-\d{2}-\d{2}&classId=class-a&status=NOT_RECORDED$/), { credentials: 'include' });
    expect(screen.queryByRole('button', { name: /Ghi điểm danh/i })).toBeNull();
  });

  it('keeps context and does not substitute zero when the queue request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    render(<OperationalQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải hàng đợi vận hành.');
    expect(screen.getByText('Trường A / Hàng đợi buổi sáng')).toBeTruthy();
    expect(screen.queryByText('0 học sinh')).toBeNull();
  });

  it('does not let a delayed older date response replace the selected date queue', async () => {
    let resolveOlder!: (value: Response) => void;
    const older = new Promise<Response>((resolve) => { resolveOlder = resolve; });
    const fetch = vi.fn((url: string) => url.includes('date=2026-02-09') ? older : Promise.resolve(response(queue('2026-02-10'))));
    vi.stubGlobal('fetch', fetch);
    render(<OperationalQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const input = await screen.findByLabelText('Ngày');
    fireEvent.change(input, { target: { value: '2026-02-10' } });
    await screen.findByText('2026-02-10 / Dữ liệu từ máy chủ.');
    resolveOlder(response(queue('2026-02-09')));
    await waitFor(() => expect(screen.queryByText('2026-02-09 / Dữ liệu từ máy chủ.')).toBeNull());
  });
});
