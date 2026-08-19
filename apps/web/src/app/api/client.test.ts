import { afterEach, expect, it, vi } from 'vitest';
import { ApiError, getJson } from './client';

afterEach(() => vi.unstubAllGlobals());

it('gửi REST request credentialed với Accept JSON', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {} }), { status: 200 }));
  vi.stubGlobal('fetch', fetch);
  await getJson('/auth/me');
  expect(fetch).toHaveBeenCalledWith('http://localhost:3000/auth/me', { credentials: 'include', headers: { Accept: 'application/json' } });
});

it('giữ message và field errors từ API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ.', fieldErrors: ['email'] } }), { status: 400 })));
  await expect(getJson('/auth/me')).rejects.toMatchObject({ status: 400, code: 'BAD_REQUEST', message: 'Dữ liệu không hợp lệ.', fieldErrors: ['email'] } satisfies Partial<ApiError>);
});

it('coi JSON malformed là lỗi API', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{', { status: 200 })));
  await expect(getJson('/auth/me')).rejects.toMatchObject({ status: 200, code: 'INVALID_RESPONSE' } satisfies Partial<ApiError>);
});
