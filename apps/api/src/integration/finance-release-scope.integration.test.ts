import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../..', import.meta.url));

async function source(path: string) {
  return readFile(new URL(path, `file://${root}/`), 'utf8');
}

describe('Finance Story 6.5 release scope', () => {
  it('allows only School-scoped ledger reports and opaque CSV exports within Finance', async () => {
    const [schema, financeModule, financeService, financeController, financeWorkspace, reportsWorkspace] = await Promise.all([
      source('apps/api/prisma/schema.prisma'),
      source('apps/api/src/modules/finance/finance.module.ts'),
      source('apps/api/src/modules/finance/finance.service.ts'),
      source('apps/api/src/modules/finance/finance.controller.ts'),
      source('apps/web/src/finance/finance-workspace.tsx'),
      source('apps/web/src/finance/finance-reports-workspace.tsx'),
    ]);
    const runtime = [schema, financeModule, financeService, financeController, financeWorkspace, reportsWorkspace].join('\n');

    expect(runtime).toMatch(/FinanceLedgerEvent|FinanceReportExport|requestReportExport|downloadReportExport/);
    for (const forbidden of [/PDF|XLSX|scheduled report|custom report/i, /\bChargeRule\b/i]) expect(runtime).not.toMatch(forbidden);
    for (const source of [financeService, financeController, financeWorkspace, reportsWorkspace])
      expect(source).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
    expect(reportsWorkspace).not.toMatch(/Blob|createObjectURL|new File/i);
  });
});
