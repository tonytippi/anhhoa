import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../..', import.meta.url));

async function source(path: string) {
  return readFile(new URL(path, `file://${root}/`), 'utf8');
}

describe('Finance Story 6.6 release evidence', () => {
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

  it('requires the PostgreSQL evidence for receipt, carry, coverage/refund, debt, reporting, concurrency, idempotency, and history', async () => {
    const integration = await source('apps/api/src/integration/finance.integration.test.ts');

    for (const evidence of [
      /posts immutable exact, shortfall, and overpayment receipts once, then carries a shortfall only into the next monthly DRAFT/,
      /closes a coverage Invoice exactly once and atomically issues immutable paid coverage with replay/,
      /caps direct reversal under replay and concurrent posts/,
      /rejects cross-School reversal graph and preserves append-only reversal records/,
      /moves bounded same-scope outstanding debt append-only, replays safely, and settles the target through actual receipt/,
      /projects immutable report cutoffs, four workspaces, export audit, expiry, tenant and revoked denial/,
      /Promise\.allSettled\(/,
      /IDEMPOTENCY_CONFLICT/,
      /append-only/,
    ]) expect(integration).toMatch(evidence);
  });

  it('requires the Admin actual-receipt surface and the complete root release command', async () => {
    const [e2e, workspace, rootPackage] = await Promise.all([
      source('apps/web/e2e/finance-release-gate.spec.ts'),
      source('apps/web/src/finance/finance-workspace.tsx'),
      source('package.json'),
    ]);

    expect(e2e).toMatch(/Ghi thực nhận và đóng hóa đơn/);
    expect(e2e).toMatch(/Xác nhận ghi thực nhận/);
    expect(e2e).toMatch(/trạng thái CLOSED/);
    expect(e2e).toMatch(/Kết quả máy chủ: Đủ/);
    expect(e2e).toMatch(/Release Gate B/);
    expect(e2e).toMatch(/text\/csv; charset=utf-8/);
    expect(workspace).toMatch(/\/receipt/,);
    expect(workspace).toMatch(/Kết quả máy chủ/);
    expect(workspace).not.toMatch(/Math\.(?:round|floor|ceil)/);
    expect(rootPackage).toMatch(/"test:release-gate":\s*"[^"]*--filter @passionedu\/api test:integration[^"]*--filter @passionedu\/admin-web test[^"]*--filter @passionedu\/teacher-web test[^"]*--filter @passionedu\/parent-web test[^"]*--filter @passionedu\/ops-web test[^"]*pnpm test:e2e/);
  });
});
