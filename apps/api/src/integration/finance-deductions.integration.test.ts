import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";
import { SettingsService } from "../modules/settings/settings.service.js";

// Decision 2026-10-01: a receivable has a refund price; the month N run proposes "Bớt" = the approved
// leave days of month N-1 x refund price, and Finance may overwrite it with a reason.
const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const finance = new FinanceService(prisma, authorization);
const settings = new SettingsService(prisma, authorization);
const schools: string[] = [];
const parents: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const id = (value: { outcome: unknown }) => (value.outcome as { id: string }).id;

async function school() {
  const created = await prisma.school.create({ data: { name: "Deductions", slug: `deductions-${uuid()}`, studentCodePrefix: "DE" } });
  schools.push(created.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: created.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: created.id, code: `FIN_${uuid().slice(0, 8)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE", "SETTINGS_MANAGE"].map((capability) => ({ schoolId: created.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: created.id, fullName: "Finance", email: identity.emailNormalized, phone: "0900000000", dateOfBirth: date("1990-01-01"), primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  const year = await prisma.schoolYear.create({ data: { schoolId: created.id, name: "2026", startsOn: date("2026-01-01"), endsOn: date("2027-01-01") } });
  const classroom = await prisma.class.create({ data: { schoolId: created.id, schoolYearId: year.id, name: "Mầm 4A" } });
  await prisma.financePolicy.create({ data: { schoolId: created.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: identity.id, membershipId: membership.id } });
  await prisma.schoolCalendarVersion.create({ data: { schoolId: created.id, effectiveFrom: date("2026-01-01"), actorIdentityId: identity.id, membershipId: membership.id } });
  const groupId = id(await finance.createGroup(identity.id, created.id, uuid(), uuid(), { name: "Khoản thu chung" }));
  return { school: created, identity, membership, year, classroom, groupId };
}
type School = Awaited<ReturnType<typeof school>>;

async function student(input: School, name = "Nguyễn Minh Anh") {
  const created = await prisma.student.create({ data: { schoolId: input.school.id, studentCode: `HS-${uuid().slice(0, 8)}`, fullName: name, dateOfBirth: date("2022-01-01") } });
  const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: input.school.id, studentId: created.id, schoolYearId: input.year.id, classId: input.classroom.id, lifecycle: "ENROLLED", effectiveFrom: date("2026-01-01"), schoolYearName: input.year.name, schoolYearStartsOn: input.year.startsOn, schoolYearEndsOn: input.year.endsOn, className: input.classroom.name } });
  await prisma.enrollmentClassAssignment.create({ data: { schoolId: input.school.id, enrollmentId: enrollment.id, schoolYearId: input.year.id, classId: input.classroom.id, effectiveFrom: date("2026-01-01"), reason: "Deductions test" } });
  return created;
}

// An approved leave request issues one immutable LeaveDaySource per operating day.
async function leave(input: School, studentId: string, days: string[], status: "APPROVED" | "AUTO_APPROVED" = "APPROVED") {
  const parent = await prisma.parentProfile.create({ data: { fullName: "Phụ huynh", phone: "0911111111" } });
  parents.push(parent.id);
  await prisma.studentParent.create({ data: { schoolId: input.school.id, studentId, parentProfileId: parent.id } });
  const request = await prisma.leaveRequest.create({ data: { schoolId: input.school.id, studentId, parentProfileId: parent.id, status, policyEffectiveFrom: date("2026-01-01"), policyDeadlineLocalTime: "20:00", ...(status === "APPROVED" ? { decidedAt: new Date(), decidedByMembershipId: input.membership.id } : {}) } });
  await prisma.leaveRequestDay.createMany({ data: days.map((day) => ({ schoolId: input.school.id, leaveRequestId: request.id, operatingOn: date(day), calendarEffectiveFrom: date("2026-01-01") })) });
  await prisma.leaveDaySource.createMany({ data: days.map((day) => ({ schoolId: input.school.id, studentId, operatingOn: date(day), leaveRequestId: request.id, leaveStatus: status })) });
}

async function receivable(input: School, displayName: string, defaultUnitPrice: string, extra: Record<string, string> = {}) {
  return id(await finance.createReceivable(input.identity.id, input.school.id, uuid(), uuid(), { groupId: input.groupId, displayName, unitLabel: "ngày", defaultUnitPrice, ...extra }));
}

async function account(input: School, kind: "SCHOOL" | "PERSONAL", accountNumber: string) {
  return id(await settings.createBankAccount(input.identity.id, input.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber, accountHolderName: `Chủ ${accountNumber}`, transferTemplate: "{{studentName}} {{className}}", kind }));
}

async function generatedRun(input: School, lines: Array<{ receivableId: string; quantity: string }>, billingMonth: string) {
  const runId = id(await finance.openRun(input.identity.id, input.school.id, uuid(), uuid(), { schoolYearId: input.year.id, billingMonth }));
  let version = (await finance.run(input.identity.id, input.school.id, runId)).version;
  for (const line of lines) version = (await finance.saveTemplateLine(input.identity.id, input.school.id, runId, uuid(), uuid(), { ...line, expectedVersion: version }) as any).outcome.version;
  const preview = await finance.preview(input.identity.id, input.school.id, runId);
  await finance.readyRun(input.identity.id, input.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const queued = await finance.generateRun(input.identity.id, input.school.id, runId, uuid(), uuid());
  while ((await finance.operation(input.identity.id, input.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
  const generated = await finance.operation(input.identity.id, input.school.id, queued.id);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  return { runId, preview };
}

afterEach(async () => {
  const ids = schools.splice(0);
  const parentIds = parents.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    for (const model of ["auditRecord", "financeLedgerEvent", "collectionRunGenerationItem", "collectionRunGeneration", "issuedPromotionApplication", "debtTransfer", "settlementTransfer", "invoicePayout", "invoiceLine", "settlementCarry", "settlementDifference", "receipt", "invoice", "collectionRunTemplateLine", "collectionRunLifecycleTransition", "collectionRun", "bankAccountLifecycleTransition", "bankAccount", "financePolicy", "receivableLifecycleTransition", "receivableGroupLifecycleTransition", "receivable", "receivableGroup", "leaveDaySource", "leaveRequestDay", "leaveRequest", "studentParent", "schoolCalendarVersion", "enrollmentClassAssignment", "studentEnrollment", "student", "class", "schoolYear", "operation", "staffProfile", "positionCapabilityGrant", "schoolPosition", "schoolMembership"] as const)
      await (tx as any)[model].deleteMany({ where: { schoolId: { in: ids } } });
    await tx.parentProfile.deleteMany({ where: { id: { in: parentIds } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("finance leave-day deductions", () => {
  it("stores and audits a refund price that may exceed the charged price", async () => {
    const current = await school();
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    expect((await finance.read(current.identity.id, current.school.id)).receivables[0]).toMatchObject({ id: meals, defaultUnitPrice: "35000", refundUnitPrice: "28000" });
    const tuition = await receivable(current, "Học phí", "100000");
    expect((await finance.read(current.identity.id, current.school.id)).receivables.find((item) => item.id === tuition)).toMatchObject({ refundUnitPrice: "0" });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: current.groupId, displayName: "Sai", unitLabel: "ngày", defaultUnitPrice: "1", refundUnitPrice: "-1" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
    const changed: any = await finance.updateReceivableRefundPrice(current.identity.id, current.school.id, meals, uuid(), uuid(), { refundUnitPrice: "50000" });
    expect(changed.outcome).toMatchObject({ refundUnitPrice: "50000" });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "RECEIVABLE_REFUND_PRICE_CHANGED" } })).toBe(1);
    await expect(finance.updateReceivableRefundPrice(current.identity.id, current.school.id, meals, uuid(), uuid(), { refundUnitPrice: "50000" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
    // The catalog stays append-only apart from the tax category and the refund price.
    await expect(prisma.receivable.update({ where: { id: meals }, data: { defaultUnitPrice: 1n } })).rejects.toThrow(/append-only/);
    await expect(prisma.receivable.update({ where: { id: meals }, data: { refundUnitPrice: -1n } })).rejects.toThrow(/Receivable_refundUnitPrice_nonnegative/);
  });

  it("proposes Bớt from last month's approved leave days of the same Student only", async () => {
    const current = await school();
    const pupil = await student(current);
    const other = await student(current, "Trần Văn B");
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    const tuition = await receivable(current, "Học phí", "1500000", { taxCategory: "VAT_5" });
    await leave(current, pupil.id, ["2026-09-04", "2026-09-15"]);
    await leave(current, pupil.id, ["2026-09-16"], "AUTO_APPROVED");
    await leave(current, pupil.id, ["2026-10-05"]); // the billing month itself is refunded next month
    await leave(current, other.id, ["2026-09-04"]);
    const { runId, preview } = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "22" }], "2026-10");
    const previewMeals = preview.eligible.find((row: any) => row.studentId === pupil.id)!.lines.find((line: any) => line.receivableId === meals);
    expect(previewMeals).toMatchObject({ deductionQuantity: "3", deductionAmount: "84000", netAmount: "686000" });
    const lines = await prisma.invoiceLine.findMany({ where: { schoolId: current.school.id, receivableId: meals, invoice: { collectionRunId: runId } }, include: { invoice: true } });
    const mine = lines.find((line) => line.invoice.studentId === pupil.id)!;
    expect(mine).toMatchObject({ grossAmount: 770000n, refundUnitPriceSnapshot: 28000n, deductionQuantity: 3, proposedDeductionQuantity: 3, deductionAmount: 84000n, netAmount: 686000n, amount: 686000n });
    expect(mine.deductionSource).toMatchObject({ type: "LEAVE_DAYS_V1", month: "2026-09", days: ["2026-09-04", "2026-09-15", "2026-09-16"], proposedUnitPrice: "28000" });
    expect(mine.invoice.total).toBe(686000n);
    expect(lines.find((line) => line.invoice.studentId === other.id)).toMatchObject({ deductionQuantity: 1, deductionAmount: 28000n });
    // A receivable without a refund price has no proposal and no source.
    const tuitionLine = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, receivableId: tuition, invoice: { studentId: pupil.id, collectionRunId: runId } } });
    expect(tuitionLine).toMatchObject({ deductionQuantity: 0, deductionAmount: 0n, deductionSource: null });
  });

  it("adds a Thu 0 line for a receivable refunded on last month's issued Invoice but not charged this month", async () => {
    const current = await school();
    const pupil = await student(current);
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    const tuition = await receivable(current, "Học phí", "1500000");
    const personal = await account(current, "PERSONAL", "215000002088");
    const september = await generatedRun(current, [{ receivableId: meals, quantity: "21" }], "2026-09");
    const septemberInvoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: september.runId } });
    await finance.issueInvoice(current.identity.id, current.school.id, septemberInvoice.id, uuid(), uuid(), { personalBankAccountId: personal });
    await leave(current, pupil.id, ["2026-09-21", "2026-09-22"]);
    const october = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }], "2026-10");
    const refundOnly = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, receivableId: meals, invoice: { collectionRunId: october.runId } } });
    expect(refundOnly).toMatchObject({ quantity: 0, grossAmount: 0n, deductionQuantity: 2, deductionAmount: 56000n, netAmount: -56000n, amount: -56000n });
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { id: refundOnly.invoiceId } });
    expect(invoice.total).toBe(1500000n - 56000n);
  });

  it("lets Finance overwrite the proposal with a reason, reset it and go below zero with signed VAT", async () => {
    const current = await school();
    const pupil = await student(current);
    const tuition = await receivable(current, "Học phí", "1000000", { taxCategory: "VAT_5", refundUnitPrice: "50000" });
    await leave(current, pupil.id, ["2026-09-04", "2026-09-05"]);
    const { runId } = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }], "2026-10");
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId }, include: { lines: true } });
    const line = invoice.lines[0]!;
    expect(line).toMatchObject({ deductionQuantity: 2, deductionAmount: 100000n, netAmount: 900000n, vatAmount: 45000n, amount: 945000n });
    const edit = (body: Record<string, unknown>) => finance.editLineDeduction(current.identity.id, current.school.id, invoice.id, line.id, uuid(), uuid(), body);
    await expect(edit({ deductionQuantity: "3", refundUnitPrice: "50000" })).rejects.toMatchObject({ response: { fieldErrors: { reason: expect.any(String) } } });
    // Same as the proposal: no reason needed and none stored.
    await edit({ deductionQuantity: "2", refundUnitPrice: "50000" });
    expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ deductionReason: null });
    const changed: any = await edit({ deductionQuantity: "22", refundUnitPrice: "50000", reason: "Nghỉ 2 tuần, giảm theo chính sách trường" });
    expect(changed.status).toBe("COMPLETED");
    // 1.000.000 - 22 x 50.000 = -100.000; VAT 5% of a negative net is -5.000.
    expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ deductionQuantity: 22, proposedDeductionQuantity: 2, deductionAmount: 1100000n, netAmount: -100000n, vatAmount: -5000n, amount: -105000n, deductionReason: "Nghỉ 2 tuần, giảm theo chính sách trường" });
    expect((await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).total).toBe(-105000n);
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_LINE_DEDUCTION_EDITED" } })).toBe(2);
    // Editing the charged quantity keeps the manual deduction.
    await finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, uuid(), uuid(), { quantity: "2" });
    expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ grossAmount: 2000000n, deductionAmount: 1100000n, netAmount: 900000n, vatAmount: 45000n });
    await edit({ reset: true });
    expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ deductionQuantity: 2, deductionAmount: 100000n, netAmount: 1900000n, deductionReason: null });
    // PostgreSQL rejects a deduction that is not refund price x quantity, and a VAT not following the signed rule.
    await expect(prisma.invoiceLine.update({ where: { id: line.id }, data: { deductionAmount: 1n } })).rejects.toThrow();
    await expect(prisma.invoiceLine.update({ where: { id: line.id }, data: { deductionQuantity: 42, deductionAmount: 2100000n, netAmount: -100000n, vatAmount: -4999n, amount: -104999n } })).rejects.toThrow(/InvoiceLine_vat_snapshot/);
  });

  it("refuses editing the deduction of another School's Invoice", async () => {
    const current = await school();
    const foreign = await school();
    await student(foreign);
    const meals = await receivable(foreign, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    const { runId } = await generatedRun(foreign, [{ receivableId: meals, quantity: "20" }], "2026-10");
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: foreign.school.id, collectionRunId: runId }, include: { lines: true } });
    await expect(finance.editLineDeduction(current.identity.id, current.school.id, invoice.id, invoice.lines[0]!.id, uuid(), uuid(), { deductionQuantity: "1", refundUnitPrice: "1", reason: "x" })).rejects.toMatchObject({ status: 404 });
  });

  it("issues a negative Invoice as a refund notice closed only by one exact payout", async () => {
    const current = await school();
    const pupil = await student(current);
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "40000" });
    const personal = await account(current, "PERSONAL", "215000002088");
    await leave(current, pupil.id, ["2026-09-04", "2026-09-05", "2026-09-07"]);
    const { runId } = await generatedRun(current, [{ receivableId: meals, quantity: "2" }], "2026-10");
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
    // 2 x 35.000 - 3 x 40.000 = -50.000: the School owes the parent.
    expect(invoice.total).toBe(-50000n);
    await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { personalBankAccountId: personal });
    const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(issued).toMatchObject({ status: "ISSUED", obligationTotalSnapshot: -50000n });
    // The image is a refund notice without VietQR.
    const image = await finance.paymentImage(current.identity.id, current.school.id, invoice.id);
    expect(image.png.length).toBeGreaterThan(1000);
    // A Receipt never closes a refund; the payout must be exact and is recorded once.
    await expect(finance.closeInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { actualAmount: "0" })).rejects.toMatchObject({ response: { code: "INVOICE_REFUND_REQUIRES_PAYOUT" } });
    const queue = await finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: "2026-10", direction: "REFUND" });
    expect(queue.invoices).toEqual([expect.objectContaining({ id: invoice.id, outstanding: "-50000", direction: "REFUND" })]);
    expect((await finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: "2026-10", direction: "COLLECT" })).invoices).toEqual([]);
    await expect(finance.recordPayout(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { paidOn: "2026-10-12", method: "CHEQUE", reference: "x" })).rejects.toMatchObject({ response: { fieldErrors: { method: expect.any(String) } } });
    const key = uuid(), operationId = uuid();
    const body = { paidOn: "2026-10-12", method: "BANK_TRANSFER", reference: "FT26285123456" };
    const paid: any = await finance.recordPayout(current.identity.id, current.school.id, invoice.id, key, operationId, body);
    expect(paid.outcome).toMatchObject({ status: "CLOSED", payout: { amount: "50000", paidOn: "2026-10-12", method: "BANK_TRANSFER", reference: "FT26285123456" } });
    // Retry with the same key replays the Operation; a second payout is refused.
    expect((await finance.recordPayout(current.identity.id, current.school.id, invoice.id, key, operationId, body) as any).id).toBe(operationId);
    await expect(finance.recordPayout(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), body)).rejects.toMatchObject({ response: { code: "INVOICE_NOT_ISSUED" } });
    expect(await prisma.financeLedgerEvent.findFirst({ where: { schoolId: current.school.id, type: "PAYOUT_POSTED" } })).toMatchObject({ amount: -50000n, invoiceId: invoice.id });
    await expect(prisma.invoicePayout.updateMany({ where: { invoiceId: invoice.id }, data: { reference: "khác" } })).rejects.toThrow(/immutable/);
  });

  it("closes a zero-total Invoice at issue and refuses a payout on a positive Invoice", async () => {
    const current = await school();
    const pupil = await student(current);
    const other = await student(current, "Trần Văn B");
    const meals = await receivable(current, "Tiền ăn", "40000", { refundUnitPrice: "40000" });
    const personal = await account(current, "PERSONAL", "215000002088");
    await leave(current, pupil.id, ["2026-09-04", "2026-09-05"]);
    const { runId } = await generatedRun(current, [{ receivableId: meals, quantity: "2" }], "2026-10");
    const zero = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: pupil.id } });
    expect(zero.total).toBe(0n);
    await finance.issueInvoice(current.identity.id, current.school.id, zero.id, uuid(), uuid(), { personalBankAccountId: personal });
    expect(await prisma.invoice.findUniqueOrThrow({ where: { id: zero.id }, include: { receipt: true } })).toMatchObject({ status: "CLOSED", receipt: { actualAmount: 0n, outcome: "EXACT" } });
    const positive = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: other.id } });
    await finance.issueInvoice(current.identity.id, current.school.id, positive.id, uuid(), uuid(), { personalBankAccountId: personal });
    await expect(finance.recordPayout(current.identity.id, current.school.id, positive.id, uuid(), uuid(), { paidOn: "2026-10-12", method: "CASH", reference: "Tiền mặt" })).rejects.toMatchObject({ response: { code: "INVOICE_NOT_REFUND" } });
  });
});
