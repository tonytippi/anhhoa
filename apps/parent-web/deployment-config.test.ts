import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const nginx = readFileSync(resolve(import.meta.dirname, 'nginx.conf'), 'utf8');
const compose = readFileSync(resolve(root, 'compose.yaml'), 'utf8');
const productionExample = readFileSync(resolve(root, '.env.production.example'), 'utf8');

function serviceBlock(name: string): string {
  const start = compose.indexOf(`  ${name}:\n`);
  const end = compose.indexOf('\n  ', start + 1);
  return compose.slice(start, end === -1 ? undefined : end);
}

it('Parent gateway strips /api, rewrites the OAuth state path, and preserves SPA routes', () => {
  expect(nginx).toContain('location = /api');
  expect(nginx).toContain('location /api/');
  expect(nginx).toContain('proxy_pass http://api:3000/;');
  expect(nginx).toContain('proxy_cookie_path /parent/auth/google /api/parent/auth/google;');
  expect(nginx).toContain('try_files $uri $uri/ /index.html;');
});

it('Compose deploys Parent gateway on its own loopback port after API health', () => {
  expect(compose).toContain('parent-web:');
  expect(compose).toContain('dockerfile: apps/parent-web/Dockerfile');
  expect(compose).toContain("'127.0.0.1:${PARENT_WEB_PORT:-8081}:80'");
  expect(compose).toContain('condition: service_healthy');
  expect(serviceBlock('api')).not.toMatch(/^    (?:ports|expose):/m);
  expect(serviceBlock('postgres')).not.toMatch(/^    (?:ports|expose):/m);
});

it('production example supplies every required Parent setting without values', () => {
  for (const name of [
    'PARENT_WEB_PORT',
    'PARENT_WEB_ORIGIN',
    'PARENT_GOOGLE_CALLBACK_URL',
    'PARENT_OAUTH_REDIRECT_URLS',
    'PARENT_OAUTH_DENIED_REDIRECT_URL',
    'PARENT_SESSION_COOKIE_NAME',
    'PARENT_CSRF_COOKIE_NAME',
  ]) {
    expect(productionExample).toContain(`${name}=`);
  }
});
