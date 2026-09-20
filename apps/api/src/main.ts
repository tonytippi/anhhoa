import { NestFactory } from '@nestjs/core';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';
import { AppModule } from './app.module.js';
import { ApiErrorFilter } from './common/api-error.filter.js';
import { audienceConfig, audienceOrigins, superadminEmail, type Audience } from './modules/auth/auth.config.js';
export const apiEnvPath = resolve(import.meta.dirname, '../.env');

loadDotenv({ path: apiEnvPath });

export function parsePort(value = process.env.PORT ?? '3000'): number {
  if (!/^\d+$/.test(value)) throw new Error('PORT must be an integer between 1 and 65535.');
  const port = Number(value);
  if (port < 1 || port > 65535) throw new Error('PORT must be an integer between 1 and 65535.');
  return port;
}

export async function createApi() {
  const app = await NestFactory.create(AppModule);
  app.use(['/api/teacher/schools/:schoolId/attendance-evidence', '/api/teacher/schools/:schoolId/handover-evidence'], (request: { method?: string; headers: Record<string, string | undefined>; on(event: 'data', listener: (value: Buffer) => void): void; on(event: 'end' | 'aborted' | 'error', listener: () => void): void; body?: Buffer }, response: { status(code: number): { end(): void } }, next: () => void) => {
    if (request.method !== 'POST' || request.headers['content-type']?.split(';')[0] === 'application/json') return next();
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk) => { size += chunk.length; if (size <= 5 * 1024 * 1024) chunks.push(chunk); });
    let finished = false;
    const fail = (status: number) => { if (!finished) { finished = true; response.status(status).end(); } };
    request.on('end', () => { if (size > 5 * 1024 * 1024) fail(413); else if (!finished) { finished = true; request.body = Buffer.concat(chunks); next(); } });
    request.on('aborted', () => fail(400));
    request.on('error', () => fail(400));
  });
  app.use((request: { method?: string; path?: string; headers: Record<string, string | undefined> }, response: { setHeader(name: string, value: string): void; status(code: number): { end(): void } }, next: () => void) => {
    const audience = request.path?.match(/^\/api\/(app|teacher|parent|ops)\/(?:auth|schools|operations)(?:\/|$)/)?.[1] as Audience | undefined;
    const origin = request.headers.origin;
    if (audience && origin === audienceConfig(audience).origin) {
      response.setHeader('Access-Control-Allow-Origin', origin);
      response.setHeader('Access-Control-Allow-Credentials', 'true');
      response.setHeader('Vary', 'Origin');
      if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'content-type,x-csrf-token,idempotency-key,x-operation-id');
        response.status(204).end();
        return;
      }
    }
    next();
  });
  app.useGlobalFilters(new ApiErrorFilter());
  return app;
}

export async function bootstrap(): Promise<void> {
  audienceOrigins(true);
  const { authSecrets } = await import('./modules/auth/auth.config.js');
  authSecrets(true);
  superadminEmail(true);
  const app = await createApi();
  await app.listen(parsePort());
}

if (process.env.NODE_ENV !== 'test') {
  void bootstrap();
}
