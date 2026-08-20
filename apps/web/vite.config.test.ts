import { expect, it } from 'vitest';
import config from './vite.config';

it('proxy /api tới API local và bỏ prefix', () => {
  const proxy = config.server?.proxy;
  expect(proxy).toBeDefined();

  const apiProxy = typeof proxy === 'object' && !Array.isArray(proxy) ? proxy['/api'] : undefined;
  expect(apiProxy).toMatchObject({ target: 'http://localhost:3000', changeOrigin: true });
  expect(apiProxy).toMatchObject({ cookiePathRewrite: { '/auth/google': '/api/auth/google' } });
  expect(typeof apiProxy === 'object' && apiProxy !== null && 'rewrite' in apiProxy && apiProxy.rewrite?.('/api/auth/google/callback?code=value')).toBe('/auth/google/callback?code=value');
  expect(typeof apiProxy === 'object' && apiProxy !== null && 'rewrite' in apiProxy && apiProxy.rewrite?.('/apiary')).toBe('/apiary');
});
