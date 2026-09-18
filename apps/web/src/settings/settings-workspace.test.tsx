import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsWorkspace } from './settings-workspace';

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const settings = { asOf: '2026-01-01', timezone: 'Asia/Ho_Chi_Minh', profile: null, calendar: null, financePolicy: null, bankAccounts: [] };
afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); });

describe('SettingsWorkspace', () => {
  it('keeps invalid input, focuses the server error summary, and describes its field', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.', fieldErrors: { effectiveFrom: 'Đã có phiên bản tại ngày hiệu lực này.' } } }), { status: 400 }) : response(settings))));
    render(<SettingsWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change((await screen.findAllByLabelText('Ngày hiệu lực'))[0]!, { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường mới' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo phiên bản hồ sơ' }).closest('form')!);
    expect(await screen.findByText('Đã có phiên bản tại ngày hiệu lực này.')).toBeTruthy();
    expect(document.activeElement?.getAttribute('role')).toBe('alert');
    expect(screen.getAllByLabelText('Ngày hiệu lực')[0]!.getAttribute('aria-describedby')).toBe('profile-effectiveFrom-error');
    expect((screen.getByLabelText('Tên trường') as HTMLInputElement).value).toBe('Trường mới');
  });
  it('reconciles a timeout Operation without replaying the Settings POST', async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === 'POST') return Promise.reject(new TypeError('timeout'));
      if (url.includes('/operations/')) return Promise.resolve(response({ status: 'PENDING' }));
      return Promise.resolve(response(settings));
    });
    vi.stubGlobal('fetch', fetch);
    render(<SettingsWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change((await screen.findAllByLabelText('Ngày hiệu lực'))[0]!, { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Tên trường'), { target: { value: 'Trường mới' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo phiên bản hồ sơ' }).closest('form')!);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-settings-operation')).toContain('school-a'));
    expect(fetch.mock.calls.filter(([url, options]) => url.endsWith('/settings/profile-versions') && options?.method === 'POST')).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => url.includes('/operations/'))).toBe(true);
  });
  it('keeps calendar input and marks its own field after a calendar validation error', async () => {
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? new Response(JSON.stringify({ error: { message: 'Dữ liệu không hợp lệ.', fieldErrors: { effectiveFrom: 'Đã có phiên bản tại ngày hiệu lực này.' } } }), { status: 400 }) : response(settings))));
    render(<SettingsWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change((await screen.findAllByLabelText('Ngày hiệu lực'))[2]!, { target: { value: '2026-01-01' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo phiên bản lịch' }).closest('form')!);
    expect(await screen.findByText('Đã có phiên bản tại ngày hiệu lực này.')).toBeTruthy();
    expect(screen.getAllByLabelText('Ngày hiệu lực')[2]!.getAttribute('aria-describedby')).toBe('calendar-effectiveFrom-error');
    expect((screen.getAllByLabelText('Ngày hiệu lực')[2] as HTMLInputElement).value).toBe('2026-01-01');
  });
  it('resets drafts and safely discards malformed persisted pending state on school change', async () => {
    sessionStorage.setItem('passionedu.app.pending-settings-operation', '{bad json');
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(response(settings))));
    const view = render(<SettingsWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText('Tên trường'), { target: { value: 'Nháp A' } });
    view.rerender(<SettingsWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    await waitFor(() => expect(sessionStorage.getItem('passionedu.app.pending-settings-operation')).toBeNull());
    expect((screen.getByLabelText('Tên trường') as HTMLInputElement).value).toBe('');
  });
  it('submits fixed Finance settings input and retains server-confirmed account status', async () => {
    const finance = { ...settings, bankAccounts: [{ id: 'account-a', receivingBank: 'Ngân hàng A', accountNumber: '123', accountHolderName: 'Trường A', transferTemplate: '{{studentName}} {{className}}', status: 'ACTIVE' as const, lifecycleReason: null }] };
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === 'POST' ? response({}) : response(finance)));
    vi.stubGlobal('fetch', fetch); render(<SettingsWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change((await screen.findAllByLabelText('Ngày hiệu lực'))[1]!, { target: { value: '2026-01-01' } });
    fireEvent.change(screen.getByLabelText('Số ngày hạn thanh toán'), { target: { value: '30' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Tạo phiên bản chính sách' }).closest('form')!);
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/app/schools/school-a/settings/finance-policy-versions', expect.objectContaining({ method: 'POST', body: expect.stringContaining('CURRENT_SCHOOL_YEAR_ONLY') })));
    expect(screen.getAllByText('Đang hoạt động')).toHaveLength(2);
    expect((screen.getByLabelText('Mẫu chuyển khoản') as HTMLInputElement).readOnly).toBe(true);
    fireEvent.change(screen.getByLabelText('Trạng thái tài khoản'), { target: { value: 'INACTIVE' } });
    expect(screen.queryByText('Ngân hàng A')).toBeNull();
  });
});
