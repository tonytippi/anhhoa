import { describe, expect, it, vi } from 'vitest';
import { CsrfMiddleware } from './csrf.middleware.js';

const middleware = new CsrfMiddleware({ webOrigin: 'http://localhost:5173', csrfCookieName: 'csrf_token' } as never);
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
});
