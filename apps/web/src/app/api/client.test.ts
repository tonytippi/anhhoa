import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, ApiTimeoutError, apiUrl, getJson, requestJson, resetApiClientForTests } from './client';

afterEach(() => { vi.unstubAllGlobals(); resetApiClientForTests(); });

it('gửi REST request credentialed với Accept JSON', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await getJson('/auth/me');
  expect(fetch).toHaveBeenCalledWith('/api/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
});

it('dùng API relative qua web origin khi không có override', () => {
  expect(apiUrl('/auth/google')).toBe('/api/auth/google');
  expect(apiUrl('/auth/me')).not.toContain('localhost:3000');
});

it('giữ message và field errors từ API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ.', fieldErrors: ['email'] } }), { status: 400 })));
  await expect(getJson('/auth/me')).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ.', fieldErrors: ['email'] } satisfies Partial<ApiError>);
});

it('coi JSON malformed là lỗi API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));
  await expect(getJson('/auth/me')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
});

it('chia sẻ một request CSRF cho mutation đồng thời', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ data: {} }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await Promise.all([requestJson('/classes', { method: 'POST', body: '{}' }), requestJson('/classes', { method: 'POST', body: '{}' })]);
  expect(fetch.mock.calls.filter(([url]) => url === '/api/auth/csrf')).toHaveLength(1);
});

it('returns CSRF rejection without replaying an unsafe mutation', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'old' } }), { status: 200 })).mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Invalid request origin or CSRF token.' } }), { status: 403 }));
  vi.stubGlobal('fetch', fetch);
  await expect(requestJson('/classes', { method: 'POST', body: '{}' })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' } satisfies Partial<ApiError>);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('times out an unsafe request once without replaying it', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: { csrfToken: 'token' } }), { status: 200 })).mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => (init.signal as AbortSignal).addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  vi.stubGlobal('fetch', fetch);
  const request = requestJson('/classes', { method: 'POST', body: '{}' });
  const rejection = expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
  await vi.advanceTimersByTimeAsync(10_000);
  await rejection;
  expect(fetch).toHaveBeenCalledTimes(2);
  vi.useRealTimers();
});

it('times out during CSRF acquisition without sending a write', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn().mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => (init.signal as AbortSignal | undefined)?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))));
  vi.stubGlobal('fetch', fetch);
  const request = requestJson('/classes', { method: 'POST', body: '{}' });
  const rejection = expect(request).rejects.toBeInstanceOf(ApiTimeoutError);
  await vi.advanceTimersByTimeAsync(10_000);
  await rejection;
  expect(fetch).toHaveBeenCalledTimes(1);
  vi.useRealTimers();
});
