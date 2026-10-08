import { readdir, readFile } from 'node:fs/promises';
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
      /serializes concurrent direct reversal inserts at the PostgreSQL coverage lock/,
      /rejects cross-School reversal graph and preserves append-only reversal records/,
      /moves bounded same-scope outstanding debt append-only, replays safely, and settles the target through actual receipt/,
      /projects immutable report cutoffs, four workspaces, export audit, expiry, tenant and revoked denial/,
      /Promise\.allSettled\(/,
      /IDEMPOTENCY_CONFLICT/,
      /append-only/,
    ]) expect(integration).toMatch(evidence);
  });

  it('requires the Admin receipt-queue reconciliation surface and the complete root release command', async () => {
    const [e2e, workspace, rootPackage] = await Promise.all([
      source('apps/web/e2e/finance-release-gate.spec.ts'),
      source('apps/web/src/finance/finance-workspace.tsx'),
      source('package.json'),
    ]);

    expect(e2e).toMatch(/Thu tiền/);
    expect(e2e).toMatch(/finance\/invoices\/\*\/receipt/);
    expect(e2e).toMatch(/Xác nhận ghi thực nhận/);
    expect(e2e).toMatch(/status: 504/);
    expect(e2e).toMatch(/Kết quả ghi thực nhận/);
    expect(e2e).toMatch(/Hóa đơn tiếp theo/);
    expect(e2e).toMatch(/expect\(receiptPosts\)\.toBe\(1\)/);
    expect(e2e).toMatch(/Release Gate B/);
    expect(e2e).toMatch(/text\/csv; charset=utf-8/);
    expect(workspace).not.toMatch(/\/receipt/);
    expect(workspace).toMatch(/Kết quả máy chủ/);
    expect(workspace).not.toMatch(/Math\.(?:round|floor|ceil)/);
    const releaseCommand = (JSON.parse(rootPackage) as { scripts: Record<string, string> }).scripts['test:release-gate'];
    expect(releaseCommand).toMatch(/test -f \.\/\.env\.test/);
    expect(releaseCommand).toMatch(/\. \.\/\.env\.test/);
    expect(releaseCommand).toMatch(/TARGET_INTEGRATION_DATABASE_URL/);
    expect(releaseCommand).toMatch(/E2E_DATABASE_URL/);
    expect(releaseCommand).toMatch(/--filter @passionedu\/api test:integration/);
    expect(releaseCommand).toMatch(/--filter @passionedu\/admin-web test/);
    expect(releaseCommand).toMatch(/--filter @passionedu\/teacher-web test/);
    expect(releaseCommand).toMatch(/--filter @passionedu\/parent-web test/);
    expect(releaseCommand).toMatch(/--filter @passionedu\/ops-web test/);
    expect(releaseCommand).toMatch(/pnpm test:e2e/);
  });
});

describe('Finance Story 5.37 structural release checks (receivable kinds and extracurricular classes)', () => {
  // The release proof is the `pnpm test:release-gate` run (integration, web, E2E). These checks only guard structural contracts that
  // a behavioural test cannot see: what the browser may compute, what Finance may import, and what the migrations may touch.
  it('keeps VND arithmetic out of the finance browser sources', async () => {
    const files = ['finance-workspace.tsx', 'receipt-queue-workspace.tsx', 'extracurricular-classes-workspace.tsx'];
    // Reviewed display-only uses of BigInt: number formatting, sign checks against 0n, and showing the absolute value of ONE server figure.
    const reviewed = [
      /new Intl\.NumberFormat\("vi-VN"\)\.format\(BigInt\(value\)\)/g,
      /BigInt\((?:[^()]|\([^()]*\))*\)\s*(?:<=|>=|===|!==|<|>)\s*0n/g,
      /\(-BigInt\((?:[^()]|\([^()]*\))*\)\)\.toString\(\)/g,
    ];
    for (const file of files) {
      const text = await source(`apps/web/src/finance/${file}`);
      const unreviewed = reviewed.reduce((rest, pattern) => rest.replace(pattern, ''), text);
      expect(unreviewed, `${file} must not do arithmetic on money in the browser`).not.toMatch(/BigInt\(/);
      expect(text).not.toMatch(/\.reduce\([^)]*\+/);
      expect(text).not.toMatch(/Math\.(?:round|floor|ceil)/);
    }
    // Reports only turn server figures into mark sizes; every label shows the server value (documented in the chart module).
    expect(await source('apps/web/src/finance/finance-report-charts.tsx')).toMatch(/numbers are only used to size marks, every label shows the server value/);
  });

  it('adds no Parent or Teacher dependency to Finance', async () => {
    const [extracurricularWorkspace, financeWorkspace, financeService, financeController] = await Promise.all([
      source('apps/web/src/finance/extracurricular-classes-workspace.tsx'),
      source('apps/web/src/finance/finance-workspace.tsx'),
      source('apps/api/src/modules/finance/finance.service.ts'),
      source('apps/api/src/modules/finance/finance.controller.ts'),
    ]);
    for (const text of [extracurricularWorkspace, financeWorkspace, financeService, financeController]) expect(text).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
  });

  it('does not change Class or staff authorization', async () => {
    const [financeService, schema] = await Promise.all([source('apps/api/src/modules/finance/finance.service.ts'), source('apps/api/prisma/schema.prisma')]);
    // The one pre-existing exception is a Class's default bank account, which is Finance data (Story 5.x), not authorization.
    const authorizationScan = financeService.replace(/async setClassDefaultBankAccount[\s\S]*?\n  \}\n/, '');
    expect(authorizationScan).not.toMatch(/\.(?:class|enrollmentClassAssignment|staffClassAssignment|staffProfile|schoolPosition|positionCapabilityGrant)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    expect(authorizationScan).not.toMatch(/staffClassAssignment/);
    const aggregates = [...schema.matchAll(/model (ExtracurricularClass|ExtracurricularClassLifecycleTransition|ExtracurricularMembership|CollectionRunExtracurricularExclusion|CollectionRunTemplateScopeClass|CollectionRunTemplateScopeStudent) \{[\s\S]*?\n\}/g)].map((match) => match[0]).join('\n');
    expect(aggregates.length).toBeGreaterThan(0);
    expect(aggregates).not.toMatch(/StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant|EnrollmentClassAssignment/);
    // Decision 2026-10-08 adds the Class default School account, a Finance setting next to defaultBankAccountId, not authorization.
    const names = (await readdir(new URL('apps/api/prisma/migrations/', `file://${root}/`))).filter((name) => name >= '20261002000001' && name !== '20261008000004_class_default_school_bank_account').sort();
    expect(names.length).toBeGreaterThan(0);
    const migrations = (await Promise.all(names.map((name) => source(`apps/api/prisma/migrations/${name}/migration.sql`)))).join('\n');
    expect(migrations).not.toMatch(/ALTER TABLE "(?:Class|EnrollmentClassAssignment|StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant)"/);
    expect(migrations).not.toMatch(/(?:CREATE|DROP) (?:CONSTRAINT )?TRIGGER[^;]*ON "(?:Class|EnrollmentClassAssignment|StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant)"/);
  });
});
