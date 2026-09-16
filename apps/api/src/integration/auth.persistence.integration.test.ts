import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { AuthService } from '../modules/auth/auth.service.js';
import { PrismaService } from '../modules/identity/prisma.service.js';

const prisma = new PrismaService();
const service = new AuthService(prisma);
const transactionIds: string[] = [];
const emailPrefix = `auth-integration-${crypto.randomUUID()}`;
const emails: string[] = [];

function idToken(nonce: string, subject: string, email: string, overrides = {}): string {
  return Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com',
    sub: subject,
    email,
    email_verified: true,
    aud: 'test-client-id',
    nonce,
    exp: Math.ceil(Date.now() / 1000) + 600,
    ...overrides,
  })).toString('base64url');
}

async function begin(audience: 'app' | 'ops' = 'app') {
  const started = await service.start(audience);
  const url = new URL(started.authorizationUrl);
  const state = url.searchParams.get('state');
  const nonce = url.searchParams.get('nonce');
  if (!state || !nonce) throw new Error('OAuth start did not return state and nonce.');
  const transaction = await prisma.oAuthTransaction.findUniqueOrThrow({
    where: { stateHash: (await import('node:crypto')).createHash('sha256').update(state).digest('base64url') },
  });
  transactionIds.push(transaction.id);
  return { audience, started, state, nonce, transaction };
}

afterEach(async () => {
  if (transactionIds.length) await prisma.oAuthTransaction.deleteMany({ where: { id: { in: transactionIds.splice(0) } } });
  if (emails.length) {
    const identities = await prisma.userIdentity.findMany({ where: { emailNormalized: { in: emails } }, select: { id: true } });
    await prisma.platformOperatorGrant.deleteMany({ where: { userIdentityId: { in: identities.map((identity) => identity.id) } } });
    await prisma.userIdentity.deleteMany({ where: { emailNormalized: { in: emails.splice(0) } } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)('auth PostgreSQL persistence', () => {
  it('persists OAuth state durably, rejects expiry, and atomically consumes a state once', async () => {
    const expired = await begin();
    await prisma.oAuthTransaction.update({ where: { id: expired.transaction.id }, data: { expiresAt: new Date(Date.now() - 1) } });
    const expiredEmail = `${emailPrefix}-expired@example.com`;
    emails.push(expiredEmail);
    await expect(service.callback('app', expired.state, expired.started.correlation, idToken(expired.nonce, 'google-expired', expiredEmail))).rejects.toThrow('OAuth state');
    await expect(prisma.oAuthTransaction.findUniqueOrThrow({ where: { id: expired.transaction.id } })).resolves.toMatchObject({ consumedAt: null });

    const active = await begin();
    const activeEmail = `${emailPrefix}-consume@example.com`;
    emails.push(activeEmail);
    const code = idToken(active.nonce, 'google-consume', activeEmail);
    const callbacks = await Promise.allSettled([
      service.callback('app', active.state, active.started.correlation, code),
      service.callback('app', active.state, active.started.correlation, code),
    ]);
    expect(callbacks.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(callbacks.filter((result) => result.status === 'rejected')).toHaveLength(1);
    await expect(prisma.oAuthTransaction.findUniqueOrThrow({ where: { id: active.transaction.id } })).resolves.toMatchObject({ consumedAt: expect.any(Date) });
  });

  it('leaves a verified transaction available after Google verification fails, then permits retry', async () => {
    const attempt = await begin();
    const email = `${emailPrefix}-retry@example.com`;
    emails.push(email);

    await expect(service.callback('app', attempt.state, attempt.started.correlation, idToken('wrong-nonce', 'google-retry', email))).rejects.toThrow('OIDC claims');
    await expect(prisma.oAuthTransaction.findUniqueOrThrow({ where: { id: attempt.transaction.id } })).resolves.toMatchObject({ consumedAt: null });

    const result = await service.callback('app', attempt.state, attempt.started.correlation, idToken(attempt.nonce, 'google-retry', email));
    expect(service.session('app', result.cookie)).toMatchObject({ email });
    await expect(prisma.oAuthTransaction.findUniqueOrThrow({ where: { id: attempt.transaction.id } })).resolves.toMatchObject({ consumedAt: expect.any(Date) });
  });

  it('concurrently binds one canonical Google UserIdentity and rejects replay after consume', async () => {
    const previousSuperadmin = process.env.SUPERADMIN_EMAIL;
    const email = `${emailPrefix}-canonical@example.com`;
    process.env.SUPERADMIN_EMAIL = email;
    const app = await begin('app');
    const ops = await begin('ops');
    emails.push(email);
    const subject = `google-canonical-${crypto.randomUUID()}`;
    const [appResult, opsResult] = await Promise.all([
      service.callback('app', app.state, app.started.correlation, idToken(app.nonce, subject, email)),
      service.callback('ops', ops.state, ops.started.correlation, idToken(ops.nonce, subject, email)),
    ]);

    const appSession = service.session('app', appResult.cookie);
    const opsSession = service.session('ops', opsResult.cookie);
    expect(appSession.userIdentityId).toBe(opsSession.userIdentityId);
    await expect(prisma.userIdentity.count({ where: { googleSubject: subject } })).resolves.toBe(1);
    await expect(service.callback('app', app.state, app.started.correlation, idToken(app.nonce, subject, email))).rejects.toThrow('OAuth state');
    if (previousSuperadmin === undefined) delete process.env.SUPERADMIN_EMAIL;
    else process.env.SUPERADMIN_EMAIL = previousSuperadmin;
  });

  it('keeps the first Google subject bound when distinct subjects race for one email', async () => {
    const app = await begin('app'); const ops = await begin('ops'); const email = `${emailPrefix}-subject-race@example.com`;
    emails.push(email);
    const results = await Promise.allSettled([
      service.callback('app', app.state, app.started.correlation, idToken(app.nonce, `google-first-${crypto.randomUUID()}`, email)),
      service.callback('ops', ops.state, ops.started.correlation, idToken(ops.nonce, `google-second-${crypto.randomUUID()}`, email)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const identity = await prisma.userIdentity.findUniqueOrThrow({ where: { emailNormalized: email } });
    expect(identity.googleSubject).toBeDefined();
    await expect(prisma.userIdentity.count({ where: { emailNormalized: email } })).resolves.toBe(1);
  });
});
