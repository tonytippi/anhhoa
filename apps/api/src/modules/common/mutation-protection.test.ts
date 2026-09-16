import { describe, expect, it } from 'vitest';
import { assertCookieMutation, requestFingerprint } from './mutation-protection.js';

describe('mutation protection', () => {
  const origin = 'https://app.example.test';
  const valid = { headers: { origin, cookie: 'app_csrf=csrf-token; other=value', 'x-csrf-token': 'csrf-token' } };

  it('accepts exact origin and matching double-submit CSRF, returning the supplied idempotency key', () => {
    expect(assertCookieMutation(valid, origin, 'app_csrf', 'operation-key')).toBe('operation-key');
  });

  it('rejects missing origin, missing CSRF, and mismatched CSRF', () => {
    expect(() => assertCookieMutation({ headers: { cookie: 'app_csrf=csrf-token', 'x-csrf-token': 'csrf-token' } }, origin, 'app_csrf')).toThrow('CSRF không hợp lệ.');
    expect(() => assertCookieMutation({ headers: { origin, cookie: 'app_csrf=csrf-token' } }, origin, 'app_csrf')).toThrow('CSRF không hợp lệ.');
    expect(() => assertCookieMutation({ headers: { origin, cookie: 'app_csrf=csrf-token', 'x-csrf-token': 'other' } }, origin, 'app_csrf')).toThrow('CSRF không hợp lệ.');
  });

  it('fingerprints recursively canonical JSON without changing array ordering', () => {
    expect(requestFingerprint({ z: [{ b: 2, a: 1 }], a: { y: true, x: null } })).toBe(requestFingerprint({ a: { x: null, y: true }, z: [{ a: 1, b: 2 }] }));
    expect(requestFingerprint({ roles: ['SCHOOL_ADMIN', 'CLASS_TEACHER'] })).not.toBe(requestFingerprint({ roles: ['CLASS_TEACHER', 'SCHOOL_ADMIN'] }));
  });
});
