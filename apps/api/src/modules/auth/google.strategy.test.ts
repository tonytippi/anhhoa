import { describe, expect, it } from 'vitest';
import { GoogleStrategy } from './google.strategy.js';

const config = { googleClientId: 'id', googleClientSecret: 'secret', googleCallbackUrl: 'http://localhost:3000/auth/google/callback', adminEmails: new Set(['admin@example.com']) } as never;
describe('GoogleStrategy', () => {
  it('allows normalized allowlisted profiles and rejects missing or non-allowlisted emails', () => {
    const strategy = new GoogleStrategy(config);
    expect(strategy.validate('', '', { id: 'google', emails: [{ value: 'Admin@Example.com', verified: true }], displayName: 'Admin' })).toMatchObject({ email: 'Admin@Example.com', googleId: 'google' });
    expect(() => strategy.validate('', '', { id: 'google' })).toThrow('This account is not authorized.');
    expect(() => strategy.validate('', '', { id: 'google', emails: [{ value: 'other@example.com' }] })).toThrow('This account is not authorized.');
    expect(() => strategy.validate('', '', { id: 'google', emails: [{ value: 'admin@example.com', verified: false }] })).toThrow('This account is not authorized.');
  });
});
