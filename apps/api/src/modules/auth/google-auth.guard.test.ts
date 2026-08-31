import { describe, expect, it, vi } from 'vitest';
import { GoogleAuthGuard } from './google-auth.guard.js';
import { GoogleAllowlistDeniedException } from './google.strategy.js';

const config = { oauthRedirectUrls: ['http://localhost:5173', 'http://localhost:5173/login'], oauthDeniedRedirectUrl: 'http://localhost:5173/login?source=oauth#login', oauthStateCookieName: 'oauth_state' } as never;
function context(request: object, response: object) { return { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }) }; }

describe('GoogleAuthGuard', () => {
  it('issues signed state and stores it in a secure browser-bound cookie while preserving an allowlisted redirect', () => {
    const jwt = { sign: vi.fn().mockReturnValue('signed-state') };
    const guard = new GoogleAuthGuard(jwt as never, config);
    const response = { cookie: vi.fn() };
    const options = guard.getAuthenticateOptions(context({ path: '/auth/google', query: { redirect: 'http://localhost:5173/login' } }, response) as never);
    expect(jwt.sign).toHaveBeenCalledWith(expect.objectContaining({ redirect: 'http://localhost:5173/login', nonce: expect.any(String) }), { expiresIn: '10m' });
    expect(response.cookie).toHaveBeenCalledWith('oauth_state', 'signed-state', { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google', maxAge: 600000 });
    expect(options).toEqual({ session: false, state: 'signed-state' });
  });
  it('rejects a callback without a matching state before a session can be created', async () => {
    const guard = new GoogleAuthGuard({ verifyAsync: vi.fn() } as never, config);
    const response = { clearCookie: vi.fn(), redirect: vi.fn() };
    await expect(guard.canActivate(context({ path: '/auth/google/callback', query: { state: 'attacker' }, cookies: { oauth_state: 'browser-state' } }, response) as never)).resolves.toBe(false);
    expect(response.clearCookie).toHaveBeenCalledWith('oauth_state', { secure: true, httpOnly: true, sameSite: 'lax', path: '/auth/google' });
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/login?source=oauth&reason=oauth_state_invalid#login');
  });
  it('adds the denied signal only when GoogleStrategy rejects an unallowlisted profile', async () => {
    const guard = new GoogleAuthGuard({} as never, config);
    const response = { clearCookie: vi.fn(), redirect: vi.fn() };
    await expect((guard as unknown as { deny: (value: typeof response, reason: 'denied') => false }).deny(response, 'denied')).toBe(false);
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/login?source=oauth&reason=denied#login');
    expect(new GoogleAllowlistDeniedException()).toBeInstanceOf(Error);
  });
  it('accepts matching, unexpired signed state and restores only its allowlisted redirect', async () => {
    const guard = new GoogleAuthGuard({ verifyAsync: vi.fn().mockResolvedValue({ redirect: 'http://localhost:5173/login', nonce: 'nonce' }) } as never, config);
    const request = { path: '/auth/google/callback', query: { state: 'valid' }, cookies: { oauth_state: 'valid' } };
    const response = { clearCookie: vi.fn(), redirect: vi.fn() };
    await expect(guard.canActivate(context(request, response) as never)).resolves.toBe(false);
    expect(request).toMatchObject({ oauthRedirect: 'http://localhost:5173/login' });
  });
  it('uses a public state-invalid reason when signed state has expired', async () => {
    const guard = new GoogleAuthGuard({ verifyAsync: vi.fn().mockRejectedValue(new Error('jwt expired')) } as never, config);
    const response = { clearCookie: vi.fn(), redirect: vi.fn() };
    await expect(guard.canActivate(context({ path: '/auth/google/callback', query: { state: 'expired' }, cookies: { oauth_state: 'expired' } }, response) as never)).resolves.toBe(false);
    expect(response.redirect).toHaveBeenCalledWith('http://localhost:5173/login?source=oauth&reason=oauth_state_invalid#login');
  });
});
