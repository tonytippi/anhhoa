import { describe, expect, it } from 'vitest';
import { loadAuthConfig, normalizeEmail } from './auth-config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/anhhoa', WEB_ORIGIN: 'http://localhost:5173', GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret',
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
  it.each([
    { ...validEnv, WEB_ORIGIN: 'https://admin.anhhoa.vn', GOOGLE_CALLBACK_URL: 'https://api.anhhoa.vn/auth/google/callback' },
    { ...validEnv, WEB_ORIGIN: 'https://admin.example.co.uk:5173', GOOGLE_CALLBACK_URL: 'https://api.example.co.uk:3000/auth/google/callback' },
    { ...validEnv, WEB_ORIGIN: 'http://127.0.0.1:5173', GOOGLE_CALLBACK_URL: 'http://127.0.0.1:3000/auth/google/callback' },
    { ...validEnv, WEB_ORIGIN: 'http://devbox:5173', GOOGLE_CALLBACK_URL: 'http://devbox:3000/auth/google/callback' },
  ])('accepts cross-origin deployments on the same schemeful site', (env) => {
    expect(() => loadAuthConfig(env)).not.toThrow();
  });
  it.each([
    { ...validEnv, WEB_ORIGIN: 'https://admin.anhhoa.vn', GOOGLE_CALLBACK_URL: 'https://api.example.net/auth/google/callback' },
    { ...validEnv, WEB_ORIGIN: 'http://admin.anhhoa.vn', GOOGLE_CALLBACK_URL: 'https://api.anhhoa.vn/auth/google/callback' },
    { ...validEnv, WEB_ORIGIN: 'https://admin.foo.co.uk', GOOGLE_CALLBACK_URL: 'https://api.bar.co.uk/auth/google/callback' },
  ])('rejects cross-site auth deployment topology', (env) => {
    expect(() => loadAuthConfig(env)).toThrow('WEB_ORIGIN and GOOGLE_CALLBACK_URL must use the same schemeful site');
  });
  it.each([{ ...validEnv, DATABASE_URL: '' }, { ...validEnv, DATABASE_URL: 'mysql://localhost/anhhoa' }, { ...validEnv, ADMIN_EMAILS: '' }, { ...validEnv, JWT_SECRET: 'short' }, { ...validEnv, WEB_ORIGIN: 'not-a-url' }])('fails fast for invalid auth configuration', (env) => {
    expect(() => loadAuthConfig(env)).toThrow();
  });
  it.each([{ ...validEnv, WEB_ORIGIN: 'http://localhost:5173/path' }, { ...validEnv, JWT_EXPIRES_IN: 'later' }, { ...validEnv, CSRF_COOKIE_NAME: 'session' }])('rejects invalid origin, lifetime, and CSRF cookie settings', (env) => {
    expect(() => loadAuthConfig(env)).toThrow();
  });
});
