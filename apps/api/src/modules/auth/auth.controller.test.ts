import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApi } from '../../main.js';
import { AuthService } from './auth.service.js';

const audiences = [
  ['app', 'http://localhost:5173'],
  ['teacher', 'http://localhost:5175'],
  ['parent', 'http://localhost:5174'],
  ['ops', 'http://localhost:5176'],
] as const;

afterEach(() => vi.restoreAllMocks());

describe('AuthController', () => {
  it('returns the global error envelope before protected data when a cross-audience cookie is supplied', async () => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    const token = app.get(AuthService).issueSession('app', 'identity-id', 'admin@example.com');
    const response = await fetch(`http://127.0.0.1:${port}/api/ops/auth/session`, { headers: { cookie: `ops_session=${token}` } });
    await app.close();
    expect(response.status).toBe(401); await expect(response.json()).resolves.toEqual({ error: { code: 'INVALID_AUDIENCE', message: 'Session không thuộc audience này.' } });
  });

  it.each(audiences)('matches credentialed CORS only to the %s request audience', async (audience, origin) => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    const allowed = await fetch(`http://127.0.0.1:${port}/api/${audience}/auth/session`, { headers: { origin } });
    const otherOrigin = audiences.find(([, candidate]) => candidate !== origin)![1];
    const denied = await fetch(`http://127.0.0.1:${port}/api/${audience}/auth/session`, { headers: { origin: otherOrigin } });
    await app.close();
    expect(allowed.headers.get('access-control-allow-origin')).toBe(origin);
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true');
    expect(denied.headers.get('access-control-allow-origin')).toBeNull();
    expect(denied.headers.get('access-control-allow-credentials')).toBeNull();
  });

  it.each(audiences.filter(([audience]) => audience !== 'parent'))('issues only the %s audience cookies at callback', async (audience) => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    vi.spyOn(app.get(AuthService), 'callback').mockResolvedValue({ redirect: 'http://localhost:5173', cookie: 'session-token', csrf: 'csrf-token' });
    const response = await fetch(`http://127.0.0.1:${port}/api/${audience}/auth/google/callback?state=state&code=code`, { redirect: 'manual' });
    await app.close(); const cookie = response.headers.get('set-cookie')!;
    expect(response.status).toBe(302); expect(cookie).toContain(`${audience}_session=session-token`); expect(cookie).toContain(`${audience}_csrf=csrf-token`); expect(cookie).not.toContain('Domain=');
  });

  it('redirects a denied Parent callback without issuing a cookie', async () => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    vi.spyOn(app.get(AuthService), 'callback').mockResolvedValue({ redirect: 'http://localhost:5174' });
    const response = await fetch(`http://127.0.0.1:${port}/api/parent/auth/google/callback?state=state&code=code`, { redirect: 'manual' });
    await app.close();
    expect(response.status).toBe(302); expect(response.headers.get('location')).toBe('http://localhost:5174'); expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('clears only the selected host-only audience cookie on logout', async () => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    const response = await fetch(`http://127.0.0.1:${port}/api/app/auth/logout`, { method: 'POST', headers: { origin: 'http://localhost:5173', 'x-csrf-token': 'csrf-value', cookie: 'app_csrf=csrf-value' } });
    await app.close(); const cookie = response.headers.get('set-cookie')!;
    expect(response.status).toBe(204); expect(cookie).toContain('app_session='); expect(cookie).toContain('app_csrf='); expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie).toContain('SameSite=Lax'); expect(cookie).not.toContain('Domain='); expect(cookie).not.toContain('ops_session=');
  });

  it('rejects logout when either origin or double-submit CSRF proof is missing', async () => {
    const app = await createApi(); await app.listen(0); const port = app.getHttpServer().address().port;
    const missingOrigin = await fetch(`http://127.0.0.1:${port}/api/app/auth/logout`, { method: 'POST', headers: { 'x-csrf-token': 'csrf-value', cookie: 'app_csrf=csrf-value' } });
    const mismatchedCsrf = await fetch(`http://127.0.0.1:${port}/api/app/auth/logout`, { method: 'POST', headers: { origin: 'http://localhost:5173', 'x-csrf-token': 'wrong', cookie: 'app_csrf=csrf-value' } });
    await app.close();
    expect(missingOrigin.status).toBe(401); expect(mismatchedCsrf.status).toBe(401);
  });
});
