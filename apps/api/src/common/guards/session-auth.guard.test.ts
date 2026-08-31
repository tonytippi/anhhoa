import { describe, expect, it, vi } from 'vitest';
import { SessionAuthGuard } from './session-auth.guard.js';

function context(request: object, response = { clearCookie: vi.fn() }) { return { getHandler: () => undefined, getClass: () => undefined, switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) }; }
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
    const response = { clearCookie: vi.fn() };
    await expect(guard.canActivate(context({ cookies: { session: 'valid-session' } }, response) as never)).rejects.toThrow('Authentication is required.');
    expect(response.clearCookie).toHaveBeenCalledWith('session', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
  });
  it('clears an expired session before rejecting the request', async () => {
    const expired = new Error('jwt expired');
    expired.name = 'TokenExpiredError';
    const guard = new SessionAuthGuard({ getAllAndOverride: () => false } as never, { verifyAsync: vi.fn().mockRejectedValue(expired) } as never, {} as never, {} as never);
    const response = { clearCookie: vi.fn() };
    await expect(guard.canActivate(context({ cookies: { session: 'expired-session' } }, response) as never)).rejects.toThrow('Session expired.');
    expect(response.clearCookie).toHaveBeenCalledWith('session', { secure: true, httpOnly: true, sameSite: 'lax', path: '/' });
    await expect(guard.canActivate(context({ cookies: { session: 'expired-session' } }, response) as never)).rejects.toMatchObject({ response: { code: 'SESSION_EXPIRED' } });
  });
  it('does not clear a valid session when the admin lookup fails unexpectedly', async () => {
    const guard = new SessionAuthGuard({ getAllAndOverride: () => false } as never, { verifyAsync: vi.fn().mockResolvedValue({ sub: 'admin-id' }) } as never, { admin: { findUnique: vi.fn().mockRejectedValue(new Error('Database unavailable')) } } as never, { adminEmails: new Set(['admin@example.com']) } as never);
    const response = { clearCookie: vi.fn() };
    await expect(guard.canActivate(context({ cookies: { session: 'valid-session' } }, response) as never)).rejects.toThrow('Database unavailable');
    expect(response.clearCookie).not.toHaveBeenCalled();
  });
});
