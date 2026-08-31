import { getDomain } from 'tldts';

export interface AuthConfig {
  port: number;
  databaseUrl: string;
  webOrigin: string;
  googleClientId: string;
  googleClientSecret: string;
  googleCallbackUrl: string;
  oauthRedirectUrls: string[];
  oauthDeniedRedirectUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  sessionCookieMaxAge: number;
  adminEmails: Set<string>;
  csrfCookieName: string;
  oauthStateCookieName: string;
  parentWebOrigin: string;
  parentGoogleCallbackUrl: string;
  parentOauthRedirectUrls: string[];
  parentOauthDeniedRedirectUrl: string;
  parentSessionCookieName: string;
  parentCsrfCookieName: string;
  parentOauthStateCookieName: string;
  bankDeepLinks: Map<string, BankDeepLinkConfig>;
}

export interface BankDeepLinkConfig { template: string; }
const DEEP_LINK_PLACEHOLDERS = new Set(['bankCode', 'accountNumber', 'accountHolderName', 'transferContent', 'total']);

function loadBankDeepLinks(value: string | undefined): Map<string, BankDeepLinkConfig> {
  if (!value?.trim()) return new Map();
  try {
    const config: unknown = JSON.parse(value);
    if (!config || typeof config !== 'object' || Array.isArray(config)) return new Map();
    const record = config as Record<string, unknown>;
    if (record.version !== 1 || typeof record.expiresAt !== 'string' || typeof record.revalidateAt !== 'string' || typeof record.owner !== 'string' || !record.owner.trim() || typeof record.cadence !== 'string' || !record.cadence.trim() || !Array.isArray(record.banks)) return new Map();
    const expiresAt = Date.parse(record.expiresAt);
    const revalidateAt = Date.parse(record.revalidateAt);
    if (!Number.isFinite(expiresAt) || !Number.isFinite(revalidateAt) || revalidateAt > expiresAt || expiresAt <= Date.now() || revalidateAt <= Date.now()) return new Map();
    const banks = new Map<string, BankDeepLinkConfig>();
    for (const entry of record.banks) {
      if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return new Map();
      const bank = entry as Record<string, unknown>;
      if (typeof bank.bankCode !== 'string' || !/^[A-Z0-9]+$/.test(bank.bankCode) || typeof bank.template !== 'string' || !bank.template || !bank.support || typeof bank.support !== 'object' || Array.isArray(bank.support)) return new Map();
      const support = bank.support as Record<string, unknown>;
      if (support.tested !== true || !Array.isArray(support.matrix) || !support.matrix.length || !support.matrix.every((item) => item && typeof item === 'object' && !Array.isArray(item) && (item as Record<string, unknown>).platform === 'all' && (item as Record<string, unknown>).browser === 'all' && typeof (item as Record<string, unknown>).testedAt === 'string' && Number.isFinite(Date.parse((item as Record<string, unknown>).testedAt as string)))) return new Map();
      const placeholders = [...bank.template.matchAll(/\{([A-Za-z]+)\}/g)].map((match) => match[1]!);
      if (!placeholders.length || placeholders.some((placeholder) => !DEEP_LINK_PLACEHOLDERS.has(placeholder)) || /\{[^}]*\}/.test(bank.template.replace(/\{[A-Za-z]+\}/g, ''))) return new Map();
      const url = new URL(bank.template.replace(/\{[A-Za-z]+\}/g, 'x'));
      if (!/^([a-z][a-z0-9+.-]*):$/i.test(url.protocol) || /^(?:javascript|data):$/i.test(url.protocol) || /\s/.test(bank.template) || banks.has(bank.bankCode)) return new Map();
      banks.set(bank.bankCode, { template: bank.template });
    }
    return banks;
  } catch { return new Map(); }
}

const REQUIRED_VALUES = [
  'DATABASE_URL',
  'WEB_ORIGIN',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'OAUTH_REDIRECT_URLS',
  'OAUTH_DENIED_REDIRECT_URL',
  'JWT_SECRET',
  'ADMIN_EMAILS',
  'PARENT_WEB_ORIGIN',
  'PARENT_GOOGLE_CALLBACK_URL',
  'PARENT_OAUTH_REDIRECT_URLS',
  'PARENT_OAUTH_DENIED_REDIRECT_URL',
  'PARENT_SESSION_COOKIE_NAME',
] as const;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function required(env: NodeJS.ProcessEnv, name: (typeof REQUIRED_VALUES)[number]): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}.`);
  return value;
}

function parseUrl(value: string, name: string, originOnly = false): string {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    const normalized = value.replace(/\/$/, '');
    if (originOnly && url.origin !== normalized) throw new Error();
    return normalized;
  } catch {
    throw new Error(`${name} must be an absolute HTTP(S) URL.`);
  }
}

function assertSchemefullySameSite(webOrigin: string, callbackUrl: string): void {
  const web = new URL(webOrigin);
  const api = new URL(callbackUrl);
  const webDomain = getDomain(web.hostname, { allowPrivateDomains: true });
  const apiDomain = getDomain(api.hostname, { allowPrivateDomains: true });
  const sameHost = web.hostname === api.hostname;

  if (web.protocol !== api.protocol || (!sameHost && (!webDomain || webDomain !== apiDomain))) {
    throw new Error('WEB_ORIGIN and GOOGLE_CALLBACK_URL must use the same schemeful site; cross-site web/API deployments are not supported.');
  }
}

export function parsePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return Number(value);
}

const DURATION_MILLISECONDS: Record<string, number> = {
  ms: 1,
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  w: 604_800_000,
  y: 31_557_600_000,
};

export function parseDurationMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d|w|y)$/.exec(value);
  if (!match) throw new Error('JWT_EXPIRES_IN must be a positive duration such as 8h.');
  const milliseconds = BigInt(match[1]!) * BigInt(DURATION_MILLISECONDS[match[2]!]!);
  if (milliseconds < 1_000n || milliseconds % 1_000n !== 0n || milliseconds > 8_640_000_000_000_000n - BigInt(Date.now())) {
    throw new Error('JWT_EXPIRES_IN must be a whole-second duration that fits a cookie expiry, such as 8h.');
  }
  return Number(milliseconds);
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const port = parsePort(env.PORT);
  const databaseUrl = required(env, 'DATABASE_URL');
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  const webOrigin = parseUrl(required(env, 'WEB_ORIGIN'), 'WEB_ORIGIN', true);
  const callbackUrl = parseUrl(required(env, 'GOOGLE_CALLBACK_URL'), 'GOOGLE_CALLBACK_URL');
  assertSchemefullySameSite(webOrigin, callbackUrl);
  const redirectUrls = required(env, 'OAUTH_REDIRECT_URLS').split(',').map((value) => parseUrl(value.trim(), 'OAUTH_REDIRECT_URLS'));
  const deniedRedirectUrl = parseUrl(required(env, 'OAUTH_DENIED_REDIRECT_URL'), 'OAUTH_DENIED_REDIRECT_URL');
  if (!redirectUrls.includes(deniedRedirectUrl)) throw new Error('OAUTH_DENIED_REDIRECT_URL must be included in OAUTH_REDIRECT_URLS.');
  const adminEmails = new Set(required(env, 'ADMIN_EMAILS').split(',').map(normalizeEmail).filter(Boolean));
  if (!adminEmails.size) throw new Error('ADMIN_EMAILS must contain at least one email address.');
  for (const email of adminEmails) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('ADMIN_EMAILS contains an invalid email address.');
  }
  const jwtSecret = required(env, 'JWT_SECRET');
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  const jwtExpiresIn = env.JWT_EXPIRES_IN?.trim() || '24h';
  const sessionCookieMaxAge = parseDurationMilliseconds(jwtExpiresIn);
  const csrfCookieName = env.CSRF_COOKIE_NAME?.trim() || 'csrf_token';
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(csrfCookieName) || csrfCookieName === 'session') {
    throw new Error('CSRF_COOKIE_NAME must be a valid cookie name other than session.');
  }

  const parentWebOrigin = parseUrl(required(env, 'PARENT_WEB_ORIGIN'), 'PARENT_WEB_ORIGIN', true);
  const parentGoogleCallbackUrl = parseUrl(required(env, 'PARENT_GOOGLE_CALLBACK_URL'), 'PARENT_GOOGLE_CALLBACK_URL');
  assertSchemefullySameSite(parentWebOrigin, parentGoogleCallbackUrl);
  const parentOauthRedirectUrls = required(env, 'PARENT_OAUTH_REDIRECT_URLS').split(',').map((value) => parseUrl(value.trim(), 'PARENT_OAUTH_REDIRECT_URLS'));
  const parentOauthDeniedRedirectUrl = parseUrl(required(env, 'PARENT_OAUTH_DENIED_REDIRECT_URL'), 'PARENT_OAUTH_DENIED_REDIRECT_URL');
  if (!parentOauthRedirectUrls.includes(parentOauthDeniedRedirectUrl)) throw new Error('PARENT_OAUTH_DENIED_REDIRECT_URL must be included in PARENT_OAUTH_REDIRECT_URLS.');
  const parentSessionCookieName = required(env, 'PARENT_SESSION_COOKIE_NAME');
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(parentSessionCookieName) || parentSessionCookieName === 'session') throw new Error('PARENT_SESSION_COOKIE_NAME must be a valid cookie name other than session.');
  const parentCsrfCookieName = env.PARENT_CSRF_COOKIE_NAME?.trim() || 'parent_csrf_token';
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(parentCsrfCookieName) || parentCsrfCookieName === parentSessionCookieName) throw new Error('PARENT_CSRF_COOKIE_NAME must be a valid cookie name distinct from the Parent session cookie.');
  return {
    port, databaseUrl, webOrigin,
    googleClientId: required(env, 'GOOGLE_CLIENT_ID'),
    googleClientSecret: required(env, 'GOOGLE_CLIENT_SECRET'),
    googleCallbackUrl: callbackUrl,
    oauthRedirectUrls: redirectUrls,
    oauthDeniedRedirectUrl: deniedRedirectUrl,
    jwtSecret,
    jwtExpiresIn,
    sessionCookieMaxAge,
    adminEmails,
    csrfCookieName,
    oauthStateCookieName: 'oauth_state',
    parentWebOrigin,
    parentGoogleCallbackUrl,
    parentOauthRedirectUrls,
    parentOauthDeniedRedirectUrl,
    parentSessionCookieName,
    parentCsrfCookieName,
    parentOauthStateCookieName: 'parent_oauth_state',
    bankDeepLinks: loadBankDeepLinks(env.BANK_DEEP_LINK_CONFIG),
  };
}
