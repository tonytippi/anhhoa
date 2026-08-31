import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const nginx = readFileSync(resolve(import.meta.dirname, 'nginx.conf'), 'utf8');

it('Admin gateway strips /api, rewrites the OAuth state path, and preserves SPA routes', () => {
  expect(nginx).toContain('location = /api');
  expect(nginx).toContain('location /api/');
  expect(nginx).toContain('proxy_pass http://api:3000/;');
  expect(nginx).toContain('proxy_cookie_path /auth/google /api/auth/google;');
  expect(nginx).toContain('try_files $uri $uri/ /index.html;');
});
