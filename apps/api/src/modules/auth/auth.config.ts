export type Audience = 'app' | 'teacher' | 'parent' | 'ops';

export type AudienceConfig = {
  audience: Audience;
  origin: string;
  callbackUrl: string;
  redirects: string[];
  deniedRedirect: string;
  cookieName: string;
  csrfCookieName: string;
  correlationCookieName: string;
};

const names: Record<Audience, string> = { app: 'APP', teacher: 'TEACHER', parent: 'PARENT', ops: 'OPS' };

function value(name: string, fallback: string, strict = false): string {
  const result = process.env[name];
  if (strict && !result) throw new Error(`${name} must be configured before startup.`);
  return result || fallback;
}

function url(name: string, fallback: string, strict: boolean): string {
  const result = value(name, fallback, strict);
  try { return new URL(result).toString().replace(/\/$/, ''); } catch { if (strict) throw new Error(`${name} must be an absolute URL.`); return fallback; }
}

export function audienceConfig(audience: Audience, strict = false): AudienceConfig {
  const prefix = names[audience];
  const port: Record<Audience, string> = { app: '5173', parent: '5174', teacher: '5175', ops: '5176' };
  const origin = url(`${prefix}_WEB_ORIGIN`, `http://localhost:${port[audience]}`, strict);
  const callbackUrl = url(`${prefix}_GOOGLE_CALLBACK_URL`, `http://localhost:3000/api/${audience}/auth/google/callback`, strict);
  if (strict && process.env.NODE_ENV === 'production' && !callbackUrl.startsWith('https://')) throw new Error(`${prefix}_GOOGLE_CALLBACK_URL must use HTTPS in production.`);
  const redirects = value(`${prefix}_OAUTH_REDIRECT_URLS`, origin, strict).split(',').map((entry) => url(`${prefix}_OAUTH_REDIRECT_URLS`, entry.trim(), strict));
  return { audience, origin, callbackUrl, redirects, deniedRedirect: url(`${prefix}_OAUTH_DENIED_REDIRECT_URL`, origin, strict), cookieName: value(`${prefix}_SESSION_COOKIE_NAME`, `${audience}_session`, strict), csrfCookieName: value(`${prefix}_CSRF_COOKIE_NAME`, `${audience}_csrf`, strict), correlationCookieName: `${audience}_oauth_correlation` };
}

export function cookieSecure(audience: Audience): boolean {
  return audienceConfig(audience).callbackUrl.startsWith('https://');
}

export function audienceOrigins(strict = false): string[] {
  const configs = (['app', 'teacher', 'parent', 'ops'] as Audience[]).map((audience) => audienceConfig(audience, strict));
  if (strict) {
    const cookieNames = configs.flatMap((config) => [config.cookieName, config.csrfCookieName, config.correlationCookieName]);
    if (new Set(cookieNames).size !== cookieNames.length) throw new Error('Audience cookie names must be unique.');
  }
  return configs.map((config) => config.origin);
}
export function authSecrets(strict = false) {
  const sessionSecret = value('SESSION_SECRET', 'test-session-secret-must-be-at-least-32-characters');
  const stateTtlSeconds = Number(value('OAUTH_STATE_TTL_SECONDS', '600'));
  const sessionTtlSeconds = Number(value('SESSION_TTL_SECONDS', '86400'));
  if (!Number.isInteger(stateTtlSeconds) || stateTtlSeconds <= 0 || !Number.isInteger(sessionTtlSeconds) || sessionTtlSeconds <= 0) throw new Error('OAuth and session TTL must be positive integers.');
  if (strict && (!process.env.SESSION_SECRET || sessionSecret.length < 32 || !process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET)) throw new Error('OAuth and session secrets must be configured before startup.');
  return { sessionSecret, stateTtlSeconds, sessionTtlSeconds };
}

export function superadminEmail(strict = false): string {
  const email = process.env.SUPERADMIN_EMAIL?.trim().toLowerCase();
  if (strict && (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('SUPERADMIN_EMAIL must be a valid email.');
  return email ?? '';
}
