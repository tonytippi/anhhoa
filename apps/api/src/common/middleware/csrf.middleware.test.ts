import { describe, expect, it, vi } from 'vitest';
import { CsrfMiddleware } from './csrf.middleware.js';

const middleware = new CsrfMiddleware({ webOrigin: 'http://localhost:5173', csrfCookieName: 'csrf_token', parentWebOrigin: 'http://localhost:5174', parentSessionCookieName: 'parent_session', parentCsrfCookieName: 'parent_csrf_token' } as never);
describe('CsrfMiddleware', () => {
  it('allows safe requests and rejects credentialed mutations before handlers for bad origin or token', () => {
    const next = () => undefined;
    expect(() => middleware.use({ method: 'GET', cookies: { session: 'session' } } as never, {} as never, next)).not.toThrow();
    expect(() => middleware.use({ method: 'POST', cookies: { session: 'session', csrf_token: 'one' }, get: (name: string) => name === 'origin' ? 'http://evil.test' : 'one' } as never, {} as never, next)).toThrow('Invalid request origin or CSRF token.');
    expect(() => middleware.use({ method: 'POST', cookies: { session: 'session', csrf_token: 'one' }, get: (name: string) => name === 'origin' ? 'http://localhost:5173' : 'two' } as never, {} as never, next)).toThrow('Invalid request origin or CSRF token.');
  });
  it('allows credentialed mutations with exact origin and matching double-submit token', () => {
    const next = vi.fn();
    middleware.use({ method: 'POST', cookies: { session: 'session', csrf_token: 'one' }, get: (name: string) => name === 'origin' ? 'http://localhost:5173' : 'one' } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('selects the CSRF policy by API surface when both browser sessions exist', () => {
    const cookies = { session: 'admin', csrf_token: 'admin-token', parent_session: 'parent', parent_csrf_token: 'parent-token' };
    const next = vi.fn();
    middleware.use({ method: 'POST', path: '/parent/auth/logout', cookies, get: (name: string) => name === 'origin' ? 'http://localhost:5174' : 'parent-token' } as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(() => middleware.use({ method: 'POST', path: '/parent/auth/logout', cookies, get: (name: string) => name === 'origin' ? 'http://localhost:5173' : 'admin-token' } as never, {} as never, vi.fn())).toThrow('Invalid request origin or CSRF token.');
    expect(() => middleware.use({ method: 'POST', path: '/students', cookies, get: (name: string) => name === 'origin' ? 'http://localhost:5174' : 'parent-token' } as never, {} as never, vi.fn())).toThrow('Invalid request origin or CSRF token.');
  });
});
