import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { resetApiClientForTests } from '../../app/api/client';
import { StudentDetailPage } from './detail-page';

const student = { id: 'a2e36687-69b4-4e89-8ec0-141ff397837f', fullName: 'Bé An', nickname: null, classId: null, class: null, status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });

it('hiển thị Parent scoped và giữ confirmation thu hồi với email cùng học sinh', async () => {
  const parent = { parentId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', email: 'parent@example.com', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', revokedAt: null };
  vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/parents') ? { data: [parent] } : { data: student }), { status: 200 }))));
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/hoc-sinh/${student.id}`]}><StudentDetailPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('table', { name: 'Parent của học sinh' })).toHaveTextContent(parent.email);
  fireEvent.click(screen.getByRole('button', { name: 'Thu hồi' }));
  expect(screen.getByRole('dialog', { name: 'Thu hồi quyền Parent?' })).toHaveTextContent(`${parent.email} sẽ không còn xem được thông tin của ${student.fullName}.`);
});

it('gửi revoke với UUID idempotency và cập nhật UI sau response terminal', async () => {
  const parent = { parentId: 'b2e36687-69b4-4e89-8ec0-141ff397837f', email: 'parent@example.com', status: 'ACTIVE', createdAt: '2026-01-01T00:00:00.000Z', revokedAt: null };
  let revoked = false;
  const fetch = vi.fn((url: string, init?: RequestInit) => {
    if (url.endsWith('/parents')) return Promise.resolve(new Response(JSON.stringify({ data: [revoked ? { ...parent, status: 'REVOKED', revokedAt: '2026-01-02T00:00:00.000Z' } : parent] }), { status: 200 }));
    if (url.endsWith('/revoke')) { expect(init?.headers).toMatchObject({ 'Idempotency-Key': expect.stringMatching(/^[0-9a-f-]{36}$/) }); revoked = true; const operationId = (init?.headers as Record<string, string>)['Idempotency-Key']; return Promise.resolve(new Response(JSON.stringify({ data: { operationId, parentId: parent.parentId, email: parent.email, status: 'REVOKED' } }), { status: 200 })); }
    if (url.endsWith('/csrf')) return Promise.resolve(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 }));
    return Promise.resolve(new Response(JSON.stringify({ data: student }), { status: 200 }));
  });
  vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/hoc-sinh/${student.id}`]}><StudentDetailPage /></MemoryRouter></QueryClientProvider>);
  fireEvent.click(await screen.findByRole('button', { name: 'Thu hồi' }));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận thu hồi' }));
  expect(await screen.findByRole('status')).toHaveTextContent('Đã thu hồi quyền Parent.');
  await waitFor(() => expect(screen.getByText('Đã thu hồi')).toBeVisible());
});

it('giữ operation ID và đối soát khi mutation timeout', async () => {
  const operationId = 'c2e36687-69b4-4e89-8ec0-141ff397837f';
  sessionStorage.setItem('anhhoa.pending-parent-mutation', JSON.stringify({ studentId: student.id, operationId, type: 'grant', emails: ['parent@example.com'] }));
  const fetch = vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.includes('/operations/') ? { data: { operationId, state: 'PENDING' } } : url.endsWith('/parents') ? { data: [] } : { data: student }), { status: 200 })));
  vi.stubGlobal('fetch', fetch);
  render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><MemoryRouter initialEntries={[`/hoc-sinh/${student.id}`]}><StudentDetailPage /></MemoryRouter></QueryClientProvider>);
  expect(await screen.findByRole('button', { name: 'Kiểm tra lại kết quả' })).toBeEnabled();
  expect(sessionStorage.getItem('anhhoa.pending-parent-mutation')).toContain(operationId);
  expect(screen.getByRole('button', { name: 'Cấp quyền Parent' })).toBeDisabled();
});
