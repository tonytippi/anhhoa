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

describe('Finance Story 5.37 release evidence (receivable kinds and extracurricular classes)', () => {
  it('requires the PostgreSQL evidence for typed groups, scopes, memberships, extracurricular billing, staleness, concurrency and provenance', async () => {
    const [finance, classes, kinds, provision, bootstrap] = await Promise.all([
      source('apps/api/src/integration/finance.integration.test.ts'),
      source('apps/api/src/integration/extracurricular-classes.integration.test.ts'),
      source('apps/api/src/integration/receivable-group-kinds.integration.test.ts'),
      source('apps/api/src/integration/ops.provision.integration.test.ts'),
      source('apps/api/src/integration/bootstrap.integration.test.ts'),
    ]);
    for (const evidence of [
      /keeps exactly three typed groups per School and refuses to create, rename, retype or remove one/,
      /creates a Receivable by kind in the selected School and rejects unknown kinds and foreign or mismatched groups/,
      /changes the kind of an unused Receivable with audit and refuses once an Invoice line or template line uses it/,
      /serializes kind change against template-line creation in both directions/,
      /serializes kind change against invoice-line creation in both directions/,
      /seeds a new run with every ACTIVE FIXED receivable/,
      /validates scope: EXTRACURRICULAR refused, FIXED forced to ALL, empty\/foreign\/other-year targets refused/,
      /resolves class scope on the first day of the month, reports per-line counts and subtotals, and goes stale on any scope change/,
      /skips eligible Students with no applicable line as NO_APPLICABLE_LINES/,
      /guards template scope targets on every write and enforces the scope shape at commit/,
      /serializes run seeding with a receivable deactivation/,
      /lists extracurricular classes with month members and bills merged lines with MID_MONTH and CLASS_CHANGE flags/,
      /blocks READY on membership and receivable changes after the preview/,
      /generates extracurricular lines with immutable provenance/,
      /makes READY wait for an in-flight membership change and then sees it/,
      /Promise\.allSettled\(/,
      /IDEMPOTENCY_CONFLICT/,
    ]) expect(finance).toMatch(evidence);
    for (const evidence of [
      /creates classes for ACTIVE EXTRACURRICULAR Receivables only, shares a Receivable and locks its kind/,
      /adds and ends memberships singly and in bulk with one audit per membership, refusing overlap and committing all-or-nothing/,
      /keeps memberships inside the enrollment interval on add and end/,
      /replays a bulk add by key, rejects a changed body and re-authorizes, and refuses foreign Schools without leaking facts/,
      /serializes competing commands: one concurrent membership add, class creation and rename wins/,
      /EXTRACURRICULAR_MEMBERSHIP_OVERLAP/,
    ]) expect(classes).toMatch(evidence);
    expect(kinds).toMatch(/maps legacy groups, removes custom groups and leaves exactly three typed groups per School, idempotently and with audit/);
    expect(provision).toMatch(/\['FIXED', 'Khoản thu cố định'\], \['FLEXIBLE', 'Khoản thu linh hoạt'\], \['EXTRACURRICULAR', 'Ngoại khóa'\]/);
    expect(bootstrap).toMatch(/\['FIXED', 'Khoản thu cố định'\]/);
  });

  it('keeps the Admin E2E on the full extracurricular flow and shows only server values', async () => {
    const e2e = await source('apps/web/e2e/finance-release-gate.spec.ts');
    for (const step of [
      /Thêm lớp ngoại khóa/, /Chọn tất cả học sinh có thể thêm/, /Dùng chung với: Tiếng Anh A1 \(T2-T4\)\./, /Hiệu lực từ'\)\.fill\('2026-11-16'\)/,
      /Loại khỏi đợt này/, /Khôi phục/, /Tự thêm khi mở đợt thu/, /Linh hoạt · Lớp chính thức: Mầm Release 1/,
      /Tạm tính theo dòng khoản thu/, /Ngoại khóa · Tiếng Anh A1 \(T2-T4\) → Tiếng Anh A2 \(T3-T5\)/, /Chuyển lớp trong tháng/, /Vào\/nghỉ giữa tháng/,
      /toHaveCount\(1\)/, /Lưu điều chỉnh/, /Cố định/,
    ]) expect(e2e).toMatch(step);
  });

  it('adds no client-calculated VND, Parent or Teacher dependency, or Class/staff authorization change', async () => {
    const [extracurricularWorkspace, financeWorkspace, financeService, financeController, schema] = await Promise.all([
      source('apps/web/src/finance/extracurricular-classes-workspace.tsx'),
      source('apps/web/src/finance/finance-workspace.tsx'),
      source('apps/api/src/modules/finance/finance.service.ts'),
      source('apps/api/src/modules/finance/finance.controller.ts'),
      source('apps/api/prisma/schema.prisma'),
    ]);
    // The browser renders server totals only: no BigInt arithmetic between amounts, no reduce over money, no unit price multiplication.
    for (const web of [extracurricularWorkspace, financeWorkspace]) {
      expect(web).not.toMatch(/BigInt\([^)]*\)\s*[-+*/]\s*BigInt/);
      expect(web).not.toMatch(/\.reduce\([^)]*BigInt/);
      expect(web).not.toMatch(/defaultUnitPrice[^;\n]*\*|\*[^;\n]*defaultUnitPrice/);
      expect(web).not.toMatch(/Math\.(?:round|floor|ceil)/);
      expect(web).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
    }
    for (const server of [financeService, financeController]) expect(server).not.toMatch(/from ["'][^"']*(?:parent|teacher)[^"']*["']/i);
    // Finance neither writes Class/assignment/staff authorization rows nor reads StaffClassAssignment to decide anything.
    // The one pre-existing exception is a Class's default bank account, which is Finance data (Story 5.x), not authorization.
    const authorizationScan = financeService.replace(/async setClassDefaultBankAccount[\s\S]*?\n  \}\n/, '');
    expect(authorizationScan).not.toMatch(/\.(?:class|enrollmentClassAssignment|staffClassAssignment|staffProfile|schoolPosition|positionCapabilityGrant)\.(?:create|createMany|update|updateMany|upsert|delete|deleteMany)\(/);
    expect(authorizationScan).not.toMatch(/staffClassAssignment/);
    // The extracurricular aggregates and scope tables have no relation to staff authorization, and no migration of this change alters Class or staff tables.
    const aggregates = [...schema.matchAll(/model (ExtracurricularClass|ExtracurricularClassLifecycleTransition|ExtracurricularMembership|CollectionRunExtracurricularExclusion|CollectionRunTemplateScopeClass|CollectionRunTemplateScopeStudent) \{[\s\S]*?\n\}/g)].map((match) => match[0]).join('\n');
    expect(aggregates).not.toMatch(/StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant|EnrollmentClassAssignment/);
    const migrations = (await Promise.all(['20261001000005_negative_monthly_credit_carry']
      .concat(await readdir(new URL('apps/api/prisma/migrations/', `file://${root}/`)).then((names) => names.filter((name) => name >= '20261002000001').sort()))
      .filter((name) => name >= '20261002000001')
      .map((name) => source(`apps/api/prisma/migrations/${name}/migration.sql`)))).join('\n');
    expect(migrations).not.toMatch(/ALTER TABLE "(?:Class|EnrollmentClassAssignment|StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant)"/);
    expect(migrations).not.toMatch(/(?:CREATE|DROP) (?:CONSTRAINT )?TRIGGER[^;]*ON "(?:Class|EnrollmentClassAssignment|StaffClassAssignment|StaffProfile|SchoolPosition|PositionCapabilityGrant)"/);
  });
});
