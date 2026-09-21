import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LeaveReviewWorkspace } from './leave-review-workspace';

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { 'content-type': 'application/json' } });

describe('LeaveReviewWorkspace', () => {
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

  it('submits an idempotent approval and refreshes the server list', async () => {
    const leave = { id: 'leave-a', studentId: 'student-a', status: 'PENDING', startsOn: '2026-02-09', operatingDates: ['2026-02-09'], rejectedReason: null };
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? response({}) : response([])));
    fetch.mockResolvedValueOnce(response([leave]));
    vi.stubGlobal('fetch', fetch);
    render(<LeaveReviewWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/leave-requests/leave-a/approve', expect.objectContaining({ method: 'POST', headers: expect.objectContaining({ 'idempotency-key': expect.any(String), 'x-operation-id': expect.any(String) }) })));
  });

  it('clears malformed saved reconciliation state', async () => {
    sessionStorage.setItem('passionedu.app.pending-leave-decision', '{bad');
    const fetch = vi.fn(() => Promise.resolve(response([{ id: 'leave-a', studentId: 'student-a', status: 'PENDING', startsOn: null, operatingDates: [], rejectedReason: null }])));
    vi.stubGlobal('fetch', fetch);
    render(<LeaveReviewWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole('button', { name: 'Duyệt' });
    expect(sessionStorage.getItem('passionedu.app.pending-leave-decision')).toBeNull();
  });
  it('submits a rejection with its reason', async () => {
    const leave = { id: 'leave-a', studentId: 'student-a', studentName: 'Bé An', studentCode: 'AN-01', status: 'PENDING', startsOn: '2026-02-09', operatingDates: ['2026-02-09'], rejectedReason: null };
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? response({}) : response([])));
    fetch.mockResolvedValueOnce(response([leave]));
    vi.stubGlobal('fetch', fetch);
    render(<LeaveReviewWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Lý do từ chối leave-a'), { target: { value: 'Thiếu thông tin' } });
    expect(screen.getByText('Bé An (AN-01)')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/leave-requests/leave-a/reject', expect.objectContaining({ body: JSON.stringify({ reason: 'Thiếu thông tin' }) })));
  });
  it('bounds timeout reconciliation and retains its operation for manual retry', async () => {
    vi.useFakeTimers();
    const schoolId = '11111111-1111-4111-8111-111111111111';
    const operationId = '22222222-2222-4222-8222-222222222222';
    sessionStorage.setItem('passionedu.app.pending-leave-decision', JSON.stringify({ id: operationId, schoolId, status: 'RECONCILING' }));
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(url.includes('leave-operations') ? response({ status: 'PENDING' }) : response([]))));
    render(<LeaveReviewWorkspace schoolId={schoolId} schoolName="Trường A" denied={vi.fn()} />);
    for (let index = 0; index < 9; index += 1) await act(async () => { await vi.advanceTimersByTimeAsync(750); });
    expect(screen.getByRole('alert').textContent).toContain('Không thể đối soát thao tác');
    expect(sessionStorage.getItem('passionedu.app.pending-leave-decision')).toContain(operationId);
    expect(screen.getByRole('button', { name: 'Đối soát thao tác' })).toBeTruthy();
    vi.useRealTimers();
  });
  it('persists the operation before POST and keeps a 404 reconciliation result for manual recovery', async () => {
    const schoolId = '11111111-1111-4111-8111-111111111111';
    const leave = { id: 'leave-a', studentId: 'student-a', status: 'PENDING', startsOn: '2026-02-09', operatingDates: ['2026-02-09'], rejectedReason: null };
    let savedDuringPost: string | null = null;
    const denied = vi.fn();
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') { savedDuringPost = sessionStorage.getItem('passionedu.app.pending-leave-decision'); return Promise.reject(new TypeError('network')); }
      if (url.includes('leave-operations')) return Promise.resolve(response({}, 404));
      return Promise.resolve(response([leave]));
    });
    vi.stubGlobal('fetch', fetch);
    render(<LeaveReviewWorkspace schoolId={schoolId} schoolName="Trường A" denied={denied} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Duyệt' }));
    await waitFor(() => expect(savedDuringPost).toContain(schoolId));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith(expect.stringContaining('leave-operations'), expect.anything()));
    expect(denied).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('passionedu.app.pending-leave-decision')).toContain(schoolId);
  });
});
