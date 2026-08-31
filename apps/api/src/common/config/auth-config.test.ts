import { describe, expect, it } from 'vitest';
import { loadAuthConfig, normalizeEmail, parseDurationMilliseconds } from './auth-config.js';

const validEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/anhhoa', WEB_ORIGIN: 'http://localhost:5173', GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback', OAUTH_REDIRECT_URLS: 'http://localhost:5173,http://localhost:5173/login', OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5173/login',
  JWT_SECRET: 'a-very-long-secret-that-is-at-least-32-characters', ADMIN_EMAILS: 'Admin@example.com,other@example.com',
  PARENT_WEB_ORIGIN: 'http://localhost:5174', PARENT_GOOGLE_CALLBACK_URL: 'http://localhost:3000/parent/auth/google/callback', PARENT_OAUTH_REDIRECT_URLS: 'http://localhost:5174,http://localhost:5174/login', PARENT_OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5174/login', PARENT_SESSION_COOKIE_NAME: 'parent_session',
};

describe('auth config', () => {
  it('normalizes and validates the allowlist', () => {
    const config = loadAuthConfig(validEnv);
    expect(normalizeEmail(' Admin@EXAMPLE.com ')).toBe('admin@example.com');
    expect(config.adminEmails.has('admin@example.com')).toBe(true);
    expect(config.oauthRedirectUrls).toEqual(['http://localhost:5173', 'http://localhost:5173/login']);
    expect(config.parentSessionCookieName).toBe('parent_session');
    expect(config.sessionCookieMaxAge).toBe(86_400_000);
  });
  it('enables only current, owned, tested deep-link configurations', () => {
    const bankConfig = { version: 1, expiresAt: '2030-01-01T00:00:00.000Z', revalidateAt: '2029-12-01T00:00:00.000Z', owner: 'payment-platform', cadence: 'monthly', banks: [{ bankCode: 'VCB', template: 'mybank://transfer?account={accountNumber}&amount={total}', support: { tested: true, matrix: [{ platform: 'all', browser: 'all', testedAt: '2026-08-01T00:00:00.000Z' }] } }] };
    expect(loadAuthConfig({ ...validEnv, BANK_DEEP_LINK_CONFIG: JSON.stringify(bankConfig) }).bankDeepLinks.get('VCB')).toEqual({ template: bankConfig.banks[0]!.template });
  });
  it.each([undefined, ' ', '{}', '{not-json}', JSON.stringify({ version: 1, expiresAt: '2020-01-01T00:00:00.000Z', revalidateAt: '2020-01-01T00:00:00.000Z', owner: 'owner', cadence: 'monthly', banks: [] }), JSON.stringify({ version: 1, expiresAt: '2030-01-01T00:00:00.000Z', revalidateAt: '2031-01-01T00:00:00.000Z', owner: 'owner', cadence: 'monthly', banks: [] }), JSON.stringify({ version: 1, expiresAt: '2030-01-01T00:00:00.000Z', revalidateAt: '2029-01-01T00:00:00.000Z', owner: 'owner', cadence: 'monthly', banks: [{ bankCode: 'VCB', template: 'javascript:alert(1)?amount={total}', support: { tested: true, matrix: [{ platform: 'all', browser: 'all', testedAt: '2026-08-01T00:00:00.000Z' }] } }] })])('fails closed for absent, invalid, unsafe, or expired deep-link configuration', (BANK_DEEP_LINK_CONFIG) => {
    expect(loadAuthConfig({ ...validEnv, BANK_DEEP_LINK_CONFIG }).bankDeepLinks.size).toBe(0);
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
  it.each([
    ['1s', 1_000],
    ['8h', 28_800_000],
    ['24h', 86_400_000],
    ['2d', 172_800_000],
  ])('converts a valid JWT lifetime to cookie milliseconds', (input, expected) => {
    expect(parseDurationMilliseconds(input)).toBe(expected);
  });
  it.each(['0s', '1ms', '1500ms', '10000000000000000000y'])('rejects a non-positive, partial-second, or unsafe cookie lifetime', (input) => {
    expect(() => parseDurationMilliseconds(input)).toThrow(/JWT_EXPIRES_IN must be (?:a positive|a whole-second) duration/);
  });
  it('rejects malformed JWT lifetimes', () => {
    expect(() => parseDurationMilliseconds('1.5h')).toThrow('JWT_EXPIRES_IN must be a positive duration');
  });
  it.each([{ ...validEnv, PARENT_WEB_ORIGIN: '' }, { ...validEnv, PARENT_OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5174/nope' }, { ...validEnv, PARENT_SESSION_COOKIE_NAME: 'session' }, { ...validEnv, PARENT_WEB_ORIGIN: 'https://parent.example.com', PARENT_GOOGLE_CALLBACK_URL: 'http://api.example.com/parent/auth/google/callback' }])('fails fast for unsafe Parent topology and cookie configuration', (env) => {
    expect(() => loadAuthConfig(env)).toThrow();
  });
});
