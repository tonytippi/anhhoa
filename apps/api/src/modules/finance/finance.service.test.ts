import { describe, expect, it, vi } from 'vitest';
import { FinanceService } from './finance.service.js';

const actor = { membershipId: 'membership' };
const authorization = { resolve: vi.fn().mockResolvedValue(actor) };

describe('FinanceService validation', () => {
  it('rejects invalid VND, group graph ID, lifecycle, and idempotency before writes', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    const school = crypto.randomUUID();
    await expect(service.createReceivable('identity', school, crypto.randomUUID(), crypto.randomUUID(), { groupId: 'not-uuid', displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '1000' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { groupId: expect.any(String) } } });
    await expect(service.createReceivable('identity', school, crypto.randomUUID(), crypto.randomUUID(), { groupId: crypto.randomUUID(), displayName: 'Học phí', unitLabel: 'tháng', defaultUnitPrice: '1.5' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
    await expect(service.createGroup('identity', school, 'not-uuid', crypto.randomUUID(), { name: 'Học phí' })).rejects.toMatchObject({ status: 401, response: { code: 'IDEMPOTENCY_KEY_REQUIRED' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects unsupported public eligibility before an Operation or evidence mutation', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    const body = { studentId: crypto.randomUUID(), reason: 'TRANSFER_OUT', effectiveOn: '2026-10-10' };
    await expect(service.createCoverageRefundEligibility('identity', crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), body)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { reason: expect.any(String) } } });
    expect(prisma.operation.findFirst).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('serializes BigInt VND as a safe JSON integer string and scopes catalog reads by School', async () => {
    const prisma = { receivableGroup: { findMany: vi.fn().mockResolvedValue([{ id: 'group', name: 'Học phí', createdAt: new Date('2026-01-01T00:00:00Z'), lifecycleTransitions: [{ status: 'ACTIVE' }] }]) }, receivable: { findMany: vi.fn().mockResolvedValue([{ id: 'item', groupId: 'group', code: null, displayName: 'Tháng', unitLabel: 'tháng', defaultUnitPrice: 500000n, createdAt: new Date('2026-01-01T00:00:00Z'), lifecycleTransitions: [{ status: 'ACTIVE' }] }]) } };
    const school = crypto.randomUUID(); const result = await new FinanceService(prisma as never, authorization as never).read('identity', school);
    expect(result).toMatchObject({ groups: [{ status: 'ACTIVE' }], receivables: [{ defaultUnitPrice: '500000', status: 'ACTIVE' }] });
    expect(prisma.receivableGroup.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
    expect(prisma.receivable.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
  });
  it('marks an active Receivable unavailable when its Group is inactive', async () => {
    const prisma = { receivableGroup: { findMany: vi.fn().mockResolvedValue([]) }, receivable: { findMany: vi.fn().mockResolvedValue([{ id: 'item', groupId: 'group', code: null, displayName: 'Tháng', unitLabel: 'tháng', defaultUnitPrice: 500000n, createdAt: new Date(), lifecycleTransitions: [{ status: 'ACTIVE' }], group: { lifecycleTransitions: [{ status: 'INACTIVE' }] } }]) } };
    await expect(new FinanceService(prisma as never, authorization as never).read('identity', crypto.randomUUID())).resolves.toMatchObject({ receivables: [{ status: 'ACTIVE', available: false }] });
  });
  it('aggregates only same-School ledger facts at or before the normalized cutoff', async () => {
    const events = [{ id: 'issued', type: 'INVOICE_ISSUED', postedAt: new Date('2026-09-01T00:00:00.000Z'), amount: 0n, netAmount: 100n, billingMonth: '2026-09', invoiceId: 'invoice', provenance: {} }, { id: 'receipt', type: 'RECEIPT_POSTED', postedAt: new Date('2026-09-02T00:00:00.000Z'), amount: 90n, netAmount: 0n, billingMonth: '2026-09', invoiceId: 'invoice', provenance: {} }];
    const prisma = { financeLedgerEvent: { findMany: vi.fn().mockResolvedValue(events) } };
    const school = crypto.randomUUID(); const result = await new FinanceService(prisma as never, authorization as never).report('identity', school, 'overview', { asOf: '2026-09-03T00:00:00.000Z', billingMonth: '2026-09' });
    expect(result).toMatchObject({ timezone: 'Asia/Ho_Chi_Minh', reportDefinitionVersion: 'FINANCE_LEDGER_V3', summary: { netBilled: '100', actualReceipt: '90' } });
    expect(prisma.financeLedgerEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: school, postedAt: { lte: new Date('2026-09-03T00:00:00.000Z') }, billingMonth: '2026-09' }) }));
  });
  it('rejects ambiguous report cutoffs instead of silently choosing the current time', async () => {
    const service = new FinanceService({} as never, authorization as never);
    await expect(service.report('identity', crypto.randomUUID(), 'overview', { asOf: '2026-09-03T00:00' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { asOf: expect.any(String) } } });
  });
  it('replays an existing idempotent result and rejects an operation ID collision', async () => {
    const operation = { id: crypto.randomUUID(), fingerprint: expect.any(String), status: 'COMPLETED', outcome: { id: 'group' } };
    const prisma = { operation: { findFirst: vi.fn().mockResolvedValueOnce({ ...operation, fingerprint: undefined }).mockResolvedValueOnce(null) }, $transaction: vi.fn() };
    const key = crypto.randomUUID(); const input = { name: 'Học phí' };
    prisma.operation.findFirst.mockReset().mockResolvedValueOnce({ ...operation, fingerprint: JSON.stringify(input) });
    const { requestFingerprint } = await import('../common/mutation-protection.js');
    prisma.operation.findFirst.mockReset().mockResolvedValueOnce({ ...operation, fingerprint: requestFingerprint(input) });
    await expect(new FinanceService(prisma as never, authorization as never).createGroup('identity', crypto.randomUUID(), key, crypto.randomUUID(), input)).resolves.toMatchObject({ id: operation.id, outcome: { id: 'group' } });
  });
  it('returns issued BIGINT snapshots as JSON-safe strings without using live account data', async () => {
    const issuedAt = new Date('2026-09-21T00:00:00.000Z');
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice', schoolId: crypto.randomUUID(), status: 'ISSUED', total: 9007199254740991n, billingMonth: '2026-09', studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé Đỗ', classNameSnapshot: 'Lá 1', lines: [], issuedAt, obligationTotalSnapshot: 9007199254740991n, obligationLinesSnapshot: [{ amount: '9007199254740991' }], bankAccountIdSnapshot: 'bank', receivingBankSnapshot: 'Ngân hàng A', accountNumberSnapshot: '123', accountHolderNameSnapshot: 'Bé Đỗ', transferContentSnapshot: 'Be Do La 1', financePolicyEffectiveFrom: issuedAt, dueDaysAfterIssueSnapshot: 7, taxTreatmentSnapshot: 'NOT_APPLICABLE', debtScopeSnapshot: 'CURRENT_SCHOOL_YEAR_ONLY', reversalModeSnapshot: 'DIRECT', dueOn: new Date('2026-09-28T00:00:00.000Z') }) } };
    const result = await new FinanceService(prisma as never, authorization as never).invoice('identity', crypto.randomUUID(), '11111111-1111-4111-8111-111111111111');
    expect(result).toMatchObject({ status: 'ISSUED', total: '9007199254740991', issue: { obligationTotal: '9007199254740991', transferContent: 'Be Do La 1', bankAccount: { accountNumber: '123' }, policy: { dueDaysAfterIssue: 7 } } });
  });
  it('projects immutable coverage facts as server-returned JSON-safe Invoice data', async () => {
    const issuedAt = new Date('2026-09-21T00:00:00.000Z');
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice', schoolId: crypto.randomUUID(), status: 'CLOSED', total: 100n, billingMonth: '2026-09', studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé An', classNameSnapshot: 'Lá 1', lines: [], issuedAt, obligationTotalSnapshot: 100n, obligationLinesSnapshot: [], bankAccountIdSnapshot: 'bank', receivingBankSnapshot: 'A', accountNumberSnapshot: '1', accountHolderNameSnapshot: 'H', transferContentSnapshot: 'Be An', financePolicyEffectiveFrom: issuedAt, dueDaysAfterIssueSnapshot: 7, taxTreatmentSnapshot: 'NOT_APPLICABLE', debtScopeSnapshot: 'CURRENT_SCHOOL_YEAR_ONLY', reversalModeSnapshot: 'DIRECT', dueOn: new Date('2026-09-28T00:00:00.000Z'), coverageFacts: [{ receivableId: 'receivable', billingMonth: '2026-10', policyId: 'policy', versionId: 'version', originalPrice: 100n, reduction: 10n, serviceStart: new Date('2026-10-01T00:00:00.000Z'), serviceEnd: new Date('2026-11-01T00:00:00.000Z'), calendarEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'), timezone: 'Asia/Ho_Chi_Minh', issuedCoverage: { issuedAt } }] }) } };
    const result = await new FinanceService(prisma as never, authorization as never).invoice('identity', crypto.randomUUID(), '11111111-1111-4111-8111-111111111111');
    expect(result.coverageFacts).toEqual([expect.objectContaining({ billingMonth: '2026-10', originalPrice: '100', reduction: '10', timezone: 'Asia/Ho_Chi_Minh', issuedAt: issuedAt.toISOString() })]);
  });
  it('orders every projected Invoice line by amount descending then ID ascending', async () => {
    const prisma = { invoice: { findFirst: vi.fn().mockResolvedValue({ id: 'invoice', schoolId: crypto.randomUUID(), status: 'DRAFT', total: 12n, billingMonth: '2026-09', studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé Đỗ', classNameSnapshot: 'Lá 1', lines: [{ id: 'b', receivableId: 'b', receivableNameSnapshot: 'B', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 5n, unitPrice: 5n, quantity: 1, amount: 5n }, { id: 'a', receivableId: 'a', receivableNameSnapshot: 'A', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 5n, unitPrice: 5n, quantity: 1, amount: 5n }, { id: 'c', receivableId: 'c', receivableNameSnapshot: 'C', unitLabelSnapshot: 'lần', defaultUnitPriceSnapshot: 7n, unitPrice: 7n, quantity: 1, amount: 7n }] }) } };
    const result = await new FinanceService(prisma as never, authorization as never).invoice('identity', crypto.randomUUID(), '11111111-1111-4111-8111-111111111111');
    expect(result.lines.map((line: { id: string }) => line.id)).toEqual(['c', 'a', 'b']);
  });
  it('uses a bounded opaque cursor and deterministic CollectionRun and Invoice orders', async () => {
    const school = crypto.randomUUID(); const idA = '11111111-1111-4111-8111-111111111111'; const idB = '22222222-2222-4222-8222-222222222222';
    const run = (id: string, billingMonth: string) => ({ id, schoolId: school, schoolYearId: crypto.randomUUID(), billingMonth, type: 'MONTHLY', status: 'GENERATED', version: 1, selections: [], coverageSelections: [], templateLines: [], invoices: [{ id: idB, studentId: crypto.randomUUID(), studentCodeSnapshot: 'HS001', studentNameSnapshot: 'B', classNameSnapshot: 'Lá', status: 'DRAFT', total: 1n }, { id: idA, studentId: crypto.randomUUID(), studentCodeSnapshot: 'HS001', studentNameSnapshot: 'A', classNameSnapshot: 'Lá', status: 'DRAFT', total: 1n }], lifecycleTransitions: [], createdAt: new Date(), updatedAt: new Date() });
    const prisma = { collectionRun: { findMany: vi.fn().mockResolvedValue([run(idB, '2026-09'), run(idA, '2026-09')]), findFirst: vi.fn().mockResolvedValue({ id: idA }) } };
    const service = new FinanceService(prisma as never, authorization as never);
    const result = await service.runs('identity', school, { limit: '1' });
    expect(result.runs[0]?.invoices?.map((item: { id: string }) => item.id)).toEqual([idB, idA]);
    expect(result.meta.nextCursor).toBeTruthy();
    expect(prisma.collectionRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: school }), orderBy: [{ billingMonth: 'desc' }, { id: 'desc' }], take: 2 }));
    await expect(service.runs('identity', school, { limit: '101' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { limit: expect.any(String) } } });
    await expect(service.runs('identity', school, { cursor: 'not-a-cursor' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
    const foreignCursor = Buffer.from(JSON.stringify({ billingMonth: '2026-09', id: crypto.randomUUID() })).toString('base64url');
    prisma.collectionRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.runs('identity', school, { cursor: foreignCursor })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
    const excludedCursor = Buffer.from(JSON.stringify({ billingMonth: '2026-09', id: idA })).toString('base64url');
    prisma.collectionRun.findFirst.mockResolvedValueOnce(null);
    await expect(service.runs('identity', school, { status: 'CLOSED', cursor: excludedCursor })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
    const currentCursor = Buffer.from(JSON.stringify({ billingMonth: '2026-09', id: idA })).toString('base64url');
    prisma.collectionRun.findFirst.mockResolvedValueOnce({ id: idA });
    await service.runs('identity', school, { cursor: currentCursor, limit: '1' });
    expect(prisma.collectionRun.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: expect.objectContaining({ OR: [{ billingMonth: { lt: '2026-09' } }, { billingMonth: '2026-09', id: { lt: idA } }] }), take: 2 }));
  });
  it('returns only minimal issued receipt queue snapshots in stable issued order and rejects a filter-mismatched cursor', async () => {
    const school = crypto.randomUUID(); const id = crypto.randomUUID(); const issuedAt = new Date('2026-09-02T00:00:00.000Z');
    const prisma = { schoolYear: { findFirst: vi.fn() }, debtTransfer: { groupBy: vi.fn().mockResolvedValue([]) }, invoice: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([{ id, studentCodeSnapshot: 'HS001', studentNameSnapshot: 'Bé An', classIdSnapshot: crypto.randomUUID(), classNameSnapshot: 'Lá 1', schoolYearId: crypto.randomUUID(), billingMonth: '2026-09', issuedAt, obligationTotalSnapshot: 120000n }]) } };
    const service = new FinanceService(prisma as never, authorization as never);
    const result = await service.receiptQueue('identity', school, { billingMonth: '2026-09' });
    expect(result.invoices).toEqual([expect.objectContaining({ status: 'ISSUED', outstanding: '120000', student: { code: 'HS001', name: 'Bé An' } })]);
    expect(result.invoices[0]).not.toHaveProperty('lines');
    expect(prisma.invoice.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ schoolId: school, status: 'ISSUED', billingMonth: '2026-09' }), orderBy: [{ issuedAt: 'asc' }, { id: 'asc' }], take: 26 }));
    const cursor = Buffer.from(JSON.stringify({ id, issuedAt: issuedAt.toISOString(), filters: { schoolYearId: null, billingMonth: '2026-08', classIdSnapshot: null, student: null } })).toString('base64url');
    await expect(service.receiptQueue('identity', school, { billingMonth: '2026-09', cursor })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
  });
  it('only projects active same-School bank accounts', async () => {
    const prisma = { bankAccount: { findMany: vi.fn().mockResolvedValue([{ id: 'active', receivingBank: 'A', accountNumber: '1', accountHolderName: 'Holder', lifecycleTransitions: [{ status: 'ACTIVE' }] }, { id: 'inactive', receivingBank: 'B', accountNumber: '2', accountHolderName: 'Old', lifecycleTransitions: [{ status: 'INACTIVE' }] }]) } };
    const school = crypto.randomUUID(); const result = await new FinanceService(prisma as never, authorization as never).bankAccounts('identity', school);
    expect(result).toEqual({ accounts: [{ id: 'active', receivingBank: 'A', accountNumber: '1', accountHolderName: 'Holder' }] });
    expect(prisma.bankAccount.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
  });
  it('requires a close reason before creating an Operation', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const school = crypto.randomUUID(); const run = crypto.randomUUID();
    await expect(new FinanceService(prisma as never, authorization as never).closeRun('identity', school, run, crypto.randomUUID(), crypto.randomUUID(), {})).rejects.toMatchObject({ status: 400, response: { fieldErrors: { reason: expect.any(String) } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid actual receipt amounts before opening a settlement transaction', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    for (const actualAmount of ['-1', '1.5', 'not-money', '9007199254740992']) {
      await expect(service.closeInvoice('identity', crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), { actualAmount })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { actualAmount: expect.any(String) } } });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid prior-debt transfer inputs before opening a transaction', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never); const school = crypto.randomUUID(); const invoice = crypto.randomUUID();
    await expect(service.transferDebt('identity', school, crypto.randomUUID(), crypto.randomUUID(), { sourceInvoiceId: invoice, targetInvoiceId: crypto.randomUUID(), amount: '0', reason: 'Đối soát' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { amount: expect.any(String) } } });
    await expect(service.transferDebt('identity', school, crypto.randomUUID(), crypto.randomUUID(), { sourceInvoiceId: invoice, targetInvoiceId: invoice, amount: '1', reason: 'Đối soát' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { targetInvoiceId: expect.any(String) } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid template quantities before opening a transaction', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    const school = crypto.randomUUID();
    const run = crypto.randomUUID();
    const receivable = crypto.randomUUID();
    for (const quantity of ['0', '-1', '1.5', 'không phải số']) {
      await expect(service.saveTemplateLine('identity', school, run, crypto.randomUUID(), crypto.randomUUID(), { receivableId: receivable, quantity, expectedVersion: 1 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects invalid promotion rule, duplicate targets, and an empty assignment batch before writing', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    const school = crypto.randomUUID(); const receivable = crypto.randomUUID(); const version = crypto.randomUUID();
    await expect(service.createPromotionPolicy('identity', school, crypto.randomUUID(), crypto.randomUUID(), { name: 'Con cán bộ', receivableIds: [receivable, receivable], discountType: 'PERCENTAGE', discountValue: '10', priority: '1', stackingMode: 'STACKABLE', effectiveFrom: '2026-09-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
    await expect(service.createPromotionPolicy('identity', school, crypto.randomUUID(), crypto.randomUUID(), { name: 'Con cán bộ', receivableIds: [receivable], discountType: 'PERCENTAGE', discountValue: '101', priority: '1', stackingMode: 'STACKABLE', effectiveFrom: '2026-09-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { discountValue: expect.any(String) } } });
    await expect(service.assignPromotionStudents('identity', school, version, crypto.randomUUID(), crypto.randomUUID(), { studentIds: [], effectiveFrom: '2026-09-01', reason: 'Nhân viên' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { studentIds: expect.any(String) } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects an equal persisted exclusive promotion interval on effectiveTo', async () => {
    const prisma = { operation: { findFirst: vi.fn() }, $transaction: vi.fn() };
    const service = new FinanceService(prisma as never, authorization as never);
    await expect(service.createPromotionPolicy('identity', crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), { name: 'Con cán bộ', receivableIds: [crypto.randomUUID()], discountType: 'PERCENTAGE', discountValue: '10', priority: '1', stackingMode: 'STACKABLE', effectiveFrom: '2026-09-02', effectiveTo: '2026-09-01' })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveTo: expect.any(String) } } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('projects half-open promotion intervals as inclusive UI dates', async () => {
    const prisma = { promotionPolicy: { findMany: vi.fn().mockResolvedValue([{ id: 'policy', name: 'Con cán bộ', versions: [{ id: 'version', version: 1, status: 'ACTIVE', discountType: 'PERCENTAGE', discountValue: 10n, priority: 1, stackingMode: 'STACKABLE', effectiveFrom: new Date('2026-09-01T00:00:00Z'), effectiveTo: new Date('2026-10-01T00:00:00Z'), targets: [], assignments: [{ id: 'assignment', studentId: 'student', effectiveFrom: new Date('2026-09-01T00:00:00Z'), effectiveTo: new Date('2026-09-16T00:00:00Z'), reason: 'Nhân viên', endReason: 'Kết thúc', student: { fullName: 'Bé An', studentCode: 'HS001' } }] }] }]) } };
    const school = crypto.randomUUID();
    const result = await new FinanceService(prisma as never, authorization as never).promotionPolicies('identity', school);
    expect(result.policies[0]?.versions[0]).toMatchObject({ effectiveTo: '2026-09-30', assignments: [{ effectiveTo: '2026-09-15' }] });
    expect(prisma.promotionPolicy.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school } }));
  });
  it('evaluates fixed before percentage with deterministic priority, exclusivity, and a gross cap', () => {
    const service = new FinanceService({} as never, authorization as never) as any;
    const line = { receivableId: 'receivable', amount: '100' };
    const fact = (policyId: string, discountType: string, discountValue: bigint, priority: number, stackingMode = 'STACKABLE') => ({ policyId, versionId: `${policyId}-version`, targetId: `${policyId}-target`, assignmentId: `${policyId}-assignment`, assignmentReason: 'Được duyệt', studentId: 'student', receivableId: 'receivable', discountType, discountValue, priority, stackingMode });
    const result = service.evaluatePromotionLine('student', line, [
      fact('percentage-high', 'PERCENTAGE', 50n, 9),
      fact('fixed-low', 'FIXED_VND', 80n, 1),
      fact('fixed-high', 'FIXED_VND', 30n, 9),
      fact('exclusive', 'PERCENTAGE', 50n, 1, 'EXCLUSIVE'),
      fact('after-exclusive', 'PERCENTAGE', 1n, 99),
    ]);
    expect(result).toMatchObject({ grossAmount: '100', discountAmount: '50', netAmount: '50' });
    expect(result.promotionEvaluation.applications.map((item: { policyId: string }) => item.policyId)).toEqual(['exclusive']);
    expect(result.promotionEvaluation.applications.every((item: { appliedDiscount: string }) => BigInt(item.appliedDiscount) >= 0n)).toBe(true);
  });
  it('applies only the highest-priority percentage after all fixed reductions', () => {
    const service = new FinanceService({} as never, authorization as never) as any;
    const fact = (policyId: string, discountType: string, discountValue: bigint, priority: number) => ({ policyId, versionId: `${policyId}-version`, targetId: `${policyId}-target`, assignmentId: `${policyId}-assignment`, assignmentReason: 'Được duyệt', studentId: 'student', receivableId: 'receivable', discountType, discountValue, priority, stackingMode: 'STACKABLE' });
    const result = service.evaluatePromotionLine('student', { receivableId: 'receivable', amount: '100' }, [
      fact('fixed', 'FIXED_VND', 20n, 1),
      fact('percentage-low', 'PERCENTAGE', 80n, 1),
      fact('percentage-high', 'PERCENTAGE', 50n, 2),
    ]);
    expect(result).toMatchObject({ discountAmount: '60', netAmount: '40' });
    expect(result.promotionEvaluation.applications.map((item: { policyId: string }) => item.policyId)).toEqual(['fixed', 'percentage-high']);
  });
});
