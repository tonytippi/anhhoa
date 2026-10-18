import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";
import { SettingsService } from "../modules/settings/settings.service.js";
import { issueThroughApproval } from './approval-helpers.js';

// Story 5.50 (sprint change 2026-10-12): a language center bills each Class by a period Finance enters (a unit).
const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const finance = new FinanceService(prisma, authorization);
const settings = new SettingsService(prisma, authorization);
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const id = (value: { outcome: unknown }) => (value.outcome as { id: string }).id;
type Setup = Awaited<ReturnType<typeof setup>>;

async function setup(kind: "LANGUAGE_CENTER" | "PRESCHOOL" = "LANGUAGE_CENTER") {
  const school = await prisma.school.create({ data: { name: "Trung tâm", slug: `center-${uuid()}`, studentCodePrefix: "TT", kind } });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: school.id, code: `FIN_${uuid().slice(0, 8)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE", "COLLECTION_RUN_APPROVE", "SETTINGS_MANAGE"].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: school.id, fullName: "Finance", email: identity.emailNormalized, phone: "0900000000", dateOfBirth: date("1990-01-01"), gender: "Khác", address: "Test", primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  const year = await prisma.schoolYear.create({ data: { schoolId: school.id, name: "Toàn thời gian", startsOn: date("2000-01-01"), endsOn: kind === "LANGUAGE_CENTER" ? null : date("2100-01-01") } });
  const starters = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Starters A" } });
  const movers = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Movers B" } });
  await prisma.receivableGroup.createMany({ data: [{ schoolId: school.id, kind: "FIXED", name: "Khoản thu cố định" }, { schoolId: school.id, kind: "FLEXIBLE", name: "Khoản thu linh hoạt" }, { schoolId: school.id, kind: "EXTRACURRICULAR", name: "Ngoại khóa" }] });
  const receivable = async (kind: "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR", displayName: string, price: string) => id(await finance.createReceivable(identity.id, school.id, uuid(), uuid(), { kind, displayName, unitLabel: "unit", defaultUnitPrice: price }));
  const tuition = await receivable("FLEXIBLE", "Học phí Starters", "3600000");
  // Sprint change 2026-10-13: a FIXED receivable assigned to another Class never reaches the runs of Starters A or Movers B.
  const flyers = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Flyers C", status: "ARCHIVED" } });
  const materials = await receivable("FIXED", "Giáo trình", "250000");
  await prisma.receivable.update({ where: { id: materials }, data: { classScoped: true } });
  await prisma.receivableClass.create({ data: { schoolId: school.id, receivableId: materials, classId: flyers.id } });
  const books = await receivable("FLEXIBLE", "Sách bổ trợ", "150000");
  const transport = await receivable("EXTRACURRICULAR", "Đưa đón", "800000");
  let index = 0;
  const enroll = async (classroom: { id: string; name: string }, effectiveFrom: string) => {
    index += 1;
    const student = await prisma.student.create({ data: { schoolId: school.id, studentCode: `TT-${String(index).padStart(3, "0")}-${uuid().slice(0, 4)}`, fullName: `Học viên ${index}`, dateOfBirth: date("2017-01-01") } });
    const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: school.id, studentId: student.id, schoolYearId: year.id, classId: classroom.id, className: classroom.name, lifecycle: "ENROLLED", effectiveFrom: date(effectiveFrom), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn } });
    await prisma.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: date(effectiveFrom), reason: "Xếp lớp" } });
    return { studentId: student.id, enrollmentId: enrollment.id };
  };
  return { school, identity, year, starters, movers, tuition, materials, books, transport, enroll };
}
const open = (s: Setup, classId: string, name: string, periodStartsOn: string, periodEndsOn: string) => finance.openRun(s.identity.id, s.school.id, uuid(), uuid(), { classId, name, periodStartsOn, periodEndsOn });
async function generate(s: Setup, runId: string) {
  const preview = await finance.preview(s.identity.id, s.school.id, runId);
  await finance.readyRun(s.identity.id, s.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const queued = await finance.generateRun(s.identity.id, s.school.id, runId, uuid(), uuid());
  while ((await finance.operation(s.identity.id, s.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
  return prisma.invoice.findMany({ where: { schoolId: s.school.id, collectionRunId: runId }, include: { lines: true }, orderBy: { studentCodeSnapshot: "asc" } });
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    for (const model of ["auditRecord", "financeLedgerEvent", "invoiceApprovalEvent", "invoiceImageExport", "collectionRunGenerationItem", "collectionRunGeneration", "debtTransfer", "invoiceLine", "settlementCarry", "settlementDifference", "receipt", "invoice", "collectionRunTemplateScopeClass", "collectionRunTemplateLine", "collectionRunLifecycleTransition", "collectionRun", "extracurricularMembership", "extracurricularClassLifecycleTransition", "extracurricularClass", "receivableClass", "receivableLifecycleTransition", "receivable", "receivableGroup", "bankAccountLifecycleTransition", "bankAccount", "financePolicy", "enrollmentClassAssignment", "studentEnrollment", "student", "class", "schoolYear", "operation", "staffProfile", "positionCapabilityGrant", "schoolPosition", "schoolMembership"] as const)
      await (tx as any)[model].deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("class-scoped collection runs", () => {
  it("opens staggered runs per Class, refuses the other scope, overlaps and foreign or archived Classes", async () => {
    const s = await setup();
    const unit1 = await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26");
    expect(unit1.outcome).toMatchObject({ scope: "CLASS", classId: s.starters.id, className: "Starters A", name: "Unit 1", periodStartsOn: "2026-08-03", periodEndsOn: "2026-09-26", billingMonth: "2026-08", status: "DRAFT", templateLines: [] });
    await expect(finance.runClassOptions(s.identity.id, s.school.id)).resolves.toEqual({ classes: [{ id: s.movers.id, name: "Movers B", latestRun: null }, { id: s.starters.id, name: "Starters A", latestRun: { id: id(unit1), name: "Unit 1", periodStartsOn: "2026-08-03", periodEndsOn: "2026-09-26" } }] });
    // Another Class shares the month and the dates freely.
    await expect(open(s, s.movers.id, "Unit 6", "2026-08-17", "2026-10-10")).resolves.toMatchObject({ outcome: { scope: "CLASS", billingMonth: "2026-08" } });
    for (const [from, to] of [["2026-09-26", "2026-11-20"], ["2026-07-01", "2026-08-03"], ["2026-08-10", "2026-08-20"]])
      await expect(open(s, s.starters.id, "Unit 2", from!, to!)).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_PERIOD_OVERLAP", fieldErrors: { periodStartsOn: "Kỳ này trùng với đợt Unit 1 (03/08/2026 – 26/09/2026) của lớp Starters A." } } });
    await expect(open(s, s.starters.id, "Unit 2", "2026-11-01", "2026-10-01")).rejects.toMatchObject({ status: 400, response: { fieldErrors: { periodEndsOn: expect.any(String) } } });
    await expect(finance.openRun(s.identity.id, s.school.id, uuid(), uuid(), { schoolYearId: s.year.id, billingMonth: "2026-10" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_SCOPE_NOT_ALLOWED" } });
    const foreign = await setup();
    await expect(open(s, foreign.starters.id, "Unit 1", "2027-01-01", "2027-02-01")).rejects.toMatchObject({ status: 404, response: { code: "CLASS_NOT_FOUND" } });
    await prisma.class.update({ where: { id: s.movers.id }, data: { status: "ARCHIVED" } });
    await expect(open(s, s.movers.id, "Unit 7", "2026-10-12", "2026-12-05")).rejects.toMatchObject({ status: 400, response: { fieldErrors: { classId: expect.any(String) } } });
    // The database refuses an overlap that bypasses the service.
    await expect(prisma.collectionRun.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, scope: "CLASS", classId: s.starters.id, name: "Trùng", periodStartsOn: date("2026-09-01"), periodEndsOn: date("2026-09-30"), billingMonth: "2026-09" } })).rejects.toThrow();
    const preschool = await setup("PRESCHOOL");
    await expect(open(preschool, preschool.starters.id, "Unit 1", "2026-08-03", "2026-09-26")).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_SCOPE_NOT_ALLOWED" } });
  });

  it("bills only the Students of the Class in the period, with service lines, and adds a mid-unit Student", async () => {
    const s = await setup();
    const a = await s.enroll(s.starters, "2026-08-01");
    const b = await s.enroll(s.starters, "2026-08-01");
    const other = await s.enroll(s.movers, "2026-08-01");
    const service = id(await finance.createExtracurricularClass(s.identity.id, s.school.id, uuid(), uuid(), { name: "Đưa đón", schoolYearId: s.year.id, receivableId: s.transport }));
    await finance.addExtracurricularMemberships(s.identity.id, s.school.id, service, uuid(), uuid(), { enrollmentIds: [a.enrollmentId, other.enrollmentId], effectiveFrom: "2026-08-01", reason: "Đăng ký" });
    const run = await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26");
    const runId = id(run);
    await expect(finance.saveTemplateLine(s.identity.id, s.school.id, runId, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", scope: { type: "CLASSES", classIds: [s.starters.id] }, expectedVersion: 1 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { scope: expect.any(String) } } });
    await finance.saveTemplateLine(s.identity.id, s.school.id, runId, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    const invoices = await generate(s, runId);
    expect(invoices.map((invoice) => invoice.studentId).sort()).toEqual([a.studentId, b.studentId].sort());
    const total = (studentId: string) => invoices.filter((invoice) => invoice.studentId === studentId).reduce((sum, invoice) => sum + invoice.total, 0n);
    expect(total(a.studentId)).toBe(4_400_000n);
    expect(total(b.studentId)).toBe(3_600_000n);
    expect(invoices[0]).toMatchObject({ billingMonth: "2026-08", rosterAsOf: date("2026-08-03") });
    // Line badges of a CLASS run speak of the class and of services.
    const badges = ((await finance.invoice(s.identity.id, s.school.id, invoices.find((invoice) => invoice.studentId === a.studentId)!.id)) as any).lines.map((line: any) => line.sourceBadge.label).sort();
    expect(badges).toEqual(["Dịch vụ · Đưa đón", "Linh hoạt · Cả lớp"]);
    // A Student who joins the Class in the middle of the unit is addable; one who joins after it is not.
    const late = await s.enroll(s.starters, "2026-09-01");
    const afterwards = await s.enroll(s.starters, "2026-09-27");
    const addable: any = await finance.addableStudents(s.identity.id, s.school.id, runId);
    expect(addable.students.map((student: any) => student.id)).toEqual([late.studentId]);
    await finance.addGeneratedStudent(s.identity.id, s.school.id, runId, uuid(), uuid(), { studentId: late.studentId });
    await expect(prisma.invoice.findFirstOrThrow({ where: { schoolId: s.school.id, collectionRunId: runId, studentId: late.studentId } })).resolves.toMatchObject({ total: 3_600_000n });
    expect((await finance.addGeneratedStudent(s.identity.id, s.school.id, runId, uuid(), uuid(), { studentId: afterwards.studentId }) as any).outcome.created).toEqual([]);
    expect((await finance.addGeneratedStudent(s.identity.id, s.school.id, runId, uuid(), uuid(), { studentId: other.studentId }) as any).outcome.created).toEqual([]);
  });

  it("copies the whole-class lines of the preceding run of the Class and locks issuing behind it only", async () => {
    const s = await setup();
    const a = await s.enroll(s.starters, "2026-08-01");
    const m = await s.enroll(s.movers, "2026-08-01");
    const first = id(await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26"));
    const version = (await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 }) as any).outcome.version;
    await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: s.books, quantity: "1", scope: { type: "STUDENTS", studentIds: [a.studentId] }, expectedVersion: version });
    // No FIXED receivable is seeded into a CLASS run.
    expect((await prisma.collectionRunTemplateLine.findMany({ where: { schoolId: s.school.id, collectionRunId: first } })).map((line) => line.receivableId).sort()).toEqual([s.tuition, s.books].sort());
    await generate(s, first);
    const second = await open(s, s.starters.id, "Unit 2", "2026-09-28", "2026-11-21");
    // Only whole-class lines are copied; a line named for specific Students is a one-off.
    expect((second.outcome as any).templateLines.map((line: any) => line.receivableId)).toEqual([s.tuition]);
    const [secondInvoice] = await generate(s, id(second));
    // Unit 1 of the same Class is not CLOSED yet: Finance may submit, but approval refuses to issue.
    const personal = id(await settings.createBankAccount(s.identity.id, s.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber: "215000002088", accountHolderName: "Trung tâm", transferTemplate: "{{studentName}} {{className}}", kind: "PERSONAL" }));
    await expect(issueThroughApproval(finance, s.identity.id, s.school.id, secondInvoice!.id, uuid(), uuid(), { personalBankAccountId: personal })).rejects.toMatchObject({ status: 409, response: { code: "PREVIOUS_RUN_NOT_CLOSED", message: expect.stringContaining("Unit 1") } });
    await expect(finance.run(s.identity.id, s.school.id, id(second))).resolves.toMatchObject({ previousOpenRun: { id: first, name: "Unit 1", periodStartsOn: "2026-08-03", periodEndsOn: "2026-09-26" } });
    // The other Class is not held back by it.
    const movers = id(await open(s, s.movers.id, "Unit 6", "2026-10-05", "2026-11-28"));
    await finance.saveTemplateLine(s.identity.id, s.school.id, movers, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    const [moversInvoice] = await generate(s, movers);
    expect(moversInvoice!.studentId).toBe(m.studentId);
    await expect(issueThroughApproval(finance, s.identity.id, s.school.id, moversInvoice!.id, uuid(), uuid(), {})).rejects.not.toMatchObject({ response: { code: "PREVIOUS_RUN_NOT_CLOSED" } });
  });

  it("flags a Receivable the Student already has on an overlapping run of a previous Class, without blocking", async () => {
    const s = await setup();
    const mover = await s.enroll(s.starters, "2026-08-01");
    const stays = await s.enroll(s.starters, "2026-08-01");
    const first = id(await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26"));
    await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    await generate(s, first);
    // The Student moves to Movers B in the middle of Unit 1; Movers B bills an overlapping period.
    await prisma.enrollmentClassAssignment.updateMany({ where: { schoolId: s.school.id, enrollmentId: mover.enrollmentId }, data: { effectiveTo: date("2026-09-07") } });
    await prisma.enrollmentClassAssignment.create({ data: { schoolId: s.school.id, enrollmentId: mover.enrollmentId, schoolYearId: s.year.id, classId: s.movers.id, effectiveFrom: date("2026-09-07"), reason: "Chuyển lớp" } });
    const fresh = await s.enroll(s.movers, "2026-08-01");
    const second = id(await open(s, s.movers.id, "Unit 6", "2026-09-07", "2026-10-31"));
    await finance.saveTemplateLine(s.identity.id, s.school.id, second, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    const invoices = await generate(s, second);
    const line = (studentId: string) => invoices.find((invoice) => invoice.studentId === studentId)!.lines[0]!;
    expect(invoices.map((invoice) => invoice.studentId).sort()).toEqual([mover.studentId, fresh.studentId].sort());
    expect(line(mover.studentId).sourceDetail).toMatchObject({ flags: ["PERIOD_OVERLAP"], overlap: { runName: "Starters A · Unit 1" } });
    expect((line(fresh.studentId).sourceDetail as any)?.flags ?? []).toEqual([]);
    expect(line(mover.studentId).amount).toBe(3_600_000n);
    const detail: any = await finance.invoice(s.identity.id, s.school.id, invoices.find((invoice) => invoice.studentId === mover.studentId)!.id);
    expect(JSON.stringify(detail)).toContain("Trùng kỳ");
    const runDetail: any = await finance.run(s.identity.id, s.school.id, second);
    expect(runDetail.invoices.filter((invoice: any) => invoice.periodOverlap).map((invoice: any) => invoice.studentId)).toEqual([mover.studentId]);
    expect(stays.studentId).not.toBe(mover.studentId);
  });

  it("replays an identical open request, and old debt and a receipt shortfall follow the Student into another Class", async () => {
    const s = await setup();
    const membership = await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: s.school.id } });
    await prisma.financePolicy.create({ data: { schoolId: s.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: s.identity.id, membershipId: membership.id } });
    const personal = id(await settings.createBankAccount(s.identity.id, s.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber: "215000002088", accountHolderName: "Trung tâm", transferTemplate: "{{studentName}} {{className}}", kind: "PERSONAL" }));
    const debtor = await s.enroll(s.starters, "2026-08-01");
    const shortPayer = await s.enroll(s.starters, "2026-08-01");
    const key = uuid(); const operationId = uuid(); const body = { classId: s.starters.id, name: "Unit 1", periodStartsOn: "2026-08-03", periodEndsOn: "2026-09-26" };
    const opened = await finance.openRun(s.identity.id, s.school.id, key, operationId, body);
    await expect(finance.openRun(s.identity.id, s.school.id, key, operationId, body)).resolves.toMatchObject({ id: opened.id, outcome: { id: id(opened) } });
    await expect(finance.openRun(s.identity.id, s.school.id, key, operationId, { ...body, name: "Unit khác" })).rejects.toMatchObject({ status: 409 });
    expect(await prisma.collectionRun.count({ where: { schoolId: s.school.id } })).toBe(1);
    const first = id(opened);
    await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    const firstInvoices = await generate(s, first);
    for (const invoice of firstInvoices) await issueThroughApproval(finance, s.identity.id, s.school.id, invoice.id, uuid(), uuid(), { personalBankAccountId: personal });
    const queue: any = await finance.receiptQueue(s.identity.id, s.school.id, { billingMonth: "ALL" });
    expect(queue.invoices.map((invoice: any) => invoice.periodLabel)).toEqual(["Starters A · Unit 1", "Starters A · Unit 1"]);
    // One Student pays 100.000đ short; the other pays nothing.
    await finance.closeInvoice(s.identity.id, s.school.id, firstInvoices.find((invoice) => invoice.studentId === shortPayer.studentId)!.id, uuid(), uuid(), { actualAmount: "3500000" });
    await finance.closeRun(s.identity.id, s.school.id, first, uuid(), uuid(), { reason: "Hết unit" });
    // Both Students move to Movers B, whose next unit starts later.
    for (const student of [debtor, shortPayer]) {
      await prisma.enrollmentClassAssignment.updateMany({ where: { schoolId: s.school.id, enrollmentId: student.enrollmentId }, data: { effectiveTo: date("2026-09-28") } });
      await prisma.enrollmentClassAssignment.create({ data: { schoolId: s.school.id, enrollmentId: student.enrollmentId, schoolYearId: s.year.id, classId: s.movers.id, effectiveFrom: date("2026-09-28"), reason: "Lên lớp" } });
    }
    const second = id(await open(s, s.movers.id, "Unit 6", "2026-10-05", "2026-11-28"));
    await finance.saveTemplateLine(s.identity.id, s.school.id, second, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    const secondInvoices = await generate(s, second);
    const invoiceOf = (studentId: string) => secondInvoices.find((invoice) => invoice.studentId === studentId)!;
    // The shortfall is carried into the next DRAFT of the Student, in a run of another Class.
    expect(invoiceOf(shortPayer.studentId).total).toBe(3_700_000n);
    expect(await prisma.settlementCarry.count({ where: { schoolId: s.school.id, invoiceId: invoiceOf(shortPayer.studentId).id, type: "SHORTFALL_CARRY", amount: 100_000n } })).toBe(1);
    // The unpaid Unit 1 invoice is listed as prior debt of the Movers B run and transfers into its DRAFT.
    const debts: any = await finance.priorDebts(s.identity.id, s.school.id, second);
    expect(debts).toMatchObject({ total: "3600000", debts: [{ student: { id: debtor.studentId }, outstanding: "3600000", periodLabel: "Starters A · Unit 1" }] });
    await finance.transferPriorDebts(s.identity.id, s.school.id, second, uuid(), uuid(), { sourceInvoiceIds: [debts.debts[0].sourceInvoiceId] });
    const target = await prisma.invoice.findFirstOrThrow({ where: { id: invoiceOf(debtor.studentId).id }, include: { lines: true } });
    expect(target.total).toBe(7_200_000n);
    const report: any = await finance.report(s.identity.id, s.school.id, "collection-runs", {});
    expect(report.rows.map((row: any) => [row.periodLabel, row.periodStartsOn])).toEqual([["Starters A · Unit 1", "2026-08-03"]]);
    expect(target.lines.find((line) => line.kind === "PRIOR_DEBT")).toMatchObject({ amount: 3_600_000n, sourceReason: expect.stringContaining("Unit 1") });
  });

  it("transfers both unpaid parts of one Student in a single prior-debt request", async () => {
    const s = await setup();
    const membership = await prisma.schoolMembership.findFirstOrThrow({ where: { schoolId: s.school.id } });
    await prisma.financePolicy.create({ data: { schoolId: s.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: s.identity.id, membershipId: membership.id } });
    const personal = id(await settings.createBankAccount(s.identity.id, s.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber: "215000002088", accountHolderName: "Trung tâm", transferTemplate: "{{studentName}} {{className}}", kind: "PERSONAL" }));
    const schoolAccount = id(await settings.createBankAccount(s.identity.id, s.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber: "215000002099", accountHolderName: "Công ty", transferTemplate: "{{studentName}} {{className}}", kind: "SCHOOL" }));
    const taxed = id(await finance.createReceivable(s.identity.id, s.school.id, uuid(), uuid(), { kind: "FLEXIBLE", displayName: "Giáo trình có thuế", unitLabel: "bộ", defaultUnitPrice: "650000", taxCategory: "VAT_5" }));
    const debtor = await s.enroll(s.starters, "2026-08-01");
    const first = id(await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26"));
    await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: s.tuition, quantity: "1", expectedVersion: 1 });
    await finance.saveTemplateLine(s.identity.id, s.school.id, first, uuid(), uuid(), { receivableId: taxed, quantity: "1", expectedVersion: 2 });
    const parts = await generate(s, first);
    expect(parts.map((invoice) => invoice.channel).sort()).toEqual(["PERSONAL", "SCHOOL"]);
    await issueThroughApproval(finance, s.identity.id, s.school.id, parts[0]!.id, uuid(), uuid(), { bankAccountId: schoolAccount, personalBankAccountId: personal });
    expect(await prisma.invoice.count({ where: { schoolId: s.school.id, collectionRunId: first, status: "ISSUED" } })).toBe(2);
    await finance.closeRun(s.identity.id, s.school.id, first, uuid(), uuid(), { reason: "Hết unit" });
    const second = id(await open(s, s.starters.id, "Unit 2", "2026-09-28", "2026-11-21"));
    await generate(s, second);
    const debts: any = await finance.priorDebts(s.identity.id, s.school.id, second);
    expect(debts.debts).toHaveLength(2);
    await finance.transferPriorDebts(s.identity.id, s.school.id, second, uuid(), uuid(), { sourceInvoiceIds: debts.debts.map((debt: any) => debt.sourceInvoiceId) });
    const lines = await prisma.invoiceLine.findMany({ where: { schoolId: s.school.id, kind: "PRIOR_DEBT", invoice: { collectionRunId: second, studentId: debtor.studentId } }, include: { invoice: true } });
    expect(lines.map((line) => line.invoice.channel).sort()).toEqual(["PERSONAL", "SCHOOL"]);
  });

  // Sprint change 2026-10-13: a FIXED receivable applies to the whole School or to the Classes chosen on it.
  it("seeds FIXED receivables of the whole School or of the Class into a class run, never by copy", async () => {
    const s = await setup();
    const a = await s.enroll(s.starters, "2026-08-01");
    const create = (displayName: string, price: string, classIds?: string[]) => finance.createReceivable(s.identity.id, s.school.id, uuid(), uuid(), { kind: "FIXED", displayName, unitLabel: "unit", defaultUnitPrice: price, ...(classIds ? { classIds } : {}) });
    const startersTuition = await create("Học phí cố định Starters", "3000000", [s.starters.id]);
    expect(startersTuition.outcome).toMatchObject({ kind: "FIXED", appliesTo: "CLASSES", appliesToClassIds: [s.starters.id], appliesToClassNames: ["Starters A"] });
    const moversTuition = id(await create("Học phí cố định Movers", "4000000", [s.movers.id]));
    const everyone = id(await create("Phí tài liệu chung", "100000"));
    // Only a FIXED receivable takes Classes, and only ACTIVE Classes of this School.
    await expect(finance.createReceivable(s.identity.id, s.school.id, uuid(), uuid(), { kind: "FLEXIBLE", displayName: "Sai nhóm", unitLabel: "unit", defaultUnitPrice: "1", classIds: [s.starters.id] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { classIds: expect.any(String) } } });
    const foreign = await setup();
    await expect(create("Lớp trường khác", "1", [foreign.starters.id])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { classIds: expect.any(String) } } });
    const catalog = (await finance.read(s.identity.id, s.school.id)) as any;
    expect(catalog.classOptions.map((item: any) => item.name)).toEqual(["Movers B", "Starters A"]);
    expect(catalog.receivables.find((item: any) => item.id === everyone)).toMatchObject({ appliesTo: "SCHOOL", appliesToClassIds: [], appliesToClassNames: [] });

    const names = (run: { outcome: unknown }) => (run.outcome as any).templateLines.map((line: any) => [line.receivableName, line.kind, line.scope.type]).sort();
    const unit1 = await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26");
    expect(names(unit1)).toEqual([["Học phí cố định Starters", "FIXED", "ALL"], ["Phí tài liệu chung", "FIXED", "ALL"]]);
    expect(names(await open(s, s.movers.id, "Unit 6", "2026-08-03", "2026-09-26"))).toEqual([["Học phí cố định Movers", "FIXED", "ALL"], ["Phí tài liệu chung", "FIXED", "ALL"]]);
    await finance.saveTemplateLine(s.identity.id, s.school.id, id(unit1), uuid(), uuid(), { receivableId: s.books, quantity: "2", expectedVersion: 1 });
    const invoices = await generate(s, id(unit1));
    expect(invoices.filter((invoice) => invoice.studentId === a.studentId).reduce((sum, invoice) => sum + invoice.total, 0n)).toBe(3_400_000n);

    // The next unit moves Starters A to another price: the Class leaves one FIXED receivable and joins the other. The FLEXIBLE line is copied.
    const spare = await prisma.class.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, name: "Starters Z" } });
    await finance.updateReceivable(s.identity.id, s.school.id, id(startersTuition), uuid(), uuid(), { classIds: [spare.id], reason: "Starters A sang mức khác" });
    // A used receivable keeps its group; an unused one that leaves FIXED drops its Classes.
    await expect(finance.updateReceivable(s.identity.id, s.school.id, id(startersTuition), uuid(), uuid(), { kind: "FLEXIBLE", reason: "Đổi nhóm" })).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
    const unused = id(await create("Chưa dùng", "1000", [spare.id]));
    await expect(finance.updateReceivable(s.identity.id, s.school.id, unused, uuid(), uuid(), { kind: "FLEXIBLE", classIds: [spare.id], reason: "Sai" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { classIds: expect.any(String) } } });
    await expect(finance.updateReceivable(s.identity.id, s.school.id, unused, uuid(), uuid(), { kind: "FLEXIBLE", reason: "Đổi nhóm" })).resolves.toMatchObject({ outcome: { kind: "FLEXIBLE", appliesToClassIds: [] } });
    await expect(finance.updateReceivable(s.identity.id, s.school.id, moversTuition, uuid(), uuid(), { classIds: [s.movers.id], reason: "Không đổi" })).rejects.toMatchObject({ status: 400 });
    const moved = await finance.updateReceivable(s.identity.id, s.school.id, moversTuition, uuid(), uuid(), { classIds: [s.movers.id, s.starters.id], reason: "Starters lên giá Movers" });
    expect(moved.outcome).toMatchObject({ appliesToClassNames: ["Movers B", "Starters A"] });
    await finance.closeRun(s.identity.id, s.school.id, id(unit1), uuid(), uuid(), { reason: "Hết unit" }).catch(() => undefined);
    const unit2 = await open(s, s.starters.id, "Unit 2", "2026-09-28", "2026-11-21");
    expect(names(unit2)).toEqual([["Học phí cố định Movers", "FIXED", "ALL"], ["Phí tài liệu chung", "FIXED", "ALL"], ["Sách bổ trợ", "FLEXIBLE", "ALL"]]);
    // A FIXED receivable of another Class cannot be added to the run by hand.
    await expect(finance.saveTemplateLine(s.identity.id, s.school.id, id(unit2), uuid(), uuid(), { receivableId: s.materials, quantity: "1", expectedVersion: 1 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
  });

  it("seeds a class-assigned FIXED receivable into a preschool monthly run for its Classes only", async () => {
    const s = await setup("PRESCHOOL");
    const a = await s.enroll(s.starters, "2026-08-01");
    const b = await s.enroll(s.movers, "2026-08-01");
    const create = (displayName: string, price: string, classIds?: string[]) => finance.createReceivable(s.identity.id, s.school.id, uuid(), uuid(), { kind: "FIXED", displayName, unitLabel: "tháng", defaultUnitPrice: price, ...(classIds ? { classIds } : {}) });
    const high = id(await create("Học phí lớp lớn", "7000000", [s.starters.id]));
    await create("Học phí lớp nhỏ", "6000000", [s.movers.id]);
    await create("Tiền ăn", "1000000");
    const run = await finance.openRun(s.identity.id, s.school.id, uuid(), uuid(), { schoolYearId: s.year.id, billingMonth: "2026-09" });
    const lines = (run.outcome as any).templateLines as Array<{ id: string; receivableId: string; receivableName: string; scope: { type: string; classes: Array<{ id: string }> } }>;
    // "Giáo trình" is assigned to an archived Class of the year and is seeded for it; nobody is enrolled there.
    expect(lines.map((line) => [line.receivableName, line.scope.type, line.scope.classes.map((item) => item.id)]).sort()).toEqual([
      ["Giáo trình", "CLASSES", [expect.any(String)]],
      ["Học phí lớp lớn", "CLASSES", [s.starters.id]],
      ["Học phí lớp nhỏ", "CLASSES", [s.movers.id]],
      ["Tiền ăn", "ALL", []],
    ]);
    // Editing the quantity keeps the seeded scope; another scope is refused.
    await expect(finance.saveTemplateLine(s.identity.id, s.school.id, id(run), uuid(), uuid(), { receivableId: high, quantity: "2", scope: { type: "ALL" }, expectedVersion: 1 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { scope: expect.any(String) } } });
    const edited = await finance.saveTemplateLine(s.identity.id, s.school.id, id(run), uuid(), uuid(), { receivableId: high, quantity: "2", expectedVersion: 1 });
    expect((edited.outcome as any).templateLines.find((line: any) => line.receivableId === high)).toMatchObject({ quantity: "2", scope: { type: "CLASSES" } });
    const invoices = await generate(s, id(run));
    const total = (studentId: string) => invoices.filter((invoice) => invoice.studentId === studentId).reduce((sum, invoice) => sum + invoice.total, 0n);
    expect(total(a.studentId)).toBe(15_000_000n);
    expect(total(b.studentId)).toBe(7_000_000n);
    // A receivable whose Classes all belong to another SchoolYear is not seeded.
    const nextYear = await prisma.schoolYear.create({ data: { schoolId: s.school.id, name: "Năm sau", startsOn: date("2100-01-02"), endsOn: date("2100-12-31") } });
    const later = await finance.openRun(s.identity.id, s.school.id, uuid(), uuid(), { schoolYearId: nextYear.id, billingMonth: "2100-02" });
    expect((later.outcome as any).templateLines.map((line: any) => line.receivableName)).toEqual(["Tiền ăn"]);
  });

  it("reads and sets the FIXED receivables of one Class from the Class screen", async () => {
    const s = await setup();
    const create = (displayName: string, classIds?: string[]) => finance.createReceivable(s.identity.id, s.school.id, uuid(), uuid(), { kind: "FIXED", displayName, unitLabel: "unit", defaultUnitPrice: "1000000", ...(classIds ? { classIds } : {}) });
    const starters = id(await create("Học phí Starters cố định", [s.starters.id]));
    const movers = id(await create("Học phí Movers cố định", [s.movers.id]));
    const everyone = id(await create("Phí chung"));
    const view = async (classId: string) => ((await finance.classFixedReceivables(s.identity.id, s.school.id, classId)) as any).receivables.map((item: any) => [item.displayName, item.appliesTo, item.applied, item.otherClassNames]);
    // "Giáo trình" of the fixture is assigned to the archived Class only.
    expect(await view(s.starters.id)).toEqual([["Giáo trình", "CLASSES", false, ["Flyers C"]], ["Học phí Movers cố định", "CLASSES", false, ["Movers B"]], ["Học phí Starters cố định", "CLASSES", true, []], ["Phí chung", "SCHOOL", true, []]]);
    const set = (classId: string, receivableIds: string[]) => finance.setClassFixedReceivables(s.identity.id, s.school.id, classId, uuid(), uuid(), { receivableIds });
    await expect(set(s.starters.id, [starters])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: "Không có thay đổi để lưu." } } });
    await expect(set(s.starters.id, [s.tuition])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
    const foreign = await setup();
    await expect(set(foreign.starters.id, [starters])).rejects.toMatchObject({ status: 404, response: { code: "CLASS_NOT_FOUND" } });
    await expect(finance.classFixedReceivables(s.identity.id, s.school.id, foreign.starters.id)).rejects.toMatchObject({ status: 404 });
    // Starters A moves to the Movers price: its own receivable is left with no Class and stays class-scoped, not whole-School.
    const moved = (await set(s.starters.id, [movers, everyone])).outcome as any;
    expect(moved.receivables.filter((item: any) => item.applied).map((item: any) => item.displayName)).toEqual(["Học phí Movers cố định", "Phí chung"]);
    const catalog = (await finance.read(s.identity.id, s.school.id)) as any;
    expect(catalog.receivables.find((item: any) => item.id === starters)).toMatchObject({ appliesTo: "CLASSES", appliesToClassIds: [] });
    expect(catalog.receivables.find((item: any) => item.id === movers)).toMatchObject({ appliesToClassNames: ["Movers B", "Starters A"] });
    const run = await open(s, s.starters.id, "Unit 1", "2026-08-03", "2026-09-26");
    expect((run.outcome as any).templateLines.map((line: any) => line.receivableName).sort()).toEqual(["Học phí Movers cố định", "Phí chung"]);
    // The receivable page turns a class-scoped receivable without Classes back into a whole-School one explicitly.
    await expect(finance.updateReceivable(s.identity.id, s.school.id, starters, uuid(), uuid(), { classIds: [], reason: "Áp dụng toàn trường" })).resolves.toMatchObject({ outcome: { appliesTo: "SCHOOL" } });
    await expect(set(s.movers.id, [])).resolves.toMatchObject({ outcome: { classId: s.movers.id } });
    await prisma.class.update({ where: { id: s.movers.id }, data: { status: "ARCHIVED" } });
    await expect(set(s.movers.id, [movers])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { classId: expect.any(String) } } });
  });
});
