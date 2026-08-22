import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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
