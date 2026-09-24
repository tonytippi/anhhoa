import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HandoverWorkspace } from './handover-workspace';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('HandoverWorkspace', () => {
  it('uploads required evidence and submits only its opaque server ID', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { handoverOn: '2026-02-09', photoEvidenceMode: 'REQUIRED', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: null, evidenceId: null }] } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { id: 'opaque-evidence-id', availability: 'AVAILABLE' } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {} })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { handoverOn: '2026-02-09', photoEvidenceMode: 'REQUIRED', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: '2026-02-09T10:00:00.000Z', evidenceId: 'opaque-evidence-id' }] } })));
    vi.stubGlobal('fetch', fetch);
    render(<HandoverWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An');
    expect(screen.getByRole('button', { name: 'Xác nhận trả trẻ' }).hasAttribute('disabled')).toBe(true);
    const file = new File(['image'], 'handover.webp', { type: 'image/webp' });
    fireEvent.change(screen.getByLabelText('Bằng chứng bàn giao Bé An'), { target: { files: [file] } });
    await screen.findByText('Đã tải bằng chứng');
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận trả trẻ' }));
    await screen.findByText(/Đã trả trẻ lúc/);
    expect(fetch.mock.calls[1]![0]).toContain('/handover-evidence?handoverOn=');
    expect(fetch.mock.calls[1]![1].body).toBe(file);
    expect(fetch.mock.calls[2]![0]).toContain('/handovers');
    expect(fetch.mock.calls[2]![1].body).toContain('opaque-evidence-id');
  });
  it('clears stale roster state when the date changes', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { handoverOn: '2026-02-09', photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: null, evidenceId: null }] } })));
    vi.stubGlobal('fetch', fetch);
    render(<HandoverWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' }));
    await screen.findByText('Bé An');
    fireEvent.change(screen.getByLabelText('Ngày bàn giao'), { target: { value: '2026-02-10' } });
    expect(screen.queryByText('Bé An')).toBeNull();
  });
  it('reconciles a 504 handover response after server processing and renders confirmed pickup state', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { handoverOn: '2026-09-24', photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: null, evidenceId: null }] } })))
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: 'COMPLETED', outcome: { id: 'handover' } } })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { handoverOn: '2026-09-24', photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: '2026-09-24T03:00:00.000Z', evidenceId: null }] } })));
    vi.stubGlobal('fetch', fetch); render(<HandoverWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' })); await screen.findByText('Bé An'); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận trả trẻ' }));
    await screen.findByText(/Đã trả trẻ lúc/); expect(fetch.mock.calls[2]![0]).toContain('/operations/');
  });
  it('releases the pending lock after a PENDING operation and failed reconciliation without retrying the mutation', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { handoverOn: '2026-09-24', photoEvidenceMode: 'OPTIONAL', students: [{ studentId: 'student', fullName: 'Bé An', pickedUpAt: null, evidenceId: null }] } })))
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { status: 'PENDING' } })))
      .mockRejectedValueOnce(new Error('offline'));
    vi.stubGlobal('fetch', fetch); render(<HandoverWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' })); await screen.findByText('Bé An'); fireEvent.click(screen.getByRole('button', { name: 'Xác nhận trả trẻ' }));
    await screen.findByText('Kết quả chưa hoàn tất. Hãy kiểm tra lại kết quả với hệ thống.'); expect(screen.getByRole('button', { name: 'Xác nhận trả trẻ' }).hasAttribute('disabled')).toBe(false);
    await new Promise((resolve) => window.setTimeout(resolve, 1100)); await screen.findByText('Không thể xác nhận kết quả. Hãy kiểm tra lại kết quả với hệ thống.'); expect(fetch.mock.calls.filter(([url]) => String(url).includes('/handovers'))).toHaveLength(1);
  });
});
