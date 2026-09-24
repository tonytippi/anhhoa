import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OperationalQueueWorkspace } from './operational-queue-workspace';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/'); });

describe('OperationalQueueWorkspace', () => {
  it('uses URL date, Class, and status for a server-confirmed read-only detail', async () => {
    window.history.replaceState(null, '', '/?date=2026-09-24&classId=class&status=NOT_RECORDED');
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { attendanceOn: '2026-09-24', operating: true, explanation: 'Hệ thống xác nhận.', classes: [{ classId: 'class', className: 'Mầm A', attendanceGapCount: 1, pendingLeaveCount: 0 }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { attendanceOn: '2026-09-24', classId: 'class', className: 'Mầm A', status: 'NOT_RECORDED', operating: true, explanation: 'Hệ thống xác nhận.', students: [{ studentId: 'student', studentName: 'Bé An', studentCode: 'A-1' }] } })));
    vi.stubGlobal('fetch', fetch); render(<OperationalQueueWorkspace schoolId="school" denied={vi.fn()} />);
    await screen.findByText('Bé An');
    expect(fetch.mock.calls[1]![0]).toContain('date=2026-09-24&classId=class&status=NOT_RECORDED');
    expect(screen.getByText(/Không có thao tác ghi nhận tại đây\./)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /phí|ghi nhận/i })).toBeNull();
  });
  it('focuses a server error and never renders an inferred zero count', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'Không còn quyền xem hàng đợi.' } }), { status: 403 })));
    render(<OperationalQueueWorkspace schoolId="school" denied={vi.fn()} />);
    const error = await screen.findByRole('alert');
    expect(error.textContent).toBe('Không còn quyền xem hàng đợi.'); expect(document.activeElement).toBe(error); expect(screen.queryByText(/0 trẻ/)).toBeNull();
  });
});
