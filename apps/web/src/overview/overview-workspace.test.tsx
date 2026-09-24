import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OverviewWorkspace } from './overview-workspace';

const data = { date: '2026-02-09', isToday: false, metrics: { students: 2, staff: 1, present: 1, approvedLeave: 0, pickedUp: 1, unresolved: { label: 'Nghỉ không phép', count: 0 }, notRecorded: 1 }, classes: [{ classId: 'class-a', className: 'Mầm', students: 2, staff: 0, present: 1, approvedLeave: 0, pickedUp: 1, unresolved: { label: 'Nghỉ không phép', count: 0 }, notRecorded: 1 }] };
const response = (value: unknown, status = 200) => new Response(JSON.stringify({ data: value }), { status, headers: { 'content-type': 'application/json' } });
const props = (overrides: Partial<Parameters<typeof OverviewWorkspace>[0]> = {}) => ({ schoolId: 'school-a', schoolName: 'Trường A', selectedDate: undefined, setSelectedDate: vi.fn(), denied: vi.fn(), ...overrides });

describe('OverviewWorkspace', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('loads one GET-only server aggregate and renders metrics and class facts', async () => {
    const fetch = vi.fn().mockResolvedValue(response(data)); vi.stubGlobal('fetch', fetch);
    render(<OverviewWorkspace {...props()} />);
    await screen.findByRole('caption', { name: /Tình hình theo lớp/ });
    expect(screen.getByText('Tổng học sinh')).toBeTruthy(); expect(screen.getByText('Mầm')).toBeTruthy(); expect(screen.getAllByText('2')).toHaveLength(2);
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/overview', expect.objectContaining({ credentials: 'include' }));
    expect(fetch.mock.calls.every(([, options]) => !options?.method || options.method === 'GET')).toBe(true);
    expect((screen.getByLabelText('Ngày xem tổng quan') as HTMLInputElement).value).toBe('2026-02-09');
  });
  it('uses a valid selected date in its request and reports date selection to the route owner', async () => {
    const setSelectedDate = vi.fn(); const fetch = vi.fn().mockResolvedValue(response(data)); vi.stubGlobal('fetch', fetch);
    render(<OverviewWorkspace {...props({ selectedDate: '2026-02-08', setSelectedDate })} />);
    await screen.findByRole('caption', { name: /Tình hình theo lớp/ });
    expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/overview?date=2026-02-08', expect.anything());
    fireEvent.change(screen.getByLabelText('Ngày xem tổng quan'), { target: { value: '2026-02-07' } });
    expect(setSelectedDate).toHaveBeenCalledWith('2026-02-07');
  });
  it('shows explicit empty, malformed, non-denied error and retry states without synthetic metrics', async () => {
    const empty = vi.fn().mockResolvedValue(response({ ...data, classes: [] })); vi.stubGlobal('fetch', empty);
    const view = render(<OverviewWorkspace {...props({ selectedDate: '2026-02-09' })} />);
    await screen.findByText('Chưa có số liệu vận hành cho ngày đã chọn.'); expect(screen.queryByText('Tổng học sinh')).toBeNull(); view.unmount();
    const fetch = vi.fn().mockResolvedValueOnce(response({ date: 'bad' })).mockResolvedValueOnce(response(data)); vi.stubGlobal('fetch', fetch);
    render(<OverviewWorkspace {...props({ selectedDate: '2026-02-09' })} />);
    await screen.findByText('Dữ liệu tổng quan không hợp lệ.'); fireEvent.click(screen.getByRole('button', { name: 'Thử lại' })); await screen.findByRole('caption', { name: /Tình hình theo lớp/ });
  });
  it('does not let an older response overwrite a new selected date', async () => {
    let resolveOld!: (value: Response) => void;
    const fetch = vi.fn().mockReturnValueOnce(new Promise<Response>((resolve) => { resolveOld = resolve; })).mockResolvedValueOnce(response({ ...data, date: '2026-02-10', classes: [{ ...data.classes[0], className: 'Mới' }] }));
    vi.stubGlobal('fetch', fetch); const view = render(<OverviewWorkspace {...props({ selectedDate: '2026-02-09' })} />);
    view.rerender(<OverviewWorkspace {...props({ selectedDate: '2026-02-10' })} />);
    await screen.findByText('Mới'); resolveOld(response(data)); await waitFor(() => expect(screen.queryByText('Mầm')).toBeNull());
  });
  it('delegates a denied response to protected-state handling', async () => {
    const denied = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, 403))); render(<OverviewWorkspace {...props({ denied })} />);
    await waitFor(() => expect(denied).toHaveBeenCalled());
  });
});
