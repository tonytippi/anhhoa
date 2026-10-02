import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";
import { SettingsService } from "../modules/settings/settings.service.js";

// Decision 2026-09-30: taxed receivables add VAT and are paid into the School account; NOT_DECLARED
// receivables are paid into a personal account. One Invoice per payment channel forms a payment notice.
const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const finance = new FinanceService(prisma, authorization);
const settings = new SettingsService(prisma, authorization);
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const id = (value: { outcome: unknown }) => (value.outcome as { id: string }).id;

async function school() {
  const created = await prisma.school.create({ data: { name: "Channels", slug: `channels-${uuid()}`, studentCodePrefix: "CH" } });
  schools.push(created.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: created.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: created.id, code: `FIN_${uuid().slice(0, 8)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE", "SETTINGS_MANAGE"].map((capability) => ({ schoolId: created.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: created.id, fullName: "Finance", email: identity.emailNormalized, phone: "0900000000", dateOfBirth: date("1990-01-01"), primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  const year = await prisma.schoolYear.create({ data: { schoolId: created.id, name: "2026", startsOn: date("2026-01-01"), endsOn: date("2027-01-01") } });
  const classroom = await prisma.class.create({ data: { schoolId: created.id, schoolYearId: year.id, name: "Mầm 4A" } });
  await prisma.financePolicy.create({ data: { schoolId: created.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: identity.id, membershipId: membership.id } });
  await prisma.receivableGroup.createMany({ data: [{ schoolId: created.id, kind: "FIXED", name: "Khoản thu cố định" }, { schoolId: created.id, kind: "FLEXIBLE", name: "Khoản thu linh hoạt" }, { schoolId: created.id, kind: "EXTRACURRICULAR", name: "Ngoại khóa" }] });
  const groupId = (await prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: created.id, kind: "FLEXIBLE" } })).id;
  return { school: created, identity, membership, year, classroom, groupId };
}
type School = Awaited<ReturnType<typeof school>>;

async function student(input: School, name = "Nguyễn Minh Anh") {
  const created = await prisma.student.create({ data: { schoolId: input.school.id, studentCode: `HS-${uuid().slice(0, 8)}`, fullName: name, dateOfBirth: date("2022-01-01") } });
  const enrollment = await prisma.studentEnrollment.create({ data: { schoolId: input.school.id, studentId: created.id, schoolYearId: input.year.id, classId: input.classroom.id, lifecycle: "ENROLLED", effectiveFrom: date("2026-01-01"), schoolYearName: input.year.name, schoolYearStartsOn: input.year.startsOn, schoolYearEndsOn: input.year.endsOn, className: input.classroom.name } });
  await prisma.enrollmentClassAssignment.create({ data: { schoolId: input.school.id, enrollmentId: enrollment.id, schoolYearId: input.year.id, classId: input.classroom.id, effectiveFrom: date("2026-01-01"), reason: "Channels test" } });
  return created;
}

async function receivable(input: School, displayName: string, defaultUnitPrice: string, taxCategory?: string) {
  return id(await finance.createReceivable(input.identity.id, input.school.id, uuid(), uuid(), { groupId: input.groupId, displayName, unitLabel: "tháng", defaultUnitPrice, ...(taxCategory ? { taxCategory } : {}) }));
}

async function account(input: School, kind: "SCHOOL" | "PERSONAL", accountNumber: string) {
  const created = await settings.createBankAccount(input.identity.id, input.school.id, uuid(), uuid(), { bankBin: "970436", accountNumber, accountHolderName: `Chủ ${accountNumber}`, transferTemplate: "{{studentName}} {{className}}", kind });
  return id(created);
}

async function generatedRun(input: School, lines: Array<{ receivableId: string; quantity: string }>, billingMonth = "2026-09") {
  const runId = id(await finance.openRun(input.identity.id, input.school.id, uuid(), uuid(), { schoolYearId: input.year.id, billingMonth }));
  let version = (await finance.run(input.identity.id, input.school.id, runId)).version;
  for (const line of lines) version = (await finance.saveTemplateLine(input.identity.id, input.school.id, runId, uuid(), uuid(), { ...line, expectedVersion: version }) as any).outcome.version;
  const preview = await finance.preview(input.identity.id, input.school.id, runId);
  await finance.readyRun(input.identity.id, input.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const queued = await finance.generateRun(input.identity.id, input.school.id, runId, uuid(), uuid());
  while ((await finance.operation(input.identity.id, input.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
  const generated = await finance.operation(input.identity.id, input.school.id, queued.id);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  return { runId, preview, generated };
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    for (const model of ["auditRecord", "financeLedgerEvent", "collectionRunGenerationItem", "collectionRunGeneration", "issuedPromotionApplication", "debtTransfer", "settlementTransfer", "invoiceLine", "settlementCarry", "settlementDifference", "receipt", "invoice", "collectionRunTemplateLine", "collectionRunLifecycleTransition", "collectionRun", "bankAccountLifecycleTransition", "bankAccount", "financePolicy", "receivableLifecycleTransition", "receivableGroupLifecycleTransition", "receivable", "receivableGroup", "enrollmentClassAssignment", "studentEnrollment", "student", "class", "schoolYear", "operation", "staffProfile", "positionCapabilityGrant", "schoolPosition", "schoolMembership"] as const)
      await (tx as any)[model].deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("finance payment channels", () => {
  it("stores and audits the receivable tax category and refuses unknown categories", async () => {
    const current = await school();
    const receivableId = await receivable(current, "Học phí", "3500000");
    expect((await finance.read(current.identity.id, current.school.id)).receivables[0]).toMatchObject({ id: receivableId, taxCategory: "NOT_DECLARED", channel: "PERSONAL" });
    await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: current.groupId, displayName: "Sai", unitLabel: "tháng", defaultUnitPrice: "1", taxCategory: "VAT_7" })).rejects.toMatchObject({ response: { fieldErrors: { taxCategory: expect.any(String) } } });
    const changed = await finance.updateReceivableTaxCategory(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { taxCategory: "VAT_5" });
    expect(changed.outcome).toMatchObject({ taxCategory: "VAT_5", channel: "SCHOOL" });
    expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "RECEIVABLE_TAX_CATEGORY_CHANGED" } })).toBe(1);
    // Only the tax category may change on the append-only catalog.
    await expect(prisma.receivable.update({ where: { id: receivableId }, data: { code: "IMMUTABLE" } })).rejects.toThrow(/append-only/);
  });

  it("splits generation into one DRAFT per channel with per-line half-up VAT after discount", async () => {
    const current = await school();
    const pupil = await student(current);
    const tuition = await receivable(current, "Học phí", "3500000", "VAT_5");
    const english = await receivable(current, "Tiếng Anh", "333333", "VAT_8");
    const meals = await receivable(current, "Tiền ăn", "35000");
    const versionId = id(await finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { name: "Con cán bộ", discountType: "FIXED_VND", discountValue: "350000", priority: "1", stackingMode: "STACKABLE", receivableIds: [tuition], effectiveFrom: "2026-09-01" }) as any);
    const version = (await prisma.promotionPolicyVersion.findFirstOrThrow({ where: { schoolId: current.school.id, policyId: versionId } })).id;
    await finance.activatePromotionVersion(current.identity.id, current.school.id, version, uuid(), uuid());
    await finance.assignPromotionStudents(current.identity.id, current.school.id, version, uuid(), uuid(), { studentIds: [pupil.id], effectiveFrom: "2026-09-01", reason: "Ưu đãi" });
    const { runId, preview } = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: english, quantity: "1" }, { receivableId: meals, quantity: "22" }]);
    // 3.150.000 * 5% = 157.500; 333.333 * 8% = 26.666,64 -> 26.667; meals untaxed.
    expect(preview.summary.expectedTotal).toBe(String(3150000 + 157500 + 333333 + 26667 + 770000));
    const invoices = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, include: { lines: true }, orderBy: { channel: "asc" } });
    expect(invoices.map((invoice) => [invoice.channel, invoice.total])).toEqual([["SCHOOL", 3150000n + 157500n + 333333n + 26667n], ["PERSONAL", 770000n]]);
    expect(invoices[0]!.lines.find((line) => line.receivableId === tuition)).toMatchObject({ grossAmount: 3500000n, discountAmount: 350000n, netAmount: 3150000n, taxCategorySnapshot: "VAT_5", vatRateSnapshot: 5, vatAmount: 157500n, amount: 3307500n });
    expect(invoices[1]!.lines[0]).toMatchObject({ taxCategorySnapshot: "NOT_DECLARED", vatRateSnapshot: null, vatAmount: 0n, amount: 770000n });
    const detail: any = await finance.invoice(current.identity.id, current.school.id, invoices[1]!.id);
    expect(detail.notice.invoices.map((part: any) => part.channel)).toEqual(["SCHOOL", "PERSONAL"]);
    // PostgreSQL rejects a VAT that is not the snapshot rate, and a line in the wrong channel.
    await expect(prisma.invoiceLine.update({ where: { id: invoices[1]!.lines[0]!.id }, data: { vatAmount: 1n, amount: 770001n } })).rejects.toThrow(/InvoiceLine_vat_snapshot/);
    await expect(prisma.invoiceLine.create({ data: { schoolId: current.school.id, invoiceId: invoices[1]!.id, receivableId: tuition, receivableNameSnapshot: "Học phí", unitLabelSnapshot: "tháng", defaultUnitPriceSnapshot: 1n, unitPrice: 1n, quantity: 1, grossAmount: 1n, netAmount: 1n, amount: 1n, taxCategorySnapshot: "EXEMPT" } })).rejects.toThrow(/payment channel/);
  });

  it("adds a manual line to its channel part, creating the part on demand", async () => {
    const current = await school();
    await student(current);
    const meals = await receivable(current, "Tiền ăn", "35000");
    const english = await receivable(current, "Tiếng Anh", "600000", "VAT_10");
    const { runId } = await generatedRun(current, [{ receivableId: meals, quantity: "20" }]);
    const personal = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
    expect(personal.channel).toBe("PERSONAL");
    const added: any = await finance.addInvoiceLine(current.identity.id, current.school.id, personal.id, uuid(), uuid(), { receivableId: english, quantity: "1" });
    expect(added.outcome).toMatchObject({ channel: "SCHOOL", total: "660000", notice: { invoices: [{ channel: "SCHOOL" }, { channel: "PERSONAL" }] } });
    expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(2);
  });

  it("issues the whole notice with the School account and the Class default personal account", async () => {
    const current = await school();
    await student(current);
    const tuition = await receivable(current, "Học phí", "3500000", "EXEMPT");
    const meals = await receivable(current, "Tiền ăn", "35000");
    const { runId } = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "22" }]);
    const [schoolPart, personalPart] = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, orderBy: { channel: "asc" } });
    // No accounts yet: refused without partial issue.
    await expect(finance.issueInvoice(current.identity.id, current.school.id, personalPart!.id, uuid(), uuid(), {})).rejects.toMatchObject({ response: { code: "SCHOOL_BANK_ACCOUNT_REQUIRED" } });
    const schoolAccount = await account(current, "SCHOOL", "0123456789");
    await expect(finance.issueInvoice(current.identity.id, current.school.id, personalPart!.id, uuid(), uuid(), {})).rejects.toMatchObject({ response: { code: "PERSONAL_BANK_ACCOUNT_REQUIRED" } });
    expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId, status: "DRAFT" } })).toBe(2);
    // A School account is refused as the personal account and vice versa.
    await expect(finance.setClassDefaultBankAccount(current.identity.id, current.school.id, current.classroom.id, uuid(), uuid(), { bankAccountId: schoolAccount })).rejects.toMatchObject({ response: { fieldErrors: { bankAccountId: expect.any(String) } } });
    await expect(finance.issueInvoice(current.identity.id, current.school.id, personalPart!.id, uuid(), uuid(), { personalBankAccountId: schoolAccount })).rejects.toMatchObject({ status: 404 });
    const personalAccount = await account(current, "PERSONAL", "215000002088");
    await finance.setClassDefaultBankAccount(current.identity.id, current.school.id, current.classroom.id, uuid(), uuid(), { bankAccountId: personalAccount });
    const issued: any = await finance.issueInvoice(current.identity.id, current.school.id, personalPart!.id, uuid(), uuid(), {});
    expect(issued.status).toBe("COMPLETED");
    const after = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, orderBy: { channel: "asc" } });
    expect(after.map((invoice) => [invoice.channel, invoice.status, invoice.bankAccountIdSnapshot, invoice.obligationTotalSnapshot])).toEqual([["SCHOOL", "ISSUED", schoolAccount, 3500000n], ["PERSONAL", "ISSUED", personalAccount, 770000n]]);
    expect(new Set(after.map((invoice) => invoice.obligationCodeSnapshot)).size).toBe(2);
    expect(schoolPart!.id).toBe(after[0]!.id);
    // A second active School account is refused.
    await expect(account(current, "SCHOOL", "999")).rejects.toMatchObject({ response: { code: "SCHOOL_BANK_ACCOUNT_EXISTS" } });
    // The image has one section per unsettled part; after a receipt only the other part remains.
    const image = await finance.paymentImage(current.identity.id, current.school.id, after[1]!.id);
    expect(image.fileName).toContain(after[0]!.obligationCodeSnapshot!);
    const audit = await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "INVOICE_PAYMENT_IMAGE_DOWNLOADED" } });
    expect((audit.provenance as any).parts).toHaveLength(2);
    await finance.closeInvoice(current.identity.id, current.school.id, after[0]!.id, uuid(), uuid(), { actualAmount: "3500000" });
    await finance.paymentImage(current.identity.id, current.school.id, after[1]!.id);
    const second = await prisma.auditRecord.findMany({ where: { schoolId: current.school.id, action: "INVOICE_PAYMENT_IMAGE_DOWNLOADED" }, orderBy: { createdAt: "desc" }, take: 1 });
    expect((second[0]!.provenance as any).parts).toEqual([expect.objectContaining({ invoiceId: after[1]!.id, amount: "770000" })]);
  });

  it("keeps carries and prior-debt transfers inside one payment channel", async () => {
    const current = await school();
    await student(current);
    const tuition = await receivable(current, "Học phí", "1000000", "VAT_10");
    const meals = await receivable(current, "Tiền ăn", "30000");
    const schoolAccount = await account(current, "SCHOOL", "0123456789");
    const personalAccount = await account(current, "PERSONAL", "215000002088");
    const september = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "10" }]);
    const [septemberSchool] = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: september.runId }, orderBy: { channel: "asc" } });
    await finance.issueInvoice(current.identity.id, current.school.id, septemberSchool!.id, uuid(), uuid(), { personalBankAccountId: personalAccount });
    // Short by 100.000 on the School part only.
    await finance.closeInvoice(current.identity.id, current.school.id, septemberSchool!.id, uuid(), uuid(), { actualAmount: "1000000" });
    const october = await generatedRun(current, [{ receivableId: tuition, quantity: "1" }, { receivableId: meals, quantity: "10" }], "2026-10");
    const [octoberSchool, octoberPersonal] = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: october.runId }, include: { settlementCarries: true }, orderBy: { channel: "asc" } });
    expect(octoberSchool!.settlementCarries.map((carry) => [carry.type, carry.amount])).toEqual([["SHORTFALL_CARRY", 100000n]]);
    expect(octoberSchool!.total).toBe(1100000n + 100000n);
    expect(octoberPersonal!.settlementCarries).toEqual([]);
    const septemberPersonal = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: september.runId, channel: "PERSONAL" } });
    await expect(finance.transferDebt(current.identity.id, current.school.id, uuid(), uuid(), { sourceInvoiceId: septemberPersonal.id, targetInvoiceId: octoberSchool!.id, amount: "1000", reason: "Sai kênh" })).rejects.toMatchObject({ response: { code: "DEBT_TRANSFER_CHANNEL_MISMATCH" } });
    expect(schoolAccount).toBeTruthy();
  });

  it("refuses a Class default account of another School", async () => {
    const current = await school();
    const foreign = await school();
    const foreignAccount = await account(foreign, "PERSONAL", "111");
    await expect(finance.setClassDefaultBankAccount(current.identity.id, current.school.id, current.classroom.id, uuid(), uuid(), { bankAccountId: foreignAccount })).rejects.toMatchObject({ response: { fieldErrors: { bankAccountId: expect.any(String) } } });
    await expect(finance.setClassDefaultBankAccount(current.identity.id, current.school.id, foreign.classroom.id, uuid(), uuid(), { bankAccountId: null })).rejects.toMatchObject({ status: 404 });
    await expect(prisma.class.update({ where: { id: current.classroom.id }, data: { defaultBankAccountId: foreignAccount } })).rejects.toThrow();
  });
});
