import { describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth.service.js';
import { authSecrets } from './auth.config.js';

const google = (nonce: string, overrides = {}) => Buffer.from(JSON.stringify({ iss: 'https://accounts.google.com', sub: 'google-123', email: 'admin@example.com', email_verified: true, aud: 'test-client-id', nonce, exp: Math.ceil(Date.now() / 1000) + 600, ...overrides })).toString('base64url');
const database = () => {
  const transaction = { id: 'transaction-id', audience: 'app', correlationHash: '', nonce: '', redirect: 'http://localhost:5173', expiresAt: new Date(Date.now() + 60000), consumedAt: null };
  const oAuthTransaction = { create: vi.fn(async ({ data }) => { Object.assign(transaction, data); return transaction; }), findUnique: vi.fn(async () => transaction), updateMany: vi.fn(async () => ({ count: 1 })) };
  const userIdentity = { findUnique: vi.fn().mockResolvedValue(null), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'identity-id', emailNormalized: 'admin@example.com', googleSubject: 'google-123' }), create: vi.fn().mockResolvedValue({ id: 'identity-id', emailNormalized: 'admin@example.com', googleSubject: 'google-123' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  const platformOperatorGrant = { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() };
  return { oAuthTransaction, userIdentity, platformOperatorGrant, $transaction: vi.fn(async (work) => work({ oAuthTransaction, userIdentity })) };
};

describe('AuthService', () => {
  it('fails strict production startup when the session secret is missing', () => {
    const previous = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    expect(() => authSecrets(true)).toThrow('OAuth and session secrets must be configured');
    if (previous === undefined) delete process.env.SESSION_SECRET; else process.env.SESSION_SECRET = previous;
  });

  it('binds a verified identity after durable correlation and isolates its audience', async () => {
    const prisma = database(); const service = new AuthService(prisma as never); const start = await service.start('app'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    const result = await service.callback('app', state, start.correlation, google(nonce));
    expect(prisma.oAuthTransaction.create).toHaveBeenCalled(); expect(prisma.userIdentity.create).toHaveBeenCalled(); expect(service.session('app', result.cookie)).toEqual({ userIdentityId: 'identity-id', email: 'admin@example.com' }); expect(() => service.session('ops', result.cookie)).toThrow('Session không thuộc audience');
  });
  it('rejects missing correlation, nonce mismatch, and Parent issuance', async () => {
    const prisma = database(); const service = new AuthService(prisma as never); const start = await service.start('app'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    await expect(service.callback('app', state, undefined, google(nonce))).rejects.toThrow('OAuth state'); await expect(service.callback('app', state, start.correlation, google('wrong'))).rejects.toThrow('OIDC claims');
    const parent = await service.start('parent'); const parentState = new URL(parent.authorizationUrl).searchParams.get('state')!; const parentNonce = new URL(parent.authorizationUrl).searchParams.get('nonce')!; const parentCreate = prisma.oAuthTransaction.create.mock.calls[1]; if (!parentCreate) throw new Error('missing parent transaction'); prisma.oAuthTransaction.findUnique.mockResolvedValueOnce({ id: 'parent', audience: 'parent', correlationHash: parentCreate[0].data.correlationHash, nonce: parentNonce, redirect: 'http://localhost:5174', expiresAt: new Date(Date.now() + 60000), consumedAt: null }); await expect(service.callback('parent', parentState, parent.correlation, google(parentNonce))).resolves.toEqual({ redirect: 'http://localhost:5174' }); expect(prisma.userIdentity.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an unallowlisted callback redirect and invalid test OIDC claims', async () => {
    const prisma = database(); const service = new AuthService(prisma as never);
    await expect(service.start('app', 'https://attacker.example/callback')).rejects.toThrow('Redirect không hợp lệ');
    const start = await service.start('app'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    await expect(service.callback('app', state, start.correlation, google(nonce, { iss: 'https://attacker.example' }))).rejects.toThrow('OIDC claims');
    await expect(service.callback('app', state, start.correlation, google(nonce, { exp: Math.floor(Date.now() / 1000) - 1 }))).rejects.toThrow('OIDC claims');
    await expect(service.callback('app', state, start.correlation, google(nonce, { email_verified: 'false' }))).rejects.toThrow('Google identity chưa được xác minh');
  });

  it('consumes state only after Google verification and rejects a concurrent replay', async () => {
    const prisma = database(); const service = new AuthService(prisma as never); const start = await service.start('app'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    let consumed = false;
    prisma.oAuthTransaction.updateMany.mockImplementation(async () => ({ count: consumed ? 0 : (consumed = true, 1) }));
    await expect(service.callback('app', state, start.correlation, google('wrong'))).rejects.toThrow('OIDC claims');
    expect(consumed).toBe(false);
    await expect(service.callback('app', state, start.correlation, google(nonce))).resolves.toMatchObject({ cookie: expect.any(String) });
    await expect(service.callback('app', state, start.correlation, google(nonce))).rejects.toThrow('OAuth state đã được dùng');
  });

  it('treats malformed signed session payloads as authentication failures', () => {
    const service = new AuthService(database() as never);
    const malformed = Buffer.from('{').toString('base64url');
    const signature = (service as unknown as { sign(value: string): string }).sign(malformed);
    expect(() => service.session('app', `${malformed}.${signature}`)).toThrow('Cần đăng nhập');
  });
  it('denies Ops cookie issuance unless the normalized superadmin identity receives the grant', async () => {
    const prior = process.env.SUPERADMIN_EMAIL; process.env.SUPERADMIN_EMAIL = 'operator@example.com'; const prisma = database(); const service = new AuthService(prisma as never); const start = await service.start('ops'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    await expect(service.callback('ops', state, start.correlation, google(nonce))).resolves.toEqual({ redirect: 'http://localhost:5176' }); expect(prisma.platformOperatorGrant.upsert).not.toHaveBeenCalled();
    if (prior === undefined) delete process.env.SUPERADMIN_EMAIL; else process.env.SUPERADMIN_EMAIL = prior;
  });
  it('does not issue an Ops cookie or reactivate a revoked bootstrap grant', async () => {
    const prior = process.env.SUPERADMIN_EMAIL; process.env.SUPERADMIN_EMAIL = 'admin@example.com'; const prisma = database(); prisma.platformOperatorGrant.findUnique.mockResolvedValue({ revokedAt: new Date() }); const service = new AuthService(prisma as never); const start = await service.start('ops'); const state = new URL(start.authorizationUrl).searchParams.get('state')!; const nonce = new URL(start.authorizationUrl).searchParams.get('nonce')!;
    await expect(service.callback('ops', state, start.correlation, google(nonce))).resolves.toEqual({ redirect: 'http://localhost:5176' }); expect(prisma.platformOperatorGrant.upsert).not.toHaveBeenCalled();
    if (prior === undefined) delete process.env.SUPERADMIN_EMAIL; else process.env.SUPERADMIN_EMAIL = prior;
  });
});
