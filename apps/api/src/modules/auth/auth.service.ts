import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, createHmac, createPublicKey, randomBytes, timingSafeEqual, verify } from 'node:crypto';
import type { Audience } from './auth.config.js';
import { audienceConfig, authSecrets, superadminEmail } from './auth.config.js';
import { PrismaService } from '../identity/prisma.service.js';

type IdToken = { iss: string; aud: string | string[]; azp?: string; sub: string; email: string; email_verified: boolean | string; nonce: string; exp: number };
type Session = { aud: Audience; sub: string; email: string; exp: number };
type Start = { authorizationUrl: string; correlation: string };
const issuer = 'https://accounts.google.com';
const jwksUrl = 'https://www.googleapis.com/oauth2/v3/certs';
const hash = (value: string) => createHash('sha256').update(value).digest('base64url');
const random = () => randomBytes(32).toString('base64url');
const json = <T>(value: string): T => JSON.parse(Buffer.from(value, 'base64url').toString()) as T;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}
  private sign(value: string): string { return createHmac('sha256', authSecrets().sessionSecret).update(value).digest('base64url'); }
  private issue(payload: Session): string { const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${encoded}.${this.sign(encoded)}`; }

  async start(audience: Audience, requestedRedirect?: string): Promise<Start> {
    const config = audienceConfig(audience);
    if (requestedRedirect && !config.redirects.includes(requestedRedirect)) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Redirect không hợp lệ.' });
    const redirect = requestedRedirect ?? config.redirects[0];
    if (!redirect) throw new UnauthorizedException({ code: 'OAUTH_DENIED', message: 'Redirect không hợp lệ.' });
    const state = random(); const correlation = random(); const nonce = random(); const { stateTtlSeconds } = authSecrets();
    await this.prisma.oAuthTransaction.create({ data: { audience, stateHash: hash(state), correlationHash: hash(correlation), nonce, redirect, expiresAt: new Date(Date.now() + stateTtlSeconds * 1000) } });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID ?? 'test-client-id'); url.searchParams.set('redirect_uri', config.callbackUrl); url.searchParams.set('response_type', 'code'); url.searchParams.set('scope', 'openid email'); url.searchParams.set('state', state); url.searchParams.set('nonce', nonce);
    return { authorizationUrl: url.toString(), correlation };
  }

  async callback(audience: Audience, state: string, correlation: string | undefined, code: string): Promise<{ redirect: string; cookie?: string; csrf?: string }> {
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
    if (audience === 'parent') return { redirect: audienceConfig(audience).deniedRedirect };
    if (audience === 'ops') {
      if (identity.emailNormalized !== superadminEmail()) return { redirect: audienceConfig(audience).deniedRedirect };
      await this.prisma.platformOperatorGrant.upsert({ where: { userIdentityId: identity.id }, create: { userIdentityId: identity.id }, update: {} });
    }
    const csrf = random(); return { redirect: transaction.redirect, cookie: this.issueSession(audience, identity.id, identity.emailNormalized), csrf };
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
  issueSession(aud: Audience, userIdentityId: string, email: string): string { return this.issue({ aud, sub: userIdentityId, email, exp: Date.now() + authSecrets().sessionTtlSeconds * 1000 }); }
  async platformOperatorGrant(userIdentityId: string): Promise<{ id: string } | null> { return this.prisma.platformOperatorGrant.findUnique({ where: { userIdentityId }, select: { id: true } }); }
  session(audience: Audience, token?: string): { userIdentityId: string; email: string } {
    const parts = token?.split('.') ?? []; const [encoded, signature] = parts;
    if (parts.length !== 2 || !encoded || !signature) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
    const expected = this.sign(encoded);
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
    try {
      const session = json<Session>(encoded);
      if (!session || typeof session.sub !== 'string' || typeof session.email !== 'string' || !Number.isFinite(session.exp) || session.exp < Date.now()) throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' });
      if (session.aud !== audience) throw new UnauthorizedException({ code: 'INVALID_AUDIENCE', message: 'Session không thuộc audience này.' });
    return { userIdentityId: session.sub, email: session.email };
    } catch (error) { if (error instanceof UnauthorizedException) throw error; throw new UnauthorizedException({ code: 'AUTHENTICATION_REQUIRED', message: 'Cần đăng nhập.' }); }
  }
}
