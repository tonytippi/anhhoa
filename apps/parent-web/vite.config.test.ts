import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import config from './vite.config';

it('proxy /api Parent toi API local, bo prefix va rewrite OAuth state cookie path', () => {
  const proxy = config.server?.proxy;
  expect(proxy).toBeDefined();

  const apiProxy = typeof proxy === 'object' && !Array.isArray(proxy) ? proxy['/api'] : undefined;
  expect(apiProxy).toMatchObject({
    target: 'http://localhost:3000',
    changeOrigin: true,
    cookiePathRewrite: { '/parent/auth/google': '/api/parent/auth/google' },
  });
  expect(typeof apiProxy === 'object' && apiProxy !== null && 'rewrite' in apiProxy && apiProxy.rewrite?.('/api/parent/auth/google/callback?code=value')).toBe('/parent/auth/google/callback?code=value');
  expect(typeof apiProxy === 'object' && apiProxy !== null && 'rewrite' in apiProxy && apiProxy.rewrite?.('/apiary')).toBe('/apiary');
});

it('khong phuc vu SPA fallback cho exact /api hoac API routes', () => {
  const source = readFileSync(resolve(import.meta.dirname, 'vite.config.ts'), 'utf8');

  expect(source).toContain('/^\\/api(?:\\/|$)/');
});
