import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFile(resolve(root, path), 'utf8');
const tracked = () => execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter((path) => existsSync(resolve(root, path)));

describe('target platform structure', () => {
  it('declares all independently built target units', async () => {
    const workspace = await read('pnpm-workspace.yaml');
    const packages = await Promise.all(['apps/api/package.json', 'apps/web/package.json', 'apps/teacher-web/package.json', 'apps/parent-web/package.json', 'apps/ops-web/package.json', 'packages/contracts/package.json', 'packages/ui/package.json'].map(read));
    expect(workspace).toContain('packages/*');
    expect(packages).toHaveLength(7);
    for (const manifest of packages) expect(JSON.parse(manifest).scripts.build).toBeTruthy();
  });

  it('keeps the target baseline scoped to School and removes legacy schema models', async () => {
    const schema = await read('apps/api/prisma/schema.prisma');
    const seed = await read('apps/api/prisma/seed.ts');
    expect(schema).toContain('model School');
    expect(schema).not.toContain('model Admin');
    expect(schema).not.toContain('model InvoiceTemplate');
    expect(seed).toContain('truong-mau-passionedu');
  });

  it('routes all five fixed hosts through the pilot proxy and deploys migrations first', async () => {
    const compose = await read('deploy/compose/compose.yaml');
    const caddy = await read('deploy/compose/Caddyfile');
    for (const host of ['app', 'teacher', 'parent', 'ops', 'api']) expect(caddy).toContain(`${host}.passionedu.org`);
    expect(compose).toContain("'prisma', 'migrate', 'deploy'");
    expect(compose).toContain('postgres-data');
    expect(compose).toContain('service_completed_successfully');
    expect(compose).not.toContain('db push');
  });

  it('does not track legacy source, secrets, or cross-app imports', async () => {
    const paths = tracked();
    expect(paths.some((path) => path === 'compose.yaml' || path === 'docker-compose.test.yml' || /apps\/api\/src\/(common|modules\/(auth|admins|classes|students|invoices))\//.test(path))).toBe(false);
    expect(paths.some((path) => /(^|\/)\.env(?:$|\.)/.test(path) && !path.endsWith('.example'))).toBe(false);
    const sourcePaths = paths.filter((path) => /^apps\/(api|web|teacher-web|parent-web|ops-web)\/src\/.*\.(ts|tsx)$/.test(path));
    const sources = await Promise.all(sourcePaths.map(read));
    for (const source of sources) expect(source).not.toMatch(/from\s+['"][^'"]*apps\/(api|web|teacher-web|parent-web|ops-web)/);
    for (const source of sources.filter((_, index) => sourcePaths[index].startsWith('apps/') && !sourcePaths[index].startsWith('apps/api/'))) {
      expect(source).not.toMatch(/from\s+['"][^'"]*apps\/api|from\s+['"][^'"]*\.\.\/api/);
    }
  });
});
