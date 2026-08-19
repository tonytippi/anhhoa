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
  adminEmails: Set<string>;
  csrfCookieName: string;
  oauthStateCookieName: string;
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

export function parsePort(value: string | undefined): number {
  if (value === undefined) return 3000;
  if (!/^[1-9]\d*$/.test(value) || Number(value) > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return Number(value);
}

export function loadAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const databaseUrl = required(env, 'DATABASE_URL');
  if (!/^postgres(?:ql)?:\/\//.test(databaseUrl)) throw new Error('DATABASE_URL must be a PostgreSQL connection URL.');
  const webOrigin = parseUrl(required(env, 'WEB_ORIGIN'), 'WEB_ORIGIN', true);
  const callbackUrl = parseUrl(required(env, 'GOOGLE_CALLBACK_URL'), 'GOOGLE_CALLBACK_URL');
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
  const jwtExpiresIn = env.JWT_EXPIRES_IN?.trim() || '8h';
  if (!/^\d+(?:ms|s|m|h|d|w|y)$/.test(jwtExpiresIn)) throw new Error('JWT_EXPIRES_IN must be a positive duration such as 8h.');
  const csrfCookieName = env.CSRF_COOKIE_NAME?.trim() || 'csrf_token';
  if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(csrfCookieName) || csrfCookieName === 'session') {
    throw new Error('CSRF_COOKIE_NAME must be a valid cookie name other than session.');
  }

  return {
    port: parsePort(env.PORT), databaseUrl, webOrigin,
    googleClientId: required(env, 'GOOGLE_CLIENT_ID'),
    googleClientSecret: required(env, 'GOOGLE_CLIENT_SECRET'),
    googleCallbackUrl: callbackUrl,
    oauthRedirectUrls: redirectUrls,
    oauthDeniedRedirectUrl: deniedRedirectUrl,
    jwtSecret,
    jwtExpiresIn,
    adminEmails,
    csrfCookieName,
    oauthStateCookieName: 'oauth_state',
  };
}
