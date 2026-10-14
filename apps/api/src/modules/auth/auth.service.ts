import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import type { Audience } from './auth.config.js';
import { audienceConfig, authSecrets, superadminEmail } from './auth.config.js';
import { PrismaService } from '../identity/prisma.service.js';
import { ParentsService } from '../parents/parents.service.js';

type IdToken = { iss: string; aud: string | string[]; azp?: string; sub: string; email: string; email_verified: boolean | string; name?: string; picture?: string; nonce: string; exp: number };
// `auth` is the sign-in time that bounds sliding renewal; tokens issued before it existed simply expire at `exp`.
// `imp`/`by` mark a Platform Operator acting as `sub`; such a session never outlives `impersonationTtlMs` from its start.
type Session = { aud: Audience; sub: string; email: string; exp: number; auth?: number; imp?: string; by?: string };
export type SessionIdentity = { userIdentityId: string; email: string; impersonation?: { id: string; operatorEmail: string } };
type Impersonator = { imp: string; by: string };
type IssuedSession = { cookie: string; maxAge: number };
type Start = { authorizationUrl: string; correlation: string };
const issuer = 'https://accounts.google.com';
const jwksUrl = 'https://www.googleapis.com/oauth2/v3/certs';
const hash = (value: string) => createHash('sha256').update(value).digest('base64url');
const random = () => randomBytes(32).toString('base64url');
const refreshAfterMs = 60 * 60 * 1000;
export const impersonationTtlMs = 60 * 60 * 1000;
const impersonationTicketTtlMs = 60 * 1000;
const json = <T>(value: string): T => JSON.parse(Buffer.from(value, 'base64url').toString()) as T;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly parents?: ParentsService) {}
  private sign(value: string): string { return createHmac('sha256', authSecrets().sessionSecret).update(value).digest('base64url'); }
  private issue(payload: Session): string { const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${encoded}.${this.sign(encoded)}`; }

  async start(audience: Audience, requestedRedirect?: string, loginHint?: string, chooseAccount = false): Promise<Start> {
    const config = audienceConfig(audience);
    if (requestedRedirect && !config.redirects.includes(requestedRedirect)) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Redirect không hợp lệ.' });
    const redirect = requestedRedirect ?? config.redirects[0];
    if (!redirect) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Redirect không hợp lệ.' });
    const state = random(); const correlation = random(); const nonce = random(); const { stateTtlSeconds } = authSecrets();
    await this.prisma.oAuthTransaction.create({ data: { audience, stateHash: hash(state), correlationHash: hash(correlation), nonce, redirect, expiresAt: new Date(Date.now() + stateTtlSeconds * 1000) } });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? 'test-client-id'); url.searchParams.set('redirect_uri', config.callbackUrl); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', 'openid email profile'); url.searchParams.set('state', state); url.searchParams.set('nonce', nonce);
    // The hint only pre-selects the Google account; the verified ID token still decides the identity.
    const hint = loginHint?.trim().toLowerCase();
    if (hint && hint.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(hint)) url.searchParams.set('login_hint', hint);
    if (chooseAccount) url.searchParams.set('prompt', 'select_account');
    return { authorizationUrl: url.toString(), correlation };
  }

  async callback(audience: Audience, state: string, correlation: string | undefined, code: string): Promise<{ redirect: string; cookie?: string; csrf?: string; maxAge?: number }> {
    const transaction = await this.prisma.oAuthTransaction.findUnique({ where: { stateHash: hash(state) } });
    if (!transaction || transaction.audience !== audience || transaction.expiresAt < new Date() || transaction.consumedAt || !correlation || hash(correlation) !== transaction.correlationHash) throw new UnauthorizedException({ code: 'OAUTH_STATE_INVALID', message: 'OAuth state không hợp lệ hoặc đã hết hạn.' });
    const google = await this.googleIdentity(code, audience, transaction.nonce);
    if ((google.email_verified !== true && google.email_verified !== 'true') || !google.sub || !google.email) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Google identity chưa được xác minh.' });
    const emailNormalized = google.email.trim().toLowerCase();
    const consumeAndBind = () => this.prisma.$transaction(async (tx) => {
      const consumed = await tx.oAuthTransaction.updateMany({ where: { id: transaction.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new UnauthorizedException({ code: 'OAUTH_STATE_INVALID', message: 'OAuth state đã được dùng.' });
      const subject = await tx.userIdentity.findUnique({ where: { googleSubject: google.sub } }); const email = await tx.userIdentity.findUnique({ where: { emailNormalized } });
      if (subject && subject.emailNormalized !== emailNormalized) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Google subject không khớp email đã bind.' });
      if (email?.googleSubject && email.googleSubject !== google.sub) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Email đã được bind với Google subject khác.' });
      if (audience === 'parent') {
        if (!this.parents) throw new UnauthorizedException({ code: 'PARENT_ACCESS_DENIED', message: 'Không có liên kết phụ huynh đang hiệu lực.' });
        return this.parents.admit(tx, emailNormalized, google.sub);
      }
      if (subject) return subject;
      if (email) {
        // A conditional write makes the first subject binding immutable under concurrent callbacks.
        await tx.userIdentity.updateMany({ where: { id: email.id, googleSubject: null }, data: { googleSubject: google.sub } });
        const bound = await tx.userIdentity.findUniqueOrThrow({ where: { emailNormalized } });
        if (bound.googleSubject !== google.sub) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Email đã được bind với Google subject khác.' });
        return bound;
      }
      return tx.userIdentity.create({ data: { emailNormalized, googleSubject: google.sub } });
    });
    // PostgreSQL aborts an interactive transaction after a unique conflict. Re-run in a
    // fresh transaction so the canonical binding is re-read before deciding the outcome.
    let identity;
    try {
      identity = await consumeAndBind();
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      identity = await consumeAndBind();
    }
    await this.saveProfile(identity.id, google);
    if (audience === 'ops') {
      if (identity.emailNormalized !== superadminEmail()) return { redirect: audienceConfig(audience).deniedRedirect };
      const existingGrant = await this.prisma.platformOperatorGrant.findUnique({ where: { userIdentityId: identity.id }, select: { revokedAt: true } });
      if (existingGrant?.revokedAt) return { redirect: audienceConfig(audience).deniedRedirect };
      await this.prisma.platformOperatorGrant.upsert({ where: { userIdentityId: identity.id }, create: { userIdentityId: identity.id }, update: {} });
    }
    const csrf = random(); const session = this.newSession(audience, identity.id, identity.emailNormalized, Date.now()); return { redirect: transaction.redirect, cookie: session.cookie, maxAge: session.maxAge, csrf };
  }

  private async googleIdentity(code: string, audience: Audience, nonce: string): Promise<IdToken> {
    if (process.env.NODE_ENV === 'test') {
      try { return this.validateIdToken(json<IdToken>(code), nonce); } catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC token không hợp lệ.' }); }
    }
    const exchange = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: process.env.GOOGLE_CLIENT_ID ?? '', client_secret: process.env.GOOGLE_CLIENT_SECRET ?? '', redirect_uri: audienceConfig(audience).callbackUrl, grant_type: 'authorization_code' }) });
    if (!exchange.ok) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Google authorization code không hợp lệ.' }); const { id_token: idToken } = await exchange.json() as { id_token?: string }; if (!idToken) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Google không trả identity token.' });
    return this.verifyIdToken(idToken, nonce);
  }
  private async verifyIdToken(token: string, nonce: string): Promise<IdToken> {
    const [headerPart, payloadPart, signature] = token.split('.'); if (!headerPart || !payloadPart || !signature) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC token không hợp lệ.' });
    const header = json<{ alg: string; kid: string }>(headerPart); if (header.alg !== 'RS256' || !header.kid) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC algorithm không hợp lệ.' });
    const keys = await (await fetch(jwksUrl)).json() as { keys: Array<JsonWebKey & { kid?: string }> }; const key = keys.keys.find((candidate) => candidate.kid === header.kid); if (!key || !verify('RSA-SHA256', Buffer.from(`${headerPart}.${payloadPart}`), createPublicKey({ key: key as import('node:crypto').JsonWebKey, format: 'jwk' }), Buffer.from(signature, 'base64url'))) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC signature không hợp lệ.' });
    try { return this.validateIdToken(json<IdToken>(payloadPart), nonce); } catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC token không hợp lệ.' }); }
  }
  private validateIdToken(payload: IdToken, nonce: string): IdToken {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? 'test-client-id'; const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if ((payload.iss !== issuer && payload.iss !== 'accounts.google.com') || !audiences.includes(clientId) || (audiences.length > 1 && payload.azp !== clientId) || payload.nonce !== nonce || !Number.isFinite(payload.exp) || payload.exp * 1000 <= Date.now()) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'OIDC claims không hợp lệ.' });
    return payload;
  }
  // Profile is display-only; a failed refresh must never block sign-in.
  private async saveProfile(id: string, google: IdToken): Promise<void> {
    const displayName = google.name?.trim().slice(0, 200) || null;
    const pictureUrl = google.picture?.startsWith('https://') ? google.picture.slice(0, 1000) : null;
    await this.prisma.userIdentity.update({ where: { id }, data: { displayName, pictureUrl } }).catch(() => undefined);
  }
  async profile(userIdentityId: string): Promise<{ displayName: string | null; pictureUrl: string | null }> {
    const row = await this.prisma.userIdentity.findUnique({ where: { id: userIdentityId }, select: { displayName: true, pictureUrl: true } }).catch(() => null);
    return { displayName: row?.displayName ?? null, pictureUrl: row?.pictureUrl ?? null };
  }
  issueSession(aud: Audience, userIdentityId: string, email: string): string { return this.newSession(aud, userIdentityId, email, Date.now()).cookie; }
  private newSession(aud: Audience, sub: string, email: string, auth: number, impersonator?: Impersonator): IssuedSession {
    const { sessionIdleTtlSeconds, sessionAbsoluteTtlSeconds } = authSecrets(); const now = Date.now();
    const exp = Math.min(now + sessionIdleTtlSeconds * 1000, auth + (impersonator ? Math.min(impersonationTtlMs, sessionAbsoluteTtlSeconds * 1000) : sessionAbsoluteTtlSeconds * 1000));
    return { cookie: this.issue({ aud, sub, email, exp, auth, ...impersonator }), maxAge: exp - now };
  }
  // Ops hands a single-use ticket to the target portal host, where it becomes that portal's session cookie.
  static impersonationTicket(): { ticket: string; ticketHash: string; ticketExpiresAt: Date } { const ticket = random(); return { ticket, ticketHash: hash(ticket), ticketExpiresAt: new Date(Date.now() + impersonationTicketTtlMs) }; }
  async impersonate(audience: Audience, ticket?: string): Promise<IssuedSession & { csrf: string }> {
    const denied = () => new UnauthorizedException({ code: 'IMPERSONATION_DENIED', message: 'Phiên giả lập không hợp lệ hoặc đã hết hạn.' });
    if (audience === 'ops' || !ticket) throw denied();
    const now = new Date();
    const record = await this.prisma.impersonation.findUnique({ where: { ticketHash: hash(ticket) }, include: { targetIdentity: true, operatorIdentity: true, platformOperatorGrant: true } });
    if (!record || record.audience !== audience || record.startedAt || record.endedAt || record.ticketExpiresAt <= now || record.platformOperatorGrant.revokedAt || record.platformOperatorGrant.userIdentityId !== record.operatorIdentityId) throw denied();
    const claimed = await this.prisma.impersonation.updateMany({ where: { id: record.id, startedAt: null }, data: { startedAt: now } });
    if (claimed.count !== 1) throw denied();
    const session = this.newSession(audience, record.targetIdentityId, record.targetIdentity.emailNormalized, now.getTime(), { imp: record.id, by: record.operatorIdentity.emailNormalized });
    return { ...session, csrf: random() };
  }
  // Impersonated sessions are re-checked on every request so ending them or revoking the operator grant takes effect at once.
  async impersonationActive(id: string): Promise<boolean> {
    const record = await this.prisma.impersonation.findUnique({ where: { id }, select: { endedAt: true, platformOperatorGrant: { select: { revokedAt: true } } } });
    return Boolean(record && !record.endedAt && !record.platformOperatorGrant.revokedAt);
  }
  async endImpersonation(id: string): Promise<void> { await this.prisma.impersonation.updateMany({ where: { id, endedAt: null }, data: { endedAt: new Date() } }); }
  // Renews a valid session at most hourly so active use keeps it alive up to the absolute limit.
  refresh(audience: Audience, token?: string): IssuedSession | undefined {
    if (!token) return undefined;
    let identity; try { identity = this.session(audience, token); } catch { return undefined; }
    const current = json<Session>(token.split('.')[0]!); if (current.auth === undefined) return undefined;
    const next = this.newSession(audience, identity.userIdentityId, identity.email, current.auth, current.imp && current.by ? { imp: current.imp, by: current.by } : undefined);
    return Date.now() + next.maxAge - current.exp >= refreshAfterMs ? next : undefined;
  }
  async platformOperatorGrant(userIdentityId: string): Promise<{ id: string } | null> { return this.prisma.platformOperatorGrant.findFirst({ where: { userIdentityId, revokedAt: null }, select: { id: true } }); }
  session(audience: Audience, token?: string): SessionIdentity {
    const parts = token?.split('.') ?? []; const [encoded, signature] = parts;
    if (parts.length !== 2 || !encoded || !signature) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
    const expected = this.sign(encoded);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
    try {
      const session = json<Session>(encoded);
      if (!session || typeof session.sub !== 'string' || typeof session.email !== 'string' || !Number.isFinite(session.exp) || session.exp < Date.now() || (session.auth !== undefined && (!Number.isFinite(session.auth) || session.auth + authSecrets().sessionAbsoluteTtlSeconds * 1000 < Date.now()))) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
      if (session.aud !== audience) throw new UnauthorizedException({ code: 'INVALID_AUDIENCE', message: 'Session không thuộc audience này.' });
      if (session.imp !== undefined && (typeof session.imp !== 'string' || typeof session.by !== 'string' || session.auth === undefined || session.auth + impersonationTtlMs < Date.now())) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
      return { userIdentityId: session.sub, email: session.email, ...(session.imp ? { impersonation: { id: session.imp, operatorEmail: session.by! } } : {}) };
    } catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' }); }
  }
}
