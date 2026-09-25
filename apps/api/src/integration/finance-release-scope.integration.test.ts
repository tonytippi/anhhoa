import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../..', import.meta.url));

async function source(path: string) {
  return readFile(new URL(path, `file://${root}/`), 'utf8');
}

describe('Finance Story 6.4 release scope', () => {
  it('allows prior debt transfer only within Finance while excluding reports and cross-portal dependencies', async () => {
    const [schema, financeModule, financeService, financeController, financeWorkspace] = await Promise.all([
      source('apps/api/prisma/schema.prisma'),
      source('apps/api/src/modules/finance/finance.module.ts'),
      source('apps/api/src/modules/finance/finance.service.ts'),
      source('apps/api/src/modules/finance/finance.controller.ts'),
      source('apps/web/src/finance/finance-workspace.tsx'),
    ]);
    const runtime = [schema, financeModule, financeService, financeController, financeWorkspace].join('\n');

    expect(runtime).toMatch(/DebtTransfer|transferDebt|PRIOR_DEBT/);
    for (const forbidden of [/\bReport\b/i, /\bChargeRule\b/i]) expect(runtime).not.toMatch(forbidden);
    for (const source of [financeService, financeController, financeWorkspace])
      expect(source).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
    expect(financeWorkspace).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
  });
});
