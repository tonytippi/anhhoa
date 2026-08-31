import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { AuthController } from './auth.controller.js';

const config = { csrfCookieName: 'csrf_token', oauthStateCookieName: 'oauth_state', oauthRedirectUrls: ['http://localhost:5173', 'http://localhost:5173/login'], oauthDeniedRedirectUrl: 'http://localhost:5173/login?source=oauth#login', sessionCookieMaxAge: 86_400_000 } as never;
const admin = { id: 'a0b5d395-c2ea-4f15-a954-0a6d8898e8cc', email: 'admin@example.com', displayName: 'Admin', avatarUrl: null, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-02T00:00:00Z') };

describe('AuthController', () => {
  it('issues an explicitly secure, httpOnly, Lax session cookie and preserves the state-validated redirect', async () => {
    const admins = { upsertGoogleAdmin: vi.fn().mockResolvedValue(admin) };
    const jwt = { signAsync: vi.fn().mockResolvedValue('signed-session') };
    const controller = new AuthController(admins as never, jwt as never, config);
    const response = { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
    await controller.callback({ user: { googleId: 'google-id', email: admin.email, displayName: 'Admin' }, oauthRedirect: 'http://localhost:5173/login' } as never, response as never);
    expect(response.cookie).toHaveBeenCalledWith('session', 'signed-session', { secure: true, httpOnly: true, sameSite: 'lax', path: '/', maxAge: 86_400_000 });
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/login');
  });
  it('returns only the safe profile for the current authenticated admin', () => {
    const controller = new AuthController({} as never, {} as never, config);
    expect(controller.me(admin as never)).toEqual({ data: { id: admin.id, email: admin.email, displayName: 'Admin', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z' } });
  });
  it('redirects an account-link conflict to the safe denied destination without issuing a session', async () => {
    const controller = new AuthController({ upsertGoogleAdmin: vi.fn().mockRejectedValue(new ConflictException('Unable to link this account.')) } as never, {} as never, config);
    const response = { cookie: vi.fn(), clearCookie: vi.fn(), redirect: vi.fn() };
    await controller.callback({ user: { googleId: 'google-id', email: admin.email, displayName: 'Admin' }, oauthRedirect: 'http://localhost:5173/login' } as never, response as never);
    expect(response.cookie).not.toHaveBeenCalled();
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/login?source=oauth#login');
  });
  it('sets a readable separate CSRF cookie for double submit', () => {
    const controller = new AuthController({} as never, {} as never, config);
    const response = { cookie: vi.fn() };
    const result = controller.csrf(response as never);
    expect(response.cookie).toHaveBeenCalledWith('csrf_token', expect.any(String), { secure: true, sameSite: 'lax', httpOnly: false, path: '/' });
    expect(result.data.csrfToken).toEqual(expect.any(String));
  });
});
