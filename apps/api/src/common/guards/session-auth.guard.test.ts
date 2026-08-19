import { describe, expect, it, vi } from 'vitest';
import { SessionAuthGuard } from './session-auth.guard.js';

function context(request: object) { return { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => request }) }; }
describe('SessionAuthGuard', () => {
  it('rejects a missing session and attaches the persisted admin for a valid session', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };
    const jwt = { verifyAsync: vi.fn().mockResolvedValue({ sub: 'admin-id' }) };
    const prisma = { admin: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'admin@example.com' }) } };
    const guard = new SessionAuthGuard(reflector as never, jwt as never, prisma as never, { adminEmails: new Set(['admin@example.com']) } as never);
    await expect(guard.canActivate(context({ cookies: {} }) as never)).rejects.toThrow('Authentication is required.');
    const request = { cookies: { session: 'valid-session' } };
    await expect(guard.canActivate(context(request) as never)).resolves.toBe(true);
    expect(request).toMatchObject({ user: { id: 'admin-id' } });
  });
  it('leaves only explicitly public handlers open', async () => {
    const guard = new SessionAuthGuard({ getAllAndOverride: () => true } as never, {} as never, {} as never, {} as never);
    await expect(guard.canActivate(context({}) as never)).resolves.toBe(true);
  });
  it('rejects a session whose admin email was removed from the allowlist', async () => {
    const guard = new SessionAuthGuard({ getAllAndOverride: () => false } as never, { verifyAsync: vi.fn().mockResolvedValue({ sub: 'admin-id' }) } as never, { admin: { findUnique: vi.fn().mockResolvedValue({ id: 'admin-id', email: 'removed@example.com' }) } } as never, { adminEmails: new Set(['admin@example.com']) } as never);
    await expect(guard.canActivate(context({ cookies: { session: 'valid-session' } }) as never)).rejects.toThrow('Authentication is required.');
  });
});
