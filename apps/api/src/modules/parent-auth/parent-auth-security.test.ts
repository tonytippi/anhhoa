import { describe, expect, it, vi } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import { ParentGoogleStrategy } from './parent-google.strategy.js';
import { ParentSessionGuard } from './parent-session.guard.js';
import { ParentsService } from '../parents/parents.service.js';
import { ParentGoogleGuard } from './parent-google.guard.js';

function context(request: object) { return { switchToHttp: () => ({ getRequest: () => request }) }; }
const config = { googleClientId: 'client', googleClientSecret: 'secret', parentGoogleCallbackUrl: 'http://localhost:3000/parent/auth/google/callback', parentSessionCookieName: 'parent_session' } as never;

describe('Parent authentication security', () => {
  it('rejects empty subjects and malformed verified emails before binding', () => {
    const strategy = new ParentGoogleStrategy(config);
    expect(() => strategy.validate('', '', { id: ' ', emails: [{ value: 'parent@example.com', verified: true }] })).toThrow(UnauthorizedException);
    expect(() => strategy.validate('', '', { id: 'subject', emails: [{ value: 'not-an-email', verified: true }] })).toThrow(UnauthorizedException);
    expect(strategy.validate('', '', { id: ' subject ', emails: [{ value: ' Parent@Example.COM ', verified: true }] })).toMatchObject({ subject: 'subject', email: 'parent@example.com' });
  });
  it('rejects Parent sessions when the current Parent has no active link', async () => {
    const guard = new ParentSessionGuard({ verifyAsync: vi.fn().mockResolvedValue({ sub: 'parent-id', kind: 'parent' }) } as never, { activeParent: vi.fn().mockResolvedValue(null) } as never, config);
    await expect(guard.canActivate(context({ cookies: { parent_session: 'token' } }) as never)).rejects.toThrow('Authentication is required.');
  });
  it('rejects a changed Google subject without changing Parent lifecycle', async () => {
    const prisma = { $transaction: async (action: (tx: any) => unknown) => action({ parent: { findFirst: vi.fn().mockResolvedValue({ id: 'parent-id', googleSubject: 'original-subject' }) } }) };
    const service = new ParentsService(prisma as never);
    await expect(service.bindGoogleSubject('parent@example.com', 'changed-subject')).rejects.toThrow('Parent is not authorized.');
  });
  it('sets the state cookie on the real Parent start and callback route prefix', () => {
    const guard = new ParentGoogleGuard({ googleClientId: 'client', googleClientSecret: 'secret', parentGoogleCallbackUrl: 'http://localhost:3000/parent/auth/google/callback', parentSessionCookieName: 'parent_session', parentOauthRedirectUrls: ['http://localhost:5174'], parentOauthStateCookieName: 'parent_oauth_state' } as never);
    const response = { cookie: vi.fn() };
    guard.getAuthenticateOptions({ switchToHttp: () => ({ getRequest: () => ({ path: '/parent/auth/google', query: {} }), getResponse: () => response }) } as never);
    expect(response.cookie).toHaveBeenCalledWith('parent_oauth_state', expect.any(String), expect.objectContaining({ path: '/parent/auth/google' }));
  });
});
