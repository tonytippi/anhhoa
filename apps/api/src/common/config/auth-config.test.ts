import { describe, expect, it } from 'vitest';
import { loadAuthConfig, normalizeEmail } from './auth-config.js';

const validEnv = {
  WEB_ORIGIN: 'http://localhost:5173', GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback', OAUTH_REDIRECT_URLS: 'http://localhost:5173,http://localhost:5173/login', OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5173/login',
  JWT_SECRET: 'a-very-long-secret-that-is-at-least-32-characters', ADMIN_EMAILS: 'Admin@example.com,other@example.com',
};

describe('auth config', () => {
  it('normalizes and validates the allowlist', () => {
    const config = loadAuthConfig(validEnv);
    expect(normalizeEmail(' Admin@EXAMPLE.com ')).toBe('admin@example.com');
    expect(config.adminEmails.has('admin@example.com')).toBe(true);
    expect(config.oauthRedirectUrls).toEqual(['http://localhost:5173', 'http://localhost:5173/login']);
  });
  it.each([{ ...validEnv, ADMIN_EMAILS: '' }, { ...validEnv, JWT_SECRET: 'short' }, { ...validEnv, WEB_ORIGIN: 'not-a-url' }])('fails fast for invalid auth configuration', (env) => {
    expect(() => loadAuthConfig(env)).toThrow();
  });
  it.each([{ ...validEnv, WEB_ORIGIN: 'http://localhost:5173/path' }, { ...validEnv, JWT_EXPIRES_IN: 'later' }, { ...validEnv, CSRF_COOKIE_NAME: 'session' }])('rejects invalid origin, lifetime, and CSRF cookie settings', (env) => {
    expect(() => loadAuthConfig(env)).toThrow();
  });
});
