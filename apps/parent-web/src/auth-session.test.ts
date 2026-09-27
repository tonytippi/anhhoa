import { describe, expect, it, vi } from 'vitest';
import { bootstrapSession, logout } from './auth-session';

describe('Parent session safe state', () => {
  it('clears protected state for startup denial and logout even after a server failure', async () => {
    const clear = vi.fn(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(bootstrapSession(clear)).resolves.toBeUndefined(); expect(clear).toHaveBeenCalledOnce();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(logout(clear)).resolves.toBeUndefined(); expect(clear).toHaveBeenCalledTimes(2);
  });
  it('boots Parent context with credentialed no-store session request', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [] } })));
    vi.stubGlobal('fetch', fetch);
    await bootstrapSession(vi.fn());
    expect(fetch).toHaveBeenCalledWith('/api/parent/auth/session', expect.objectContaining({ credentials: 'include', cache: 'no-store' }));
  });
});
