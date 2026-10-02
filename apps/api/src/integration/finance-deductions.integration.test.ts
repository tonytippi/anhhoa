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
  await prisma.receivableGroup.createMany({ data: [{ schoolId: created.id, kind: "FIXED", name: "Khoản thu cố định" }, { schoolId: created.id, kind: "FLEXIBLE", name: "Khoản thu linh hoạt" }, { schoolId: created.id, kind: "EXTRACURRICULAR", name: "Ngoại khóa" }] });
  const groupId = (await prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: created.id, kind: "FLEXIBLE" } })).id;
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
    for (const model of ["auditRecord", "financeLedgerEvent", "collectionRunGenerationItem", "collectionRunGeneration", "issuedPromotionApplication", "debtTransfer", "settlementTransfer", "invoicePayout", "coverageReversal", "studentPromotionalCoverage", "invoicePromotionCoverageFact", "invoiceLine", "settlementCarry", "settlementDifference", "receipt", "invoice", "collectionRunTemplateLine", "collectionRunLifecycleTransition", "collectionRun", "bankAccountLifecycleTransition", "bankAccount", "financePolicy", "receivableLifecycleTransition", "receivableGroupLifecycleTransition", "receivable", "studentPromotionAssignment", "promotionPolicyTarget", "promotionPolicyVersion", "promotionPolicy", "receivableGroup", "leaveDaySource", "leaveRequestDay", "leaveRequest", "studentParent", "schoolCalendarVersion", "enrollmentClassAssignment", "studentEnrollment", "student", "class", "schoolYear", "operation", "staffProfile", "positionCapabilityGrant", "schoolPosition", "schoolMembership"] as const)
      await (tx as any)[model].deleteMany({ where: { schoolId: { in: ids } } });
    await tx.parentProfile.deleteMany({ where: { id: { in: parentIds } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("finance leave-day deductions", () => {
  it("stores and audits a refund price that never exceeds the charged price", async () => {
    const current = await school();
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    expect((await finance.read(current.identity.id, current.school.id)).receivables[0]).toMatchObject({ id: meals, defaultUnitPrice: "35000", refundUnitPrice: "28000" });
    const tuition = await receivable(current, "Học phí", "100000");
    expect((await finance.read(current.identity.id, current.school.id)).receivables.find((item) => item.id === tuition)).toMatchObject({ refundUnitPrice: "0" });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: current.groupId, displayName: "Sai", unitLabel: "ngày", defaultUnitPrice: "1", refundUnitPrice: "-1" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
    // A1: the refund price may equal the charged price (full refund) but never exceed it.
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: current.groupId, displayName: "Sai", unitLabel: "ngày", defaultUnitPrice: "35000", refundUnitPrice: "40000" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.stringContaining("không được vượt") } } });
    await expect(finance.updateReceivableRefundPrice(current.identity.id, current.school.id, meals, uuid(), uuid(), { refundUnitPrice: "35001" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.stringContaining("không được vượt") } } });
    const changed: any = await finance.updateReceivableRefundPrice(current.identity.id, current.school.id, meals, uuid(), uuid(), { refundUnitPrice: "35000" });
    expect(changed.outcome).toMatchObject({ refundUnitPrice: "35000" });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "RECEIVABLE_REFUND_PRICE_CHANGED" } })).toBe(1);
    await expect(finance.updateReceivableRefundPrice(current.identity.id, current.school.id, meals, uuid(), uuid(), { refundUnitPrice: "35000" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
    // The catalog stays append-only apart from the tax category and the refund price.
    await expect(prisma.receivable.update({ where: { id: meals }, data: { defaultUnitPrice: 1n } })).rejects.toThrow(/append-only/);
    await expect(prisma.receivable.update({ where: { id: meals }, data: { refundUnitPrice: -1n } })).rejects.toThrow(/Receivable_refundUnitPrice_nonnegative/);
    await expect(prisma.receivable.update({ where: { id: meals }, data: { refundUnitPrice: 35001n } })).rejects.toThrow(/Receivable_refundUnitPrice_within_price/);
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
    // A1: the Bớt unit price never exceeds the line unit price, and the line price never drops below it.
    await expect(edit({ deductionQuantity: "1", refundUnitPrice: "1000001", reason: "Sai" })).rejects.toMatchObject({ response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
    await expect(finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, uuid(), uuid(), { quantity: "1", unitPrice: "40000", overrideReason: "Giảm giá" })).rejects.toMatchObject({ response: { fieldErrors: { unitPrice: expect.any(String) } } });
    await expect(prisma.invoiceLine.update({ where: { id: line.id }, data: { unitPrice: 40000n, grossAmount: 40000n, netAmount: -1060000n, vatAmount: -53000n, amount: -1113000n } })).rejects.toThrow(/InvoiceLine_refund_price_within_price/);
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

  // Amendment A4: a negative monthly Invoice is not paid back; its credit carries into the next month,
  // or into the settlement Invoice when the Student leaves.
  it("closes a negative monthly Invoice at issue and carries its credit to next month or the settlement", async () => {
    const current = await school();
    const stays = await student(current, "Nguyễn Minh Anh");
    const leaves = await student(current, "Trần Gia Bảo");
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "35000" });
    const personal = await account(current, "PERSONAL", "215000002088");
    for (const pupil of [stays, leaves]) await leave(current, pupil.id, ["2026-09-04", "2026-09-05", "2026-09-07"]);
    const october = await generatedRun(current, [{ receivableId: meals, quantity: "2" }], "2026-10");
    const negative = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: october.runId }, orderBy: { studentNameSnapshot: "asc" } });
    // 2 x 35.000 - 3 x 35.000 = -35.000 for each Student.
    expect(negative.map((invoice) => invoice.total)).toEqual([-35000n, -35000n]);
    for (const invoice of negative) await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { personalBankAccountId: personal });
    const closed = await prisma.invoice.findUniqueOrThrow({ where: { id: negative[0]!.id }, include: { receipt: true, settlementDifference: true } });
    expect(closed).toMatchObject({ status: "CLOSED", obligationTotalSnapshot: -35000n, receipt: { actualAmount: 0n, outcome: "OVERPAYMENT" }, settlementDifference: expect.objectContaining({ signedAmount: -35000n }) });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_CREDIT_CARRIED_AT_ISSUE" } })).toBe(2);
    await expect(finance.recordPayout(current.identity.id, current.school.id, closed.id, uuid(), uuid(), { paidOn: "2026-10-12", method: "CASH", reference: "x" })).rejects.toMatchObject({ response: { code: "INVOICE_NOT_ISSUED" } });
    await expect(prisma.receipt.create({ data: { schoolId: current.school.id, studentId: stays.id, schoolYearId: current.year.id, invoiceId: closed.id, actualAmount: 1n, outcome: "OVERPAYMENT" } })).rejects.toThrow();
    // The Student who stays: November deducts the credit.
    await prisma.studentEnrollment.updateMany({ where: { schoolId: current.school.id, studentId: leaves.id }, data: { lifecycle: "WITHDRAWN", endedOn: date("2026-10-20") } });
    const november = await generatedRun(current, [{ receivableId: meals, quantity: "20" }], "2026-11");
    const next = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: november.runId, studentId: stays.id }, include: { settlementCarries: true } });
    expect(next).toMatchObject({ total: 665000n, settlementCarries: [expect.objectContaining({ type: "OVERPAYMENT_CARRY", amount: 35000n })] });
    // The Student who left: the settlement refunds the uneaten meals from 20/10 (11 days) plus the credit.
    const created: any = await finance.createSettlement(current.identity.id, current.school.id, november.runId, uuid(), uuid(), { studentId: leaves.id });
    expect(created.outcome).toMatchObject({ kind: "SETTLEMENT", total: "-420000" });
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

  it("issues a negative settlement Invoice as a refund notice closed only by one exact payout", async () => {
    const current = await school();
    const pupil = await student(current);
    await student(current, "Lê Thu An");
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    const personal = await account(current, "PERSONAL", "215000002088");
    const september = await generatedRun(current, [{ receivableId: meals, quantity: "2" }], "2026-09");
    const paidAhead = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: september.runId, studentId: pupil.id } });
    await finance.issueInvoice(current.identity.id, current.school.id, paidAhead.id, uuid(), uuid(), { personalBankAccountId: personal });
    await leave(current, pupil.id, ["2026-09-04", "2026-09-05", "2026-09-07"]);
    await prisma.studentEnrollment.updateMany({ where: { schoolId: current.school.id, studentId: pupil.id }, data: { lifecycle: "WITHDRAWN", endedOn: date("2026-09-29") } });
    const { runId } = await generatedRun(current, [{ receivableId: meals, quantity: "21" }], "2026-10");
    await finance.createSettlement(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: pupil.id });
    const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: pupil.id } });
    // 3 leave days + 29 and 30/09 after the end date = 5 x 28.000: the School owes the parent.
    expect(invoice).toMatchObject({ kind: "SETTLEMENT", total: -140000n });
    await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { personalBankAccountId: personal });
    const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
    expect(issued).toMatchObject({ status: "ISSUED", obligationTotalSnapshot: -140000n });
    // The image is a refund notice without VietQR.
    const image = await finance.paymentImage(current.identity.id, current.school.id, invoice.id);
    expect(image.png.length).toBeGreaterThan(1000);
    // A Receipt never closes a refund; the payout must be exact and is recorded once.
    await expect(finance.closeInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { actualAmount: "0" })).rejects.toMatchObject({ response: { code: "INVOICE_REFUND_REQUIRES_PAYOUT" } });
    const queue = await finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: "2026-10", direction: "REFUND" });
    expect(queue.invoices).toEqual([expect.objectContaining({ id: invoice.id, outstanding: "-140000", direction: "REFUND" })]);
    expect((await finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: "2026-10", direction: "COLLECT" })).invoices.some((item: any) => item.id === invoice.id)).toBe(false);
    await expect(finance.recordPayout(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { paidOn: "2026-10-12", method: "CHEQUE", reference: "x" })).rejects.toMatchObject({ response: { fieldErrors: { method: expect.any(String) } } });
    const key = uuid(), operationId = uuid();
    const body = { paidOn: "2026-10-12", method: "BANK_TRANSFER", reference: "FT26285123456" };
    const paid: any = await finance.recordPayout(current.identity.id, current.school.id, invoice.id, key, operationId, body);
    expect(paid.outcome).toMatchObject({ status: "CLOSED", payout: { amount: "140000", paidOn: "2026-10-12", method: "BANK_TRANSFER", reference: "FT26285123456" } });
    // Retry with the same key replays the Operation; a second payout is refused.
    expect((await finance.recordPayout(current.identity.id, current.school.id, invoice.id, key, operationId, body) as any).id).toBe(operationId);
    await expect(finance.recordPayout(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), body)).rejects.toMatchObject({ response: { code: "INVOICE_NOT_ISSUED" } });
    expect(await prisma.financeLedgerEvent.findFirst({ where: { schoolId: current.school.id, type: "PAYOUT_POSTED" } })).toMatchObject({ amount: -140000n, invoiceId: invoice.id });
    await expect(prisma.invoicePayout.updateMany({ where: { invoiceId: invoice.id }, data: { reference: "khác" } })).rejects.toThrow(/immutable/);
    // Report V5: billed deductions and cash paid back are their own measures; nothing is still owed.
    const report: any = await finance.report(current.identity.id, current.school.id, "overview", {});
    expect(report).toMatchObject({ reportDefinitionVersion: "FINANCE_LEDGER_V5", summary: { deduction: "140000", payout: "140000", refundOwed: "0", netBilled: "-70000" } });
    const cash: any = await finance.report(current.identity.id, current.school.id, "cash-adjustments", {});
    expect(cash.rows.map((row: any) => [row.type, row.amount])).toContainEqual(["PAYOUT_POSTED", "-140000"]);
    expect(cash.charts.cashByWeek).toEqual([expect.objectContaining({ cashIn: "0", cashOut: "140000" })]);
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

  // The stakeholder example: 6.900.000/month, 12 months prepaid with 30.000.000 off (52.800.000 paid),
  // withdrawal after 6 started months refunds 52.800.000 - 6.900.000 x 6 = 11.400.000 plus its VAT.
  it("settles a withdrawn Student with unused meals and the unused prepaid package across the SchoolYear end", async () => {
    const current = await school();
    const pupil = await student(current, "Trần Gia Bảo");
    const stays = await student(current, "Lê Thu An");
    const tuition = await receivable(current, "Học phí", "6900000", { taxCategory: "VAT_5" });
    const meals = await receivable(current, "Tiền ăn", "35000", { refundUnitPrice: "28000" });
    const schoolAccount = await account(current, "SCHOOL", "0123456789");
    const personal = await account(current, "PERSONAL", "215000002088");
    const policy: any = await finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { name: "Nộp trước 12 tháng", receivableIds: [tuition], discountType: "FIXED_VND", discountValue: "2500000", priority: "1", stackingMode: "EXCLUSIVE", fulfillmentMode: "PREPAID_COVERAGE", prepaidTermMonths: 12, effectiveFrom: "2026-03-01" });
    const versionId = policy.outcome.versions[0].id;
    await finance.activatePromotionVersion(current.identity.id, current.school.id, versionId, uuid(), uuid());
    const march = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }], "2026-03");
    const source = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: march.runId, studentId: pupil.id } });
    // D11: twelve consecutive months from March reach February 2027, past the SchoolYear end.
    await finance.applyInvoiceCoverage(current.identity.id, current.school.id, source.id, uuid(), uuid(), { versionId });
    expect(await prisma.invoicePromotionCoverageFact.count({ where: { invoiceId: source.id } })).toBe(12);
    await finance.issueInvoice(current.identity.id, current.school.id, source.id, uuid(), uuid(), { personalBankAccountId: personal });
    const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: source.id } });
    await finance.closeInvoice(current.identity.id, current.school.id, source.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() });
    expect(await prisma.studentPromotionalCoverage.count({ where: { studentId: pupil.id } })).toBe(12);
    // August: tuition is covered, meals are charged in advance; two excused leave days.
    const august = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "21" }], "2026-08");
    const augustMeals = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: august.runId, studentId: pupil.id, channel: "PERSONAL" }, include: { lines: true } });
    expect(augustMeals.lines.map((line) => line.receivableId)).toEqual([meals]);
    await finance.issueInvoice(current.identity.id, current.school.id, augustMeals.id, uuid(), uuid(), { personalBankAccountId: personal });
    await leave(current, pupil.id, ["2026-08-05", "2026-08-06"]);
    // Last day of school 14/08: endedOn is the first day without enrollment.
    await prisma.studentEnrollment.updateMany({ where: { schoolId: current.school.id, studentId: pupil.id }, data: { lifecycle: "WITHDRAWN", endedOn: date("2026-08-15") } });
    const september = await generatedRun(current, [{ receivableId: meals, quantity: "21" }], "2026-09");
    expect(await prisma.invoice.count({ where: { collectionRunId: september.runId, studentId: pupil.id } })).toBe(0);
    const listed = await finance.settlements(current.identity.id, current.school.id, september.runId);
    expect(listed.students).toEqual([expect.objectContaining({ studentId: pupil.id, endedOn: "2026-08-15", lifecycle: "WITHDRAWN", invoices: [] })]);
    expect(listed.students.some((item: any) => item.studentId === stays.id)).toBe(false);
    const created: any = await finance.createSettlement(current.identity.id, current.school.id, september.runId, uuid(), uuid(), { studentId: pupil.id });
    expect(created.outcome).toMatchObject({ kind: "SETTLEMENT", channel: "SCHOOL", total: "-11970000", enrollmentEndedOn: "2026-08-15" });
    const [schoolPart, personalPart] = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: september.runId, studentId: pupil.id }, include: { lines: true }, orderBy: { channel: "asc" } });
    expect(schoolPart!.lines).toEqual([expect.objectContaining({ receivableId: tuition, quantity: 0, grossAmount: 0n, deductionQuantity: 1, deductionAmount: 11400000n, netAmount: -11400000n, vatAmount: -570000n, amount: -11970000n })]);
    expect(schoolPart!.lines[0]!.deductionSource).toMatchObject({ type: "PREPAID_PACKAGE_V1", months: 12, usedMonths: 6, paidNet: "52800000", listPriceUsed: "41400000", priorRefundNet: "0", firstMonth: "2026-03", lastMonth: "2027-02" });
    // 2 leave days + 14 operating days from 15/08 to 31/08 (Sundays 16, 23, 30 excluded) = 16 x 28.000.
    expect(personalPart!.lines).toEqual([expect.objectContaining({ receivableId: meals, quantity: 0, deductionQuantity: 16, deductionAmount: 448000n, amount: -448000n })]);
    expect((personalPart!.lines[0]!.deductionSource as any).afterEndDays).toHaveLength(14);
    expect(personalPart!.total).toBe(-448000n);
    await expect(finance.createSettlement(current.identity.id, current.school.id, september.runId, uuid(), uuid(), { studentId: pupil.id })).rejects.toMatchObject({ response: { code: "SETTLEMENT_EXISTS" } });
    await expect(finance.createSettlement(current.identity.id, current.school.id, september.runId, uuid(), uuid(), { studentId: stays.id })).rejects.toMatchObject({ response: { code: "SETTLEMENT_STUDENT_NOT_ELIGIBLE" } });
    // An override is capped by the unrefunded paid amount; reset recomputes the package refund.
    const editPackage = (body: Record<string, unknown>) => finance.editLineDeduction(current.identity.id, current.school.id, schoolPart!.id, schoolPart!.lines[0]!.id, uuid(), uuid(), body);
    await expect(editPackage({ deductionQuantity: "1", refundUnitPrice: "52800001", reason: "Sai" })).rejects.toMatchObject({ response: { code: "SETTLEMENT_REFUND_EXCEEDS_PAID" } });
    await editPackage({ deductionQuantity: "1", refundUnitPrice: "12000000", reason: "Thỏa thuận với phụ huynh" });
    await editPackage({ reset: true });
    expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: schoolPart!.lines[0]!.id } })).toMatchObject({ deductionAmount: 11400000n, deductionReason: null });
    // Both refund notices issue without VietQR and close by exact payouts.
    await finance.issueInvoice(current.identity.id, current.school.id, schoolPart!.id, uuid(), uuid(), { personalBankAccountId: personal });
    expect(await prisma.invoice.findMany({ where: { collectionRunId: september.runId, studentId: pupil.id }, select: { status: true, obligationTotalSnapshot: true, bankAccountIdSnapshot: true }, orderBy: { channel: "asc" } })).toEqual([{ status: "ISSUED", obligationTotalSnapshot: -11970000n, bankAccountIdSnapshot: schoolAccount }, { status: "ISSUED", obligationTotalSnapshot: -448000n, bankAccountIdSnapshot: personal }]);
    await finance.recordPayout(current.identity.id, current.school.id, schoolPart!.id, uuid(), uuid(), { paidOn: "2026-09-10", method: "BANK_TRANSFER", reference: "FT1" });
    // A second settlement never refunds the package twice.
    expect(await (finance as any).packageRefunds(prisma, current.school.id, pupil.id, date("2026-08-15"))).toEqual([]);
  });

  it("honours prepaid coverage issued in the previous SchoolYear when billing the next one", async () => {
    const current = await school();
    const pupil = await student(current);
    const tuition = await receivable(current, "Học phí", "1000000");
    const meals = await receivable(current, "Tiền ăn", "35000");
    const personal = await account(current, "PERSONAL", "215000002088");
    const policy: any = await finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { name: "Nộp trước 3 tháng", receivableIds: [tuition], discountType: "FIXED_VND", discountValue: "100000", priority: "1", stackingMode: "EXCLUSIVE", fulfillmentMode: "PREPAID_COVERAGE", prepaidTermMonths: 3, effectiveFrom: "2026-11-01" });
    const versionId = policy.outcome.versions[0].id;
    await finance.activatePromotionVersion(current.identity.id, current.school.id, versionId, uuid(), uuid());
    const november = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }], "2026-11");
    const source = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: november.runId } });
    await finance.applyInvoiceCoverage(current.identity.id, current.school.id, source.id, uuid(), uuid(), { versionId });
    await finance.issueInvoice(current.identity.id, current.school.id, source.id, uuid(), uuid(), { personalBankAccountId: personal });
    await finance.closeInvoice(current.identity.id, current.school.id, source.id, uuid(), uuid(), { actualAmount: (await prisma.invoice.findUniqueOrThrow({ where: { id: source.id } })).obligationTotalSnapshot!.toString() });
    expect((await prisma.studentPromotionalCoverage.findMany({ where: { studentId: pupil.id }, orderBy: { billingMonth: "asc" } })).map((item) => item.billingMonth)).toEqual(["2026-11", "2026-12", "2027-01"]);
    // The next SchoolYear: January tuition is already paid, only meals are billed.
    const next = await prisma.schoolYear.create({ data: { schoolId: current.school.id, name: "2027", startsOn: date("2027-01-01"), endsOn: date("2028-01-01") } });
    const classroom = await prisma.class.create({ data: { schoolId: current.school.id, schoolYearId: next.id, name: "Chồi 3B" } });
    const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: current.school.id, studentId: pupil.id, schoolYearId: next.id, classId: classroom.id, lifecycle: "ENROLLED", effectiveFrom: date("2027-01-01"), schoolYearName: next.name, schoolYearStartsOn: next.startsOn, schoolYearEndsOn: next.endsOn, className: classroom.name } });
    await prisma.enrollmentClassAssignment.create({ data: { schoolId: current.school.id, enrollmentId: enrollment.id, schoolYearId: next.id, classId: classroom.id, effectiveFrom: date("2027-01-01"), reason: "Năm học mới" } });
    const runId = id(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: next.id, billingMonth: "2027-01" }));
    let version = (await finance.run(current.identity.id, current.school.id, runId)).version;
    for (const line of [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "20" }]) version = (await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { ...line, expectedVersion: version }) as any).outcome.version;
    const preview: any = await finance.preview(current.identity.id, current.school.id, runId);
    expect(preview.eligible[0].lines.map((line: any) => line.receivableId)).toEqual([meals]);
  });
});
