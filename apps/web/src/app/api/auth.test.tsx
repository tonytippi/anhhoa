import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useCurrentAdmin } from './auth';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

afterEach(() => vi.unstubAllGlobals());

it('xóa identity cache sau khi refetch trả 401', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: admin }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'UNAUTHORIZED' } }), { status: 401 }));
  vi.stubGlobal('fetch', fetch);
  const queryClient = new QueryClient();
  function Probe(): React.JSX.Element {
    const identity = useCurrentAdmin();
    return <><output>{identity.data?.displayName}</output><button type="button" onClick={() => void identity.refetch()}>Làm mới</button></>;
  }
  render(<QueryClientProvider client={queryClient}><Probe /></QueryClientProvider>);
  expect(await screen.findByText('Ngọc Anh')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
  await waitFor(() => expect(queryClient.getQueryData(['auth', 'me'])).toBeUndefined());
});
