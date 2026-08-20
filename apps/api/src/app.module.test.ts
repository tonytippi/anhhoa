import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { rmSync, mkdtempSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Test } from '@nestjs/testing';

describe('AppModule', () => {
  let outputDirectory: string;

  beforeAll(() => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:password@localhost:5432/anhhoa');
    vi.stubEnv('WEB_ORIGIN', 'http://localhost:5173');
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-client-id');
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-client-secret');
    vi.stubEnv('GOOGLE_CALLBACK_URL', 'http://localhost:3000/auth/google/callback');
    vi.stubEnv('OAUTH_REDIRECT_URLS', 'http://localhost:5173/auth/callback');
    vi.stubEnv('OAUTH_DENIED_REDIRECT_URL', 'http://localhost:5173/auth/callback');
    vi.stubEnv('JWT_SECRET', 'a-32-character-secret-for-session-tests');
    vi.stubEnv('ADMIN_EMAILS', 'admin@example.com');

    const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
    outputDirectory = mkdtempSync(join(tmpdir(), 'anhhoa-api-di-'));
    try {
      execFileSync(process.execPath, [join(apiRoot, 'node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json', '--outDir', outputDirectory], { cwd: apiRoot, stdio: 'inherit' });
    } catch (error) {
      rmSync(outputDirectory, { recursive: true, force: true });
      throw error;
    }
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    rmSync(outputDirectory, { recursive: true, force: true });
  });

  it('resolves the compiled global session guard dependencies', async () => {
    const { AppModule } = await import(pathToFileURL(join(outputDirectory, 'app.module.js')).href);
    const { PrismaService } = await import(pathToFileURL(join(outputDirectory, 'common/prisma/prisma.service.js')).href);
    const { AUTH_CONFIG } = await import(pathToFileURL(join(outputDirectory, 'common/config/config.module.js')).href);
    const config = {
      adminEmails: new Set(['admin@example.com']),
      csrfCookieName: 'csrf_token',
      googleCallbackUrl: 'http://localhost:3000/auth/google/callback',
      googleClientId: 'google-client-id',
      googleClientSecret: 'google-client-secret',
      jwtExpiresIn: '8h',
      jwtSecret: 'a-32-character-secret-for-session-tests',
      oauthDeniedRedirectUrl: 'http://localhost:5173/auth/callback',
      oauthRedirectUrls: ['http://localhost:5173/auth/callback'],
      oauthStateCookieName: 'oauth_state',
      port: 3000,
      webOrigin: 'http://localhost:5173',
    };
    const prisma = { admin: { findUnique: vi.fn() } };

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      .overrideProvider(AUTH_CONFIG).useValue(config)
      .compile();

    expect(module).toBeDefined();
    await module.close();
  });
});
