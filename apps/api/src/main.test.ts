import { afterEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock('@nestjs/core', () => ({ NestFactory: { create }, Reflector: class {}, APP_GUARD: 'APP_GUARD' }));

const { apiEnvPath, bootstrap, parsePort } = await import('./main.js');

const originalEnv = { ...process.env };
const authEnv = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/anhhoa', WEB_ORIGIN: 'http://localhost:5173', GOOGLE_CLIENT_ID: 'client-id', GOOGLE_CLIENT_SECRET: 'client-secret',
  GOOGLE_CALLBACK_URL: 'http://localhost:3000/auth/google/callback', OAUTH_REDIRECT_URLS: 'http://localhost:5173', OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5173',
  JWT_SECRET: 'a-very-long-secret-that-is-at-least-32-characters', ADMIN_EMAILS: 'admin@example.com',
  PARENT_WEB_ORIGIN: 'http://localhost:5174', PARENT_GOOGLE_CALLBACK_URL: 'http://localhost:3000/parent/auth/google/callback', PARENT_OAUTH_REDIRECT_URLS: 'http://localhost:5174', PARENT_OAUTH_DENIED_REDIRECT_URL: 'http://localhost:5174', PARENT_SESSION_COOKIE_NAME: 'parent_session',
};

afterEach(() => {
  create.mockReset();
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnv);
});

describe('parsePort', () => {
  it('resolves the API-local environment file independently of the process working directory', () => {
    expect(apiEnvPath).toMatch(/apps\/api\/\.env$/);
  });
  it('uses 3000 when PORT is absent and accepts valid integers', () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('1')).toBe(1);
    expect(parsePort('65535')).toBe(65535);
  });

  it.each(['', '0', '-1', '3000.5', 'abc', '65536'])('rejects invalid PORT %j', (value) => {
    expect(() => parsePort(value)).toThrow('PORT must be an integer between 1 and 65535.');
  });
});

describe('bootstrap', () => {
  it('listens on 3000 when PORT is absent without binding on import', async () => {
    delete process.env.PORT;
    Object.assign(process.env, authEnv);
    const listen = vi.fn().mockResolvedValue(undefined);
    const app = { listen, enableCors: vi.fn(), use: vi.fn(), useGlobalPipes: vi.fn(), useGlobalFilters: vi.fn() };
    create.mockResolvedValue(app);

    expect(create).not.toHaveBeenCalled();
    await bootstrap();

    expect(listen).toHaveBeenCalledWith(3000);
    expect(app.enableCors).toHaveBeenCalledWith({ origin: ['http://localhost:5173', 'http://localhost:5174'], credentials: true });
  });

  it('listens on the valid explicit PORT', async () => {
    process.env.PORT = '4567';
    Object.assign(process.env, authEnv);
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen, enableCors: vi.fn(), use: vi.fn(), useGlobalPipes: vi.fn(), useGlobalFilters: vi.fn() });

    await bootstrap();

    expect(listen).toHaveBeenCalledWith(4567);
  });

  it('rejects an invalid PORT before creating or listening on the app', async () => {
    process.env.PORT = '3000.5';
    Object.assign(process.env, authEnv);
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen });

    await expect(bootstrap()).rejects.toThrow('PORT must be an integer between 1 and 65535.');

    expect(create).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });

  it('rejects cross-site auth topology before creating or listening on the app', async () => {
    Object.assign(process.env, authEnv, { WEB_ORIGIN: 'https://admin.anhhoa.vn', GOOGLE_CALLBACK_URL: 'https://api.example.net/auth/google/callback' });
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen });

    await expect(bootstrap()).rejects.toThrow('WEB_ORIGIN and GOOGLE_CALLBACK_URL must use the same schemeful site');

    expect(create).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });
});
