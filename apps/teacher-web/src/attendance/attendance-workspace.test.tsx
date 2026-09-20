import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AttendanceWorkspace } from './attendance-workspace';

afterEach(() => vi.unstubAllGlobals());

describe('AttendanceWorkspace', () => {
  it('renders only server-confirmed roster state and posts an opaque evidence ID', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { classId: 'class', attendanceOn: '2026-02-09', students: [{ studentId: 'student', fullName: 'Bé An', state: 'NOT_RECORDED', evidenceId: null, updatedAt: null }] } }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }))).mockResolvedValueOnce(new Response(JSON.stringify({ data: { classId: 'class', attendanceOn: '2026-02-09', students: [{ studentId: 'student', fullName: 'Bé An', state: 'PRESENT', evidenceId: 'evidence', updatedAt: '2026-02-09T01:00:00.000Z' }] } })));
    vi.stubGlobal('fetch', fetch); render(<AttendanceWorkspace schoolId="school" onDirty={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Mã lớp'), { target: { value: 'class' } }); fireEvent.click(screen.getByRole('button', { name: 'Tải danh sách' })); await screen.findByText('Bé An'); fireEvent.change(screen.getByLabelText('Bằng chứng Bé An'), { target: { value: 'evidence' } }); fireEvent.click(screen.getByRole('button', { name: 'Có mặt' }));
    await screen.findByText(/PRESENT/); expect(fetch.mock.calls[1]![1].body).toContain('evidence');
  });
});
