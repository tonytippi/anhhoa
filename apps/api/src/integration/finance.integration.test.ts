import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";
import { RosterService } from "../modules/roster/roster.service.js";
import { createApi } from "../main.js";

const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const finance = new FinanceService(prisma, authorization);
const rosterService = new RosterService(prisma, authorization);
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

async function appSession(baseUrl: string, email: string) {
  const start = await fetch(`${baseUrl}/api/app/auth/google/start`, { redirect: "manual" });
  const authorizationUrl = new URL(start.headers.get("location")!);
  const correlation = start.headers.getSetCookie().find((value) => value.startsWith("app_oauth_correlation="))!.split(";")[0]!;
  const nonce = authorizationUrl.searchParams.get("nonce")!;
  const clientId = authorizationUrl.searchParams.get("client_id")!;
  const code = Buffer.from(JSON.stringify({ iss: "https://accounts.google.com", sub: `finance-${uuid()}`, email, email_verified: true, aud: clientId, nonce, exp: Math.ceil(Date.now() / 1000) + 600 })).toString("base64url");
  const callback = await fetch(`${baseUrl}/api/app/auth/google/callback?state=${encodeURIComponent(authorizationUrl.searchParams.get("state")!)}&code=${encodeURIComponent(code)}`, { redirect: "manual", headers: { cookie: correlation } });
  return callback.headers.getSetCookie().find((value) => value.startsWith("app_session="))!.split(";")[0]!;
}

async function graph() {
  const school = await prisma.school.create({
    data: {
      name: "Finance",
      slug: `finance-${uuid()}`,
      studentCodePrefix: "FI",
    },
  });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({
    data: { emailNormalized: `${uuid()}@example.com` },
  });
  const membership = await prisma.schoolMembership.create({
    data: { schoolId: school.id, userIdentityId: identity.id },
  });
  const position = await prisma.schoolPosition.create({
    data: {
      schoolId: school.id,
      code: `FINANCE_${uuid().replaceAll("-", "").slice(0, 12)}`,
      name: `Finance ${uuid()}`,
    },
  });
  await prisma.positionCapabilityGrant.createMany({
    data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE"].map((capability) => ({
      schoolId: school.id,
      positionId: position.id,
      capability,
    })),
  });
  await prisma.staffProfile.create({
    data: {
      schoolId: school.id,
      fullName: "Finance actor",
      email: identity.emailNormalized,
      phone: "0900000000",
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      gender: "Khác",
      address: "Test",
      primaryPositionId: position.id,
      schoolMembershipId: membership.id,
      boundAt: new Date(),
      boundByMembershipId: membership.id,
    },
  });
  return { school, identity, membership, position };
}

type GroupKind = "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR";
// Schools created by graph() bypass provisioning, so give them the three typed groups first.
async function group(input: Awaited<ReturnType<typeof graph>>, kind: GroupKind = "FLEXIBLE") {
  await prisma.receivableGroup.createMany({
    data: [
      { schoolId: input.school.id, kind: "FIXED", name: "Khoản thu cố định" },
      { schoolId: input.school.id, kind: "FLEXIBLE", name: "Khoản thu linh hoạt" },
      { schoolId: input.school.id, kind: "EXTRACURRICULAR", name: "Ngoại khóa" },
    ],
    skipDuplicates: true,
  });
  const found = await prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: input.school.id, kind } });
  return { id: found.id, outcome: { id: found.id } };
}

async function roster(input: Awaited<ReturnType<typeof graph>>) {
  const year = await prisma.schoolYear.create({
    data: {
      schoolId: input.school.id,
      name: "Năm học 2026",
      startsOn: date("2026-01-01"),
      endsOn: date("2027-01-01"),
    },
  });
  const activeClass = await prisma.class.create({
    data: {
      schoolId: input.school.id,
      schoolYearId: year.id,
      name: "Mầm Active",
    },
  });
  const archivedClass = await prisma.class.create({
    data: {
      schoolId: input.school.id,
      schoolYearId: year.id,
      name: "Mầm Archived",
      status: "ARCHIVED",
    },
  });
  return { ...input, year, activeClass, archivedClass };
}

async function enrolled(
  input: Awaited<ReturnType<typeof roster>>,
  options: {
    lifecycle?: "ENROLLED" | "TRIAL";
    classId?: string;
    assignment?: boolean;
    effectiveFrom?: string;
    effectiveTo?: string;
  } = {},
) {
  const student = await prisma.student.create({
    data: {
      schoolId: input.school.id,
      studentCode: `HS-${uuid()}`,
      fullName: "Học sinh Finance",
      dateOfBirth: date("2022-01-01"),
    },
  });
  const classId = options.classId ?? input.activeClass.id;
  const enrollment = await prisma.studentEnrollment.create({
    data: {
      schoolId: input.school.id,
      studentId: student.id,
      schoolYearId: input.year.id,
      classId,
      lifecycle: options.lifecycle ?? "ENROLLED",
      effectiveFrom: date("2026-01-01"),
      schoolYearName: input.year.name,
      schoolYearStartsOn: input.year.startsOn,
      schoolYearEndsOn: input.year.endsOn,
      className:
        classId === input.archivedClass.id
          ? input.archivedClass.name
          : input.activeClass.name,
    },
  });
  if (options.assignment !== false)
    await prisma.enrollmentClassAssignment.create({
      data: {
        schoolId: input.school.id,
        enrollmentId: enrollment.id,
        schoolYearId: input.year.id,
        classId,
        effectiveFrom: date(options.effectiveFrom ?? "2026-01-01"),
        effectiveTo: options.effectiveTo ? date(options.effectiveTo) : null,
        reason: "Finance test",
      },
    });
  return { student, enrollment };
}

async function open(
  input: Awaited<ReturnType<typeof roster>>,
  billingMonth = "2026-09",
) {
  const opened = await finance.openRun(input.identity.id, input.school.id, uuid(), uuid(), {
    schoolYearId: input.year.id,
    billingMonth,
  });
  const runId = outcomeId(opened);
  if (!await prisma.collectionRunTemplateLine.count({ where: { schoolId: input.school.id, collectionRunId: runId } })) {
    try {
      const groupId = outcomeId(await group(input));
      const receivableId = outcomeId(await finance.createReceivable(input.identity.id, input.school.id, uuid(), uuid(), { groupId, displayName: "Khoản thu mẫu", unitLabel: "lần", defaultUnitPrice: "1" }));
      await prisma.collectionRunTemplateLine.create({ data: { schoolId: input.school.id, collectionRunId: runId, receivableId, quantity: 1 } });
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002") throw error;
    }
  }
  return opened;
}

async function issueFixture(price = "9007199254740991") {
  const current = await roster(await graph());
  const student = await enrolled(current);
  const groupId = outcomeId(await group(current));
  const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: price }));
  const runId = outcomeId(await open(current));
  const template = await finance.run(current.identity.id, current.school.id, runId);
  await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
  await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
  const preview = await finance.preview(current.identity.id, current.school.id, runId);
  await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const generated = await generate(current, runId);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  expect(generated).toMatchObject({ status: "COMPLETED", outcome: expect.anything() });
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
  const operationId = uuid();
  await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
  const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng Ánh Hoa", bankBin: "970436", accountNumber: "123456789", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: bank.id, status: "ACTIVE", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId, sequence: 1 } });
  await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  return { current, student, receivableId, invoice, bank, operationId };
}

// Holds an open transaction (lock/uncommitted change in place) until released, to stage a race deterministically.
async function holding(work: (tx: Prisma.TransactionClient) => Promise<void>) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  let ready!: () => void;
  const started = new Promise<void>((resolve) => { ready = resolve; });
  const done = prisma.$transaction(async (tx) => { await work(tx); ready(); await gate; }, { timeout: 30000, maxWait: 30000 });
  done.catch(() => ready());
  await started;
  return { release, done };
}
// Starts a command and proves it is still waiting on the held lock before the holder commits.
async function blockedUntil<T>(command: () => Promise<T>, release: () => void) {
  let settled = false;
  const result = command().then((value) => { settled = true; return value; }, (error) => { settled = true; throw error; });
  result.catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 500));
  expect(settled).toBe(false);
  release();
  return result;
}

const outcomeId = (value: { outcome: unknown }) =>
  (value.outcome as { id: string }).id;

async function generate(input: Awaited<ReturnType<typeof roster>>, runId: string, key = uuid(), operationId = uuid()) {
  const queued = await finance.generateRun(input.identity.id, input.school.id, runId, key, operationId);
  while ((await finance.operation(input.identity.id, input.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
  return finance.operation(input.identity.id, input.school.id, queued.id);
}

async function promotion(
  input: Awaited<ReturnType<typeof roster>>,
  studentId: string,
  receivableId: string,
  options: { name: string; discountType: "FIXED_VND" | "PERCENTAGE"; discountValue: string; priority: string; stackingMode: "STACKABLE" | "EXCLUSIVE"; fulfillmentMode?: "DISCOUNT" | "PREPAID_COVERAGE"; prepaidTermMonths?: number },
) {
  const isPrepaid = options.fulfillmentMode === "PREPAID_COVERAGE";
  const created = await finance.createPromotionPolicy(input.identity.id, input.school.id, uuid(), uuid(), {
    ...options,
    prepaidTermMonths: isPrepaid ? (options.prepaidTermMonths ?? 2) : undefined,
    receivableIds: [receivableId],
    effectiveFrom: "2026-09-01",
  });
  const versionId = (created.outcome as any).versions[0].id;
  await finance.activatePromotionVersion(input.identity.id, input.school.id, versionId, uuid(), uuid());
  if (!isPrepaid) {
    await finance.assignPromotionStudents(input.identity.id, input.school.id, versionId, uuid(), uuid(), {
      studentIds: [studentId], effectiveFrom: "2026-09-01", reason: "Ưu đãi integration",
    });
  }
  return versionId;
}

async function coverageFixture(reversalMode: "DIRECT" | "SCHOOL_ADMIN_APPROVAL" = "DIRECT", taxCategory?: string) {
  const current = await roster(await graph());
  const student = await enrolled(current);
  await prisma.schoolCalendarVersion.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  const groupId = outcomeId(await group(current));
  const coveredReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Học phí coverage", unitLabel: "tháng", defaultUnitPrice: "100", ...(taxCategory ? { taxCategory } : {}) }));
  const otherReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Tiền ăn bình thường", unitLabel: "tháng", defaultUnitPrice: "25" }));
  const versionId = await promotion(current, student.student.id, coveredReceivableId, { name: "Nộp trước", discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "EXCLUSIVE", fulfillmentMode: "PREPAID_COVERAGE", prepaidTermMonths: 2 });
  const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
  await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: coveredReceivableId, quantity: "1", expectedVersion: 1 });
  const preview = await finance.preview(current.identity.id, current.school.id, runId);
  await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const generated = await generate(current, runId);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  let invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: student.student.id } });
  await finance.applyInvoiceCoverage(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { versionId });
  invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: student.student.id } });
  const operationId = uuid();
  await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
  const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng Ánh Hoa", bankBin: "970436", accountNumber: "123456789", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", kind: taxCategory && taxCategory !== "NOT_DECLARED" ? "SCHOOL" : "PERSONAL", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: bank.id, status: "ACTIVE", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId, sequence: 1 } });
  await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode, actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  const eligibilityOperationId = uuid();
  await prisma.operation.create({ data: { id: eligibilityOperationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture-eligibility", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
  await prisma.coverageRefundEligibility.create({ data: { schoolId: current.school.id, studentId: student.student.id, enrollmentId: student.enrollment.id, reason: "WITHDRAWAL", effectiveOn: date("2026-10-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId: eligibilityOperationId } });
  return { current, student, versionId, coveredReceivableId, otherReceivableId, runId, invoice, bank };
}

async function schoolAdmin(input: Awaited<ReturnType<typeof roster>>) {
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: input.school.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: input.school.id, code: `ADMIN_${uuid().slice(0, 8)}`, name: `Admin ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE", "SETTINGS_MANAGE"].map((capability) => ({ schoolId: input.school.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: input.school.id, fullName: "School Admin", email: identity.emailNormalized, phone: "0900000001", dateOfBirth: date("1990-01-01"), primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  return { identity, membership };
}

async function closeCoverage(fixture: Awaited<ReturnType<typeof coverageFixture>>) {
  await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
  const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
  await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() });
  return prisma.studentPromotionalCoverage.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, sourceInvoiceId: fixture.invoice.id, billingMonth: "2026-10" } });
}

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.financeReportExport.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.financeLedgerEvent.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunGenerationItem.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunGeneration.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.issuedPromotionApplication.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.coverageReversal.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.coverageReversalRequest.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.coverageRefundEligibility.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.debtTransfer.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.settlementTransfer.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.studentPromotionalCoverage.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.invoicePromotionCoverageFact.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.invoiceLine.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.settlementCarry.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.settlementDifference.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receipt.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.invoice.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunTemplateScopeClass.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunTemplateScopeStudent.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunTemplateLine.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunCoverageSelection.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.bankAccountLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.bankAccount.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.financePolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    await tx.studentPromotionAssignment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.promotionPolicyTarget.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.promotionPolicyVersion.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.promotionPolicy.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableLifecycleTransition.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.receivableGroupLifecycleTransition.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.receivable.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.receivableGroup.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunLifecycleTransition.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.collectionRun.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.enrollmentClassAssignment.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.studentEnrollmentLifecycleTransition.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.studentEnrollment.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.student.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.class.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolCalendarHoliday.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolYear.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.operation.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.positionCapabilityGrant.deleteMany({
      where: { schoolId: { in: ids } },
    });
    await tx.schoolPosition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.schoolMembership.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)(
  "finance PostgreSQL invariants",
  () => {
    it("persists Finance-authorized active catalog records, BIGINT VND, audit, and Operations", async () => {
      const current = await graph();
      const createdGroup = await group(current);
      const groupId = (createdGroup.outcome as { id: string }).id;
      const created = await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        {
          groupId,
          code: "TUITION",
          displayName: "Học phí",
          unitLabel: "tháng",
          defaultUnitPrice: "123456789",
        },
      );
      const receivableId = (created.outcome as { id: string }).id;

      expect(created).toMatchObject({
        status: "COMPLETED",
        outcome: {
          id: receivableId,
          code: "TUITION",
          defaultUnitPrice: "123456789",
          status: "ACTIVE",
          available: true,
        },
      });
      expect(
        await prisma.receivable.findUniqueOrThrow({
          where: { id: receivableId },
        }),
      ).toMatchObject({
        schoolId: current.school.id,
        groupId,
        defaultUnitPrice: 123456789n,
      });
       expect(
         await prisma.operation.findUniqueOrThrow({ where: { id: created.id } }),
       ).toMatchObject({ schoolId: current.school.id, status: "COMPLETED" });
       expect(await prisma.receivableGroup.findMany({ where: { schoolId: current.school.id }, orderBy: { kind: "asc" }, select: { kind: true, name: true } })).toEqual([
         { kind: "FIXED", name: "Khoản thu cố định" },
         { kind: "FLEXIBLE", name: "Khoản thu linh hoạt" },
         { kind: "EXTRACURRICULAR", name: "Ngoại khóa" },
       ]);
       expect(
         await prisma.auditRecord.findFirstOrThrow({
          where: { schoolId: current.school.id, action: "RECEIVABLE_CREATED" },
        }),
      ).toMatchObject({
        membershipId: current.membership.id,
        provenance: {
          operationId: created.id,
          newValue: { id: receivableId, defaultUnitPrice: "123456789" },
        },
      });
      await expect(
        finance.read(current.identity.id, current.school.id),
      ).resolves.toMatchObject({
        groups: expect.arrayContaining([{ id: groupId, name: "Khoản thu linh hoạt", kind: "FLEXIBLE", createdAt: expect.any(String) }]),
        receivables: [
          { id: receivableId, available: true, kind: "FLEXIBLE", kindLocked: false, defaultUnitPrice: "123456789" },
        ],
      });
    });

    it("creates only active same-School multi-target promotion policies and atomically assigns valid Students", async () => {
      const current = await roster(await graph()); const foreign = await roster(await graph());
      const activeGroupId = outcomeId(await group(current));
      const activeOne = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: activeGroupId, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100" }));
      const activeTwo = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: activeGroupId, displayName: "Tiền ăn", unitLabel: "tháng", defaultUnitPrice: "50" }));
      const inactiveGroupId = outcomeId(await group(current, "FLEXIBLE"));
      const inactiveReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: inactiveGroupId, displayName: "Xe đưa đón", unitLabel: "tháng", defaultUnitPrice: "20" }));
      await finance.transitionReceivable(current.identity.id, current.school.id, inactiveReceivableId, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng" });
      const foreignGroupId = outcomeId(await group(foreign)); const foreignReceivableId = outcomeId(await finance.createReceivable(foreign.identity.id, foreign.school.id, uuid(), uuid(), { groupId: foreignGroupId, displayName: "Ngoại trường", unitLabel: "tháng", defaultUnitPrice: "10" }));
      const policyInput = { name: "Con cán bộ", receivableIds: [activeOne, activeTwo], discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE", effectiveFrom: "2026-09-01" };
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { ...policyInput, receivableIds: [activeOne, inactiveReceivableId] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { ...policyInput, receivableIds: [activeOne, foreignReceivableId] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
       const key = uuid(); const operationId = uuid(); const created = await finance.createPromotionPolicy(current.identity.id, current.school.id, key, operationId, policyInput);
       const versionId = ((created.outcome as any).versions[0]).id;
       await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, key, uuid(), policyInput)).resolves.toEqual(created);
       await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, key, uuid(), { ...policyInput, discountValue: "11" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
       const prepaidInput = { name: "Ưu đãi nộp trước 3 tháng", receivableIds: [activeOne], discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "EXCLUSIVE", fulfillmentMode: "PREPAID_COVERAGE", prepaidTermMonths: 3, effectiveFrom: "2026-09-01" };
       const prepaid = await finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), prepaidInput);
       expect(prepaid).toMatchObject({ status: "COMPLETED", outcome: { name: prepaidInput.name, versions: [{ status: "DRAFT", fulfillmentMode: "PREPAID_COVERAGE", prepaidTermMonths: 3 }] } });
       const [policiesBeforeDuplicate, versionsBeforeDuplicate, targetsBeforeDuplicate, auditsBeforeDuplicate] = await Promise.all([
         prisma.promotionPolicy.count({ where: { schoolId: current.school.id } }),
         prisma.promotionPolicyVersion.count({ where: { schoolId: current.school.id } }),
         prisma.promotionPolicyTarget.count({ where: { schoolId: current.school.id } }),
         prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "PROMOTION_POLICY_VERSION_CREATED" } }),
       ]);
       await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), prepaidInput)).rejects.toMatchObject({ status: 409, response: { code: "PROMOTION_POLICY_NAME_EXISTS", message: expect.any(String) } });
       await expect(Promise.all([
         prisma.promotionPolicy.count({ where: { schoolId: current.school.id } }),
         prisma.promotionPolicyVersion.count({ where: { schoolId: current.school.id } }),
         prisma.promotionPolicyTarget.count({ where: { schoolId: current.school.id } }),
         prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "PROMOTION_POLICY_VERSION_CREATED" } }),
       ])).resolves.toEqual([policiesBeforeDuplicate, versionsBeforeDuplicate, targetsBeforeDuplicate, auditsBeforeDuplicate]);
       expect(await prisma.promotionPolicyTarget.count({ where: { schoolId: current.school.id, versionId } })).toBe(2);
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "PROMOTION_POLICY_VERSION_CREATED" } })).toMatchObject({ provenance: { operationId } });
      await finance.activatePromotionVersion(current.identity.id, current.school.id, versionId, uuid(), uuid());
      const first = await enrolled(current); const second = await enrolled(current); const foreignStudent = await enrolled(foreign);
      await expect(finance.assignPromotionStudents(current.identity.id, current.school.id, versionId, uuid(), uuid(), { studentIds: [first.student.id, foreignStudent.student.id], effectiveFrom: "2026-09-01", reason: "Nhân viên" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { studentIds: expect.any(String) } } });
      expect(await prisma.studentPromotionAssignment.count({ where: { schoolId: current.school.id, versionId } })).toBe(0);
      const assigned = await finance.assignPromotionStudents(current.identity.id, current.school.id, versionId, uuid(), uuid(), { studentIds: [first.student.id, second.student.id], effectiveFrom: "2026-09-01", effectiveTo: "2026-09-15", reason: "Nhân viên" });
      expect(assigned.outcome).toMatchObject({ assignments: expect.arrayContaining([expect.objectContaining({ studentId: first.student.id }), expect.objectContaining({ studentId: second.student.id })]) });
      await expect(finance.assignPromotionStudents(current.identity.id, current.school.id, versionId, uuid(), uuid(), { studentIds: [first.student.id], effectiveFrom: "2026-09-15", reason: "Chồng lấp" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { studentIds: expect.any(String) } } });
      await expect(finance.assignPromotionStudents(current.identity.id, current.school.id, versionId, uuid(), uuid(), { studentIds: [first.student.id], effectiveFrom: "2026-09-16", reason: "Kề nhau" })).resolves.toMatchObject({ outcome: { assignments: [{ studentId: first.student.id }] } });
      expect(await prisma.operation.findUniqueOrThrow({ where: { id: assigned.id } })).toMatchObject({ schoolId: current.school.id, status: "COMPLETED" });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "STUDENT_PROMOTION_ASSIGNMENTS_CREATED" } })).toMatchObject({ membershipId: current.membership.id, provenance: { operationId: assigned.id } });
    });

    it("evaluates and persists PostgreSQL promotion calculations with deterministic ordering, exclusivity, caps, and provenance", async () => {
      const current = await roster(await graph());
      const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const create = (code: string, price: string) => finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code, displayName: code, unitLabel: "lần", defaultUnitPrice: price });
      const orderedId = outcomeId(await create("ORDERED", "100"));
      const exclusiveId = outcomeId(await create("EXCLUSIVE", "100"));
      const cappedId = outcomeId(await create("CAPPED", "100"));
      await promotion(current, student.student.id, orderedId, { name: "Fixed low", discountType: "FIXED_VND", discountValue: "30", priority: "1", stackingMode: "STACKABLE" });
      await promotion(current, student.student.id, orderedId, { name: "Fixed high", discountType: "FIXED_VND", discountValue: "20", priority: "10", stackingMode: "STACKABLE" });
      await promotion(current, student.student.id, orderedId, { name: "Percent", discountType: "PERCENTAGE", discountValue: "50", priority: "9", stackingMode: "STACKABLE" });
      const exclusiveVersionId = await promotion(current, student.student.id, exclusiveId, { name: "Exclusive", discountType: "FIXED_VND", discountValue: "30", priority: "1", stackingMode: "EXCLUSIVE" });
      await promotion(current, student.student.id, exclusiveId, { name: "Blocked percent", discountType: "PERCENTAGE", discountValue: "100", priority: "99", stackingMode: "STACKABLE" });
      await promotion(current, student.student.id, cappedId, { name: "Cap", discountType: "FIXED_VND", discountValue: "200", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      let version = 1;
      for (const receivableId of [orderedId, exclusiveId, cappedId]) await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: version++ });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      const lines = preview.eligible[0]!.lines;
      expect(lines.find((line: any) => line.receivableId === orderedId)).toMatchObject({ grossAmount: "100", discountAmount: "75", netAmount: "25", promotionEvaluation: { applications: [expect.objectContaining({ discountType: "FIXED_VND", discountValue: "20" }), expect.objectContaining({ discountType: "FIXED_VND", discountValue: "30" }), expect.objectContaining({ discountType: "PERCENTAGE", discountValue: "50" })] } });
      expect(lines.find((line: any) => line.receivableId === exclusiveId)).toMatchObject({ grossAmount: "100", discountAmount: "30", netAmount: "70", promotionEvaluation: { applications: [expect.objectContaining({ versionId: exclusiveVersionId, assignmentReason: "Ưu đãi integration" })] } });
      expect(lines.find((line: any) => line.receivableId === cappedId)).toMatchObject({ grossAmount: "100", discountAmount: "100", netAmount: "0" });
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      const generated = await generate(current, runId);
      expect(generated.status).toBe("COMPLETED");
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: student.student.id }, include: { lines: true } });
      expect(invoice.total).toBe(95n);
      expect(invoice.lines).toEqual(expect.arrayContaining([
        expect.objectContaining({ receivableId: orderedId, amount: 25n, grossAmount: 100n, discountAmount: 75n, netAmount: 25n, promotionEvaluationProvenance: expect.objectContaining({ applications: expect.any(Array) }) }),
        expect.objectContaining({ receivableId: exclusiveId, amount: 70n, grossAmount: 100n, discountAmount: 30n, netAmount: 70n, promotionEvaluationProvenance: expect.objectContaining({ applications: [expect.objectContaining({ versionId: exclusiveVersionId })] }) }),
        expect.objectContaining({ receivableId: cappedId, amount: 0n, grossAmount: 100n, discountAmount: 100n, netAmount: 0n }),
      ]));
    });

    it("rejects relevant promotion fact changes as PREVIEW_STALE before READY or generate writes", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Stale 1", discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current));
      const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const staleReady = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.retirePromotionVersion(current.identity.id, current.school.id, versionId, uuid(), uuid());
      await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: staleReady.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      expect(await prisma.collectionRunLifecycleTransition.count({ where: { schoolId: current.school.id, collectionRunId: runId, status: "READY" } })).toBe(0);
      const nextVersionId = await promotion(current, student.student.id, receivableId, { name: "Stale 2", discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      const currentPreview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: currentPreview.fingerprint });
      await finance.retirePromotionVersion(current.identity.id, current.school.id, nextVersionId, uuid(), uuid());
      await expect(finance.generateRun(current.identity.id, current.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      expect(await prisma.collectionRunGeneration.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(0);
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(0);
    });

    it("persists the staged promotion calculation when the worker runs after live policy facts change", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Staged", discountType: "FIXED_VND", discountValue: "25", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current));
      const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      const queued = await finance.generateRun(current.identity.id, current.school.id, runId, uuid(), uuid());
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.promotionPolicyVersion.update({ where: { id: versionId }, data: { discountValue: 99n } });
      });
      while ((await finance.operation(current.identity.id, current.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
      const completed = await finance.operation(current.identity.id, current.school.id, queued.id);
      expect(completed.status).toBe("COMPLETED");
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, receivableId } });
      expect(line).toMatchObject({ amount: 75n, grossAmount: 100n, discountAmount: 25n, netAmount: 75n, promotionEvaluationProvenance: expect.objectContaining({ applications: [expect.objectContaining({ versionId, discountValue: "25" })] }) });
      const later = await enrolled(current);
      await finance.assignPromotionStudents(current.identity.id, current.school.id, versionId, uuid(), uuid(), { studentIds: [later.student.id], effectiveFrom: "2026-09-01", reason: "Thêm sau generate" });
      await finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id });
      expect(await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, invoice: { studentId: later.student.id }, receivableId } })).toMatchObject({ amount: 1n, grossAmount: 100n, discountAmount: 99n, netAmount: 1n, promotionEvaluationProvenance: expect.objectContaining({ applications: [expect.objectContaining({ assignmentReason: "Thêm sau generate", versionInterval: ["2026-09-01T00:00:00.000Z", null], assignmentInterval: ["2026-09-01T00:00:00.000Z", null] })] }) });
    });

    it("uses policy ID as the equal-type and equal-priority tie-break in preview and persisted provenance", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      await promotion(current, student.student.id, receivableId, { name: "Tie A", discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      await promotion(current, student.student.id, receivableId, { name: "Tie B", discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      const policyIds = preview.eligible[0]!.lines[0]!.promotionEvaluation.applications.map((item: any) => item.policyId);
      expect(policyIds).toEqual([...policyIds].sort());
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      const persisted = ((await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, receivableId } })).promotionEvaluationProvenance as any).applications.map((item: any) => item.policyId);
      expect(persisted).toEqual(policyIds);
    });

    it("closes a generated run whose DRAFT invoices are all zero-net", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      await promotion(current, student.student.id, receivableId, { name: "Miễn toàn bộ", discountType: "FIXED_VND", discountValue: "100", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId); await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      expect(await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } })).toMatchObject({ status: "DRAFT", total: 0n });
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { reason: "Không còn nghĩa vụ" })).resolves.toMatchObject({ outcome: { status: "CLOSED" } });
    });

    it("serializes School-scoped promotion mutation and READY evaluation with the same transaction advisory lock", async () => {
      const current = await roster(await graph()); await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      let release!: () => void; const held = new Promise<void>((resolve) => { release = resolve; });
      const holder = prisma.$transaction(async (tx) => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${current.school.id}, 0))`; await held; });
      await new Promise((resolve) => setTimeout(resolve, 25));
      let readySettled = false; let mutationSettled = false;
      const ready = finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }).finally(() => { readySettled = true; });
      const mutation = finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { name: "Blocked by School lock", receivableIds: [receivableId], discountType: "FIXED_VND", discountValue: "1", priority: "1", stackingMode: "STACKABLE", effectiveFrom: "2026-09-01" }).finally(() => { mutationSettled = true; });
      await new Promise((resolve) => setTimeout(resolve, 25));
      expect(readySettled).toBe(false); expect(mutationSettled).toBe(false);
      release(); await holder;
      await expect(ready).resolves.toMatchObject({ outcome: { status: "READY" } });
      await expect(mutation).resolves.toMatchObject({ outcome: expect.any(Object) });
    });

    it("rejects duplicate codes and foreign group graphs without creating or disclosing catalog data", async () => {
      const current = await graph();
      const foreign = await graph();
      const currentGroup = await group(current);
      const foreignGroup = await group(foreign);
      const groupId = (currentGroup.outcome as { id: string }).id;
      const foreignGroupId = (foreignGroup.outcome as { id: string }).id;
      const input = {
        groupId,
        code: "MEAL",
        displayName: "Tiền ăn",
        unitLabel: "tháng",
        defaultUnitPrice: "1000",
      };
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          { ...input, code: "INVALID_VND", defaultUnitPrice: "0" },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { defaultUnitPrice: expect.any(String) } },
      });
      await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        input,
      );
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          input,
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { code: expect.any(String) } },
      });
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          { ...input, groupId: foreignGroupId, code: "FOREIGN" },
        ),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "RECEIVABLE_GROUP_NOT_FOUND" },
      });
      expect(
        await prisma.receivable.count({
          where: { schoolId: current.school.id },
        }),
      ).toBe(1);
      await expect(
        prisma.receivable.create({
          data: {
            schoolId: current.school.id,
            groupId: foreignGroupId,
            displayName: "Graph trực tiếp",
            unitLabel: "lần",
            defaultUnitPrice: 1n,
          },
        }),
      ).rejects.toMatchObject({ code: "P2003" });
    });

    it("keeps exactly three typed groups per School and refuses to create, rename, retype or remove one", async () => {
      const current = await graph();
      const foreign = await graph();
      await group(current);
      await group(foreign);
      const groups = await prisma.receivableGroup.findMany({ where: { schoolId: current.school.id }, orderBy: { kind: "asc" } });
      expect(groups.map((item) => item.kind)).toEqual(["FIXED", "FLEXIBLE", "EXTRACURRICULAR"]);
      const service = finance as unknown as Record<string, unknown>;
      expect(service.createGroup).toBeUndefined();
      expect(service.transitionGroup).toBeUndefined();
      await expect(prisma.receivableGroup.create({ data: { schoolId: current.school.id, kind: "FIXED", name: "Khoản thu cố định" } })).rejects.toThrow();
      await expect(prisma.receivableGroup.create({ data: { schoolId: current.school.id, kind: "FLEXIBLE", name: "Nhóm tự tạo" } })).rejects.toThrow();
      await expect(prisma.receivableGroup.update({ where: { id: groups[0]!.id }, data: { name: "Đổi tên" } })).rejects.toThrow(/fixed/);
      await expect(prisma.receivableGroup.update({ where: { id: groups[0]!.id }, data: { kind: "FLEXIBLE" } })).rejects.toThrow();
      await expect(prisma.receivableGroup.delete({ where: { id: groups[0]!.id } })).rejects.toThrow(/fixed/);
      expect(await prisma.receivableGroup.count({ where: { schoolId: current.school.id } })).toBe(3);
    });

    it("creates a Receivable by kind in the selected School and rejects unknown kinds and foreign or mismatched groups", async () => {
      const current = await graph();
      const foreign = await graph();
      const fixedId = outcomeId(await group(current, "FIXED"));
      const flexibleId = outcomeId(await group(current, "FLEXIBLE"));
      const foreignFixedId = outcomeId(await group(foreign, "FIXED"));
      const base = { unitLabel: "lần", defaultUnitPrice: "1000" };
      const byKind = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, kind: "EXTRACURRICULAR", displayName: "Tiếng Anh" });
      expect(byKind.outcome).toMatchObject({ kind: "EXTRACURRICULAR", kindLocked: false });
      const byGroup = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, groupId: flexibleId, displayName: "Dã ngoại" });
      expect(byGroup.outcome).toMatchObject({ kind: "FLEXIBLE", groupId: flexibleId });
      await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, kind: "CUSTOM", displayName: "X" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { kind: expect.any(String) } } });
      await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, displayName: "X" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { kind: expect.any(String) } } });
      await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, kind: "FIXED", groupId: flexibleId, displayName: "X" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { groupId: expect.any(String) } } });
      await expect(finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { ...base, groupId: foreignFixedId, displayName: "X" })).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_GROUP_NOT_FOUND" } });
      expect(await prisma.receivable.count({ where: { schoolId: current.school.id } })).toBe(2);
      expect(await prisma.receivable.count({ where: { schoolId: foreign.school.id } })).toBe(0);
      expect(fixedId).not.toBe(flexibleId);
    });

    it("serializes kind change against template-line creation in both directions", async () => {
      const current = await roster(await graph());
      await group(current);
      const flexible = await prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: current.school.id, kind: "FLEXIBLE" } });
      const mk = async (name: string) => outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: name, unitLabel: "lần", defaultUnitPrice: "100" }));
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));

      // Template line committed first: a concurrent kind change waits for the share lock holder, then is refused.
      const first = await mk("Dùng trước");
      const holder = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${first}::uuid AND "schoolId" = ${current.school.id}::uuid FOR SHARE`;
        await tx.collectionRunTemplateLine.create({ data: { schoolId: current.school.id, collectionRunId: runId, receivableId: first, quantity: 1 } });
      });
      await expect(blockedUntil(() => finance.updateReceivableKind(current.identity.id, current.school.id, first, uuid(), uuid(), { kind: "FLEXIBLE" }), holder.release)).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
      await holder.done;
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: first } })).toMatchObject({ groupId: expect.not.stringMatching(flexible.id) });

      // Kind change in flight first: template-line creation waits for it, then proceeds against the new kind.
      const second = await mk("Đổi trước");
      const changing = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${second}::uuid AND "schoolId" = ${current.school.id}::uuid FOR UPDATE`;
        await tx.$executeRaw`UPDATE "Receivable" SET "groupId" = ${flexible.id}::uuid WHERE "id" = ${second}::uuid`;
      });
      const version = (await finance.run(current.identity.id, current.school.id, runId)).version;
      const saved = await blockedUntil(() => finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: second, quantity: "1", expectedVersion: version }), changing.release);
      await changing.done;
      expect(saved.status).toBe("COMPLETED");
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: second }, include: { group: true } })).toMatchObject({ group: { kind: "FLEXIBLE" } });
      expect(await prisma.collectionRunTemplateLine.count({ where: { schoolId: current.school.id, receivableId: second } })).toBe(1);
      // Once used, the kind is locked for good.
      await expect(finance.updateReceivableKind(current.identity.id, current.school.id, second, uuid(), uuid(), { kind: "FIXED" })).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
    });

    it("serializes kind change against invoice-line creation in both directions", async () => {
      const fixture = await issueFixture("100000");
      const { current, invoice } = fixture;
      const flexible = await (async () => { await group(current); return prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: current.school.id, kind: "FLEXIBLE" } }); })();
      const mk = async (name: string) => outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: name, unitLabel: "lần", defaultUnitPrice: "100" }));
      const source = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, invoiceId: invoice.id } });

      // An Invoice line committed first: the concurrent kind change waits for it and is refused.
      const first = await mk("Dòng trước");
      const holder = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${first}::uuid AND "schoolId" = ${current.school.id}::uuid FOR SHARE`;
        await tx.$executeRaw`INSERT INTO "InvoiceLine" SELECT * FROM jsonb_populate_record(NULL::"InvoiceLine", to_jsonb((SELECT l FROM "InvoiceLine" l WHERE l."id" = ${source.id}::uuid)) || jsonb_build_object('id', gen_random_uuid(), 'receivableId', ${first}::text))`;
      });
      await expect(blockedUntil(() => finance.updateReceivableKind(current.identity.id, current.school.id, first, uuid(), uuid(), { kind: "FLEXIBLE" }), holder.release)).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
      await holder.done;
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: first }, include: { group: true } })).toMatchObject({ group: { kind: "FIXED" } });

      // Kind change in flight first: addInvoiceLine waits, then adds the line against the committed new kind.
      const second = await mk("Đổi trước dòng");
      const changing = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${second}::uuid AND "schoolId" = ${current.school.id}::uuid FOR UPDATE`;
        await tx.$executeRaw`UPDATE "Receivable" SET "groupId" = ${flexible.id}::uuid WHERE "id" = ${second}::uuid`;
      });
      const added = await blockedUntil(() => finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId: second, quantity: "1" }), changing.release);
      await changing.done;
      expect(added.status).toBe("COMPLETED");
      expect(await prisma.invoiceLine.count({ where: { schoolId: current.school.id, invoiceId: invoice.id, receivableId: second } })).toBe(1);
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: second }, include: { group: true } })).toMatchObject({ group: { kind: "FLEXIBLE" } });
      await expect(finance.updateReceivableKind(current.identity.id, current.school.id, second, uuid(), uuid(), { kind: "FIXED" })).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
    });

    it("keeps refund price <= default price when edits race, answering the loser with a controlled 400", async () => {
      const current = await graph();
      await group(current);
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "100000", refundUnitPrice: "0" }));
      const edit = (price: string, name = "Tiền ăn") => finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { displayName: name, unitLabel: "ngày", defaultUnitPrice: price, reason: "Đổi giá" });
      const refund = (value: string) => finance.updateReceivableRefundPrice(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { refundUnitPrice: value });
      const invariant = async () => { const row = await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } }); expect(row.refundUnitPrice <= row.defaultUnitPrice).toBe(true); return row; };

      // A refund raise is in flight (row locked, uncommitted): lowering the price waits, then sees it and is refused.
      const raising = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${receivableId}::uuid AND "schoolId" = ${current.school.id}::uuid FOR UPDATE`;
        await tx.$executeRaw`UPDATE "Receivable" SET "refundUnitPrice" = 90000 WHERE "id" = ${receivableId}::uuid`;
      });
      await expect(blockedUntil(() => edit("50000"), raising.release)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
      await raising.done;
      expect(await invariant()).toMatchObject({ defaultUnitPrice: 100000n, refundUnitPrice: 90000n });

      // A price drop is in flight: raising the refund price waits, then sees the lower price and is refused (no 500 from the CHECK).
      const dropping = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${receivableId}::uuid AND "schoolId" = ${current.school.id}::uuid FOR UPDATE`;
        await tx.$executeRaw`UPDATE "Receivable" SET "refundUnitPrice" = 0, "defaultUnitPrice" = 40000 WHERE "id" = ${receivableId}::uuid`;
      });
      await expect(blockedUntil(() => refund("60000"), dropping.release)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { refundUnitPrice: expect.any(String) } } });
      await dropping.done;
      expect(await invariant()).toMatchObject({ defaultUnitPrice: 40000n, refundUnitPrice: 0n });

      // Unstaged contention: whichever order wins, the invariant holds and any loser is a 400.
      const results = await Promise.allSettled([edit("30000"), refund("35000"), edit("31000", "Tiền ăn mới")]);
      for (const result of results) if (result.status === "rejected") expect((result.reason as { status?: number }).status).toBeLessThan(500);
      await invariant();
    });

    // ---- Story 5.35: fixed lines, flexible scopes, provenance ----------------------------------------------------------------
    async function scopeFixture() {
      const current = await roster(await graph());
      const groups = await group(current);
      void groups;
      const classB = await prisma.class.create({ data: { schoolId: current.school.id, schoolYearId: current.year.id, name: "Mầm B" } });
      const mk = async (kind: "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR", displayName: string, price: string, unit = "tháng") => outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind, displayName, unitLabel: unit, defaultUnitPrice: price }));
      const fee = await mk("FIXED", "Học phí tháng", "1000");
      const trip = await mk("FLEXIBLE", "Dã ngoại", "300", "lần");
      const uniform = await mk("FLEXIBLE", "Đồng phục", "200", "bộ");
      const english = await mk("EXTRACURRICULAR", "Tiếng Anh", "600");
      const retired = await mk("FIXED", "Phí cũ", "50");
      await finance.transitionReceivable(current.identity.id, current.school.id, retired, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng" });
      return { current, classA: current.activeClass, classB, fee, trip, uniform, english, retired };
    }
    const openRunFor = async (current: Awaited<ReturnType<typeof roster>>, month = "2026-09") => outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: month }));
    const saveLine = async (current: Awaited<ReturnType<typeof roster>>, runId: string, receivableId: string, extra: object = {}, quantity = "1") => {
      const version = (await finance.run(current.identity.id, current.school.id, runId)).version;
      return finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity, expectedVersion: version, ...extra });
    };
    const linesOf = async (current: Awaited<ReturnType<typeof roster>>, runId: string) => (await finance.run(current.identity.id, current.school.id, runId)).templateLines;

    it("seeds a new run with every ACTIVE FIXED receivable (quantity 1, for everyone) under audit, and lets Finance change or drop them while DRAFT", async () => {
      const f = await scopeFixture();
      const key = uuid();
      const opened = await finance.openRun(f.current.identity.id, f.current.school.id, key, uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-09" });
      const runId = outcomeId(opened);
      const lines = await linesOf(f.current, runId);
      expect(lines.map((line: any) => [line.receivableId, line.kind, line.quantity, line.scope.type, line.scope.label])).toEqual([[f.fee, "FIXED", "1", "ALL", "Toàn bộ"]]);
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: f.current.school.id, action: "COLLECTION_RUN_OPENED" } })).toMatchObject({ provenance: { operationId: opened.id, newValue: { seededFixedReceivableIds: [f.fee] } } });
      // Replay and re-open do not seed twice.
      expect(await finance.openRun(f.current.identity.id, f.current.school.id, key, uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-09" })).toEqual(opened);
      await finance.openRun(f.current.identity.id, f.current.school.id, uuid(), uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-09" });
      expect(await prisma.collectionRunTemplateLine.count({ where: { schoolId: f.current.school.id, collectionRunId: runId } })).toBe(1);
      // A later FIXED receivable only affects later runs.
      const late = outcomeId(await finance.createReceivable(f.current.identity.id, f.current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: "Xe đưa đón", unitLabel: "tháng", defaultUnitPrice: "800" }));
      expect(await linesOf(f.current, runId)).toHaveLength(1);
      const next = await openRunFor(f.current, "2026-10");
      expect((await linesOf(f.current, next)).map((line: any) => line.receivableId).sort()).toEqual([f.fee, late].sort());
      // Quantity change and removal while DRAFT.
      const changed = await saveLine(f.current, runId, f.fee, {}, "22");
      expect((changed.outcome as any).templateLines[0]).toMatchObject({ quantity: "22", scope: { type: "ALL" } });
      const lineId = (changed.outcome as any).templateLines[0].id;
      await finance.removeTemplateLine(f.current.identity.id, f.current.school.id, runId, lineId, uuid(), uuid(), { expectedVersion: (await finance.run(f.current.identity.id, f.current.school.id, runId)).version });
      expect(await linesOf(f.current, runId)).toEqual([]);
    });

    it("validates scope: EXTRACURRICULAR refused, FIXED forced to ALL, empty/foreign/other-year targets refused, in the API and the database", async () => {
      const f = await scopeFixture();
      const foreign = await roster(await graph());
      await group(foreign);
      const foreignClass = foreign.activeClass.id;
      const foreignStudent = (await enrolled(foreign)).student.id;
      const otherYear = await prisma.schoolYear.create({ data: { schoolId: f.current.school.id, name: "Năm 2027", startsOn: date("2027-01-01"), endsOn: date("2028-01-01") } });
      const otherClass = await prisma.class.create({ data: { schoolId: f.current.school.id, schoolYearId: otherYear.id, name: "Lớp năm sau" } });
      const otherStudent = await prisma.student.create({ data: { schoolId: f.current.school.id, studentCode: `HS-${uuid()}`, fullName: "Chỉ năm sau", dateOfBirth: date("2022-01-01") } });
      await prisma.studentEnrollment.create({ data: { schoolId: f.current.school.id, studentId: otherStudent.id, schoolYearId: otherYear.id, classId: otherClass.id, lifecycle: "ENROLLED", effectiveFrom: date("2027-02-01"), schoolYearName: "n", schoolYearStartsOn: otherYear.startsOn, schoolYearEndsOn: otherYear.endsOn, className: otherClass.name } });
      const mine = (await enrolled(f.current)).student.id;
      const runId = await openRunFor(f.current);
      const refuse = (receivableId: string, scope: object | undefined, field: string) => expect(saveLine(f.current, runId, receivableId, scope ? { scope } : {})).rejects.toMatchObject({ status: 400, response: { fieldErrors: { [field]: expect.any(String) } } });
      await refuse(f.english, undefined, "receivableId");
      await refuse(f.retired, undefined, "receivableId");
      await refuse(f.fee, { type: "CLASSES", classIds: [f.classA.id] }, "scope");
      await refuse(f.fee, { type: "STUDENTS", studentIds: [mine] }, "scope");
      await refuse(f.trip, { type: "CLASSES", classIds: [] }, "scope");
      await refuse(f.trip, { type: "CLASSES" }, "scope");
      await refuse(f.trip, { type: "STUDENTS", studentIds: [] }, "scope");
      await refuse(f.trip, { type: "NOPE" }, "scope");
      await refuse(f.trip, { type: "CLASSES", classIds: [f.classA.id, f.classA.id] }, "scope");
      await refuse(f.trip, { type: "CLASSES", classIds: [foreignClass] }, "scope");
      await refuse(f.trip, { type: "CLASSES", classIds: [otherClass.id] }, "scope");
      await refuse(f.trip, { type: "CLASSES", classIds: [f.classA.id, uuid()] }, "scope");
      await refuse(f.trip, { type: "STUDENTS", studentIds: [foreignStudent] }, "scope");
      await refuse(f.trip, { type: "STUDENTS", studentIds: [otherStudent.id] }, "scope");
      expect(await prisma.collectionRunTemplateLine.count({ where: { schoolId: f.current.school.id, collectionRunId: runId, receivableId: f.trip } })).toBe(0);
      // Accepted: classes, then replaced by students (children replaced as a whole), then back to ALL.
      let saved: any = await saveLine(f.current, runId, f.trip, { scope: { type: "CLASSES", classIds: [f.classB.id, f.classA.id] } });
      expect(saved.outcome.templateLines.find((line: any) => line.receivableId === f.trip).scope).toMatchObject({ type: "CLASSES", label: "Lớp chính thức: Mầm Active, Mầm B" });
      saved = await saveLine(f.current, runId, f.trip, { scope: { type: "STUDENTS", studentIds: [mine] } });
      expect(await prisma.collectionRunTemplateScopeClass.count({ where: { schoolId: f.current.school.id } })).toBe(0);
      expect(await prisma.collectionRunTemplateScopeStudent.count({ where: { schoolId: f.current.school.id } })).toBe(1);
      saved = await saveLine(f.current, runId, f.trip, {}, "2");
      expect(saved.outcome.templateLines.find((line: any) => line.receivableId === f.trip)).toMatchObject({ quantity: "2", scope: { type: "STUDENTS" } });
      saved = await saveLine(f.current, runId, f.trip, { scope: { type: "ALL" } });
      expect(saved.outcome.templateLines.find((line: any) => line.receivableId === f.trip).scope.type).toBe("ALL");
      expect(await prisma.collectionRunTemplateScopeStudent.count({ where: { schoolId: f.current.school.id } })).toBe(0);
      // Database backstops.
      await expect(prisma.collectionRunTemplateLine.create({ data: { schoolId: f.current.school.id, collectionRunId: runId, receivableId: f.english, quantity: 1 } })).rejects.toThrow(/EXTRACURRICULAR/);
      const feeLine = await prisma.collectionRunTemplateLine.findFirstOrThrow({ where: { schoolId: f.current.school.id, collectionRunId: runId, receivableId: f.fee } });
      await expect(prisma.collectionRunTemplateLine.update({ where: { id: feeLine.id }, data: { scopeType: "CLASSES" } })).rejects.toThrow(/FIXED/);
      await expect(prisma.collectionRunTemplateScopeClass.create({ data: { schoolId: f.current.school.id, schoolYearId: f.current.year.id, templateLineId: feeLine.id, classId: f.classA.id } })).rejects.toThrow(/CLASSES template line/);
      const tripLine = await prisma.collectionRunTemplateLine.findFirstOrThrow({ where: { schoolId: f.current.school.id, collectionRunId: runId, receivableId: f.trip } });
      const retype = (target: () => Promise<unknown>) => prisma.$transaction(async (tx) => { await tx.collectionRunTemplateLine.update({ where: { id: tripLine.id }, data: { scopeType: "CLASSES" } }); await target(); });
      await expect(retype(() => prisma.collectionRunTemplateScopeClass.create({ data: { schoolId: f.current.school.id, schoolYearId: otherYear.id, templateLineId: tripLine.id, classId: otherClass.id } }))).rejects.toThrow();
      await expect(retype(() => prisma.collectionRunTemplateScopeClass.create({ data: { schoolId: f.current.school.id, schoolYearId: f.current.year.id, templateLineId: tripLine.id, classId: foreignClass } }))).rejects.toThrow();
      // Picker aid: ACTIVE official Classes of the run's year and a bounded Student search; never another School's data.
      const options = await finance.runScopeOptions(f.current.identity.id, f.current.school.id, runId, {});
      expect(options.classes.map((item) => item.id).sort()).toEqual([f.classA.id, f.classB.id].sort());
      expect(options.students.map((item) => item.id)).toContain(mine);
      expect(options.students.map((item) => item.id)).not.toContain(otherStudent.id);
      expect((await finance.runScopeOptions(f.current.identity.id, f.current.school.id, runId, { q: "zzz-no-match" })).students).toEqual([]);
      await expect(finance.runScopeOptions(foreign.identity.id, foreign.school.id, runId, {})).rejects.toMatchObject({ status: 404, response: { code: "COLLECTION_RUN_NOT_FOUND" } });
      // Foreign actor cannot see or edit this run.
      await expect(finance.saveTemplateLine(foreign.identity.id, foreign.school.id, runId, uuid(), uuid(), { receivableId: f.trip, quantity: "1", expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
    });

    it("resolves class scope on the first day of the month, reports per-line counts and subtotals, and goes stale on any scope change", async () => {
      const f = await scopeFixture();
      const s1 = await enrolled(f.current, { classId: f.classA.id });
      const s2 = await enrolled(f.current, { classId: f.classB.id });
      // s3 moves from A to B on 15/09: the class effective on 01/09 is A.  s4 moved from B to A before the month: class is A.
      const s3 = await enrolled(f.current, { classId: f.classA.id, effectiveTo: "2026-09-15" });
      await prisma.enrollmentClassAssignment.create({ data: { schoolId: f.current.school.id, enrollmentId: s3.enrollment.id, schoolYearId: f.current.year.id, classId: f.classB.id, effectiveFrom: date("2026-09-15"), reason: "Chuyển lớp" } });
      const s4 = await enrolled(f.current, { classId: f.classB.id, effectiveTo: "2026-08-31" });
      await prisma.enrollmentClassAssignment.create({ data: { schoolId: f.current.school.id, enrollmentId: s4.enrollment.id, schoolYearId: f.current.year.id, classId: f.classA.id, effectiveFrom: date("2026-08-31"), reason: "Chuyển lớp" } });
      const runId = await openRunFor(f.current);
      await saveLine(f.current, runId, f.trip, { scope: { type: "CLASSES", classIds: [f.classA.id] } }, "2");
      await saveLine(f.current, runId, f.uniform, { scope: { type: "STUDENTS", studentIds: [s2.student.id] } });
      const preview = await finance.preview(f.current.identity.id, f.current.school.id, runId);
      const byReceivable = Object.fromEntries(preview.lineSummaries.map((line: any) => [line.receivableId, line]));
      expect(byReceivable[f.fee]).toMatchObject({ kind: "FIXED", scope: { type: "ALL", label: "Toàn bộ" }, studentCount: 4, subtotal: "4000" });
      expect(byReceivable[f.trip]).toMatchObject({ kind: "FLEXIBLE", scope: { type: "CLASSES", label: "Lớp chính thức: Mầm Active" }, studentCount: 3, subtotal: "1800" });
      expect(byReceivable[f.uniform]).toMatchObject({ studentCount: 1, subtotal: "200" });
      expect(preview.eligible.find((row: any) => row.studentId === s3.student.id).lines.map((line: any) => line.receivableId).sort()).toEqual([f.fee, f.trip].sort());
      expect(preview.eligible.find((row: any) => row.studentId === s2.student.id).lines.map((line: any) => line.receivableId).sort()).toEqual([f.fee, f.uniform].sort());
      // Any scope change makes the preview stale.
      await saveLine(f.current, runId, f.trip, { scope: { type: "CLASSES", classIds: [f.classA.id, f.classB.id] } }, "2");
      await expect(finance.readyRun(f.current.identity.id, f.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      const fresh = await finance.preview(f.current.identity.id, f.current.school.id, runId);
      expect(fresh.fingerprint).not.toBe(preview.fingerprint);
      expect(fresh.lineSummaries.find((line: any) => line.receivableId === f.trip)).toMatchObject({ studentCount: 4, subtotal: "2400" });
      // Narrow again, ready and generate: each Invoice carries FIXED plus only the FLEXIBLE lines whose scope includes the Student.
      await saveLine(f.current, runId, f.trip, { scope: { type: "CLASSES", classIds: [f.classA.id] } }, "2");
      const ready = await finance.preview(f.current.identity.id, f.current.school.id, runId);
      await finance.readyRun(f.current.identity.id, f.current.school.id, runId, uuid(), uuid(), { previewFingerprint: ready.fingerprint });
      await expect(saveLine(f.current, runId, f.trip, {})).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_NOT_DRAFT" } });
      expect((await generate(f.current, runId)).status).toBe("COMPLETED");
      const shape = async (studentId: string) => (await prisma.invoiceLine.findMany({ where: { schoolId: f.current.school.id, invoice: { collectionRunId: runId, studentId } }, orderBy: { receivableNameSnapshot: "asc" } })).map((line) => [line.receivableNameSnapshot, line.sourceKind, (line.sourceDetail as any)?.scope?.type]).sort((a, b) => (a[0]! < b[0]! ? -1 : 1));
      expect(await shape(s1.student.id)).toEqual([["Dã ngoại", "TEMPLATE_FLEXIBLE", "CLASSES"], ["Học phí tháng", "TEMPLATE_FIXED", "ALL"]]);
      expect(await shape(s2.student.id)).toEqual([["Học phí tháng", "TEMPLATE_FIXED", "ALL"], ["Đồng phục", "TEMPLATE_FLEXIBLE", "STUDENTS"]].sort((a, b) => (a[0]! < b[0]! ? -1 : 1)));
      expect(await shape(s3.student.id)).toEqual([["Dã ngoại", "TEMPLATE_FLEXIBLE", "CLASSES"], ["Học phí tháng", "TEMPLATE_FIXED", "ALL"]]);
      const trip = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: f.current.school.id, invoice: { collectionRunId: runId, studentId: s1.student.id }, receivableNameSnapshot: "Dã ngoại" } });
      expect(trip).toMatchObject({ quantity: 2, sourceDetail: { scope: { type: "CLASSES", label: "Lớp chính thức: Mầm Active", classes: [{ id: f.classA.id, name: "Mầm Active" }] } } });
      // Provenance is immutable; the run keeps its snapshot with scopes.
      await expect(prisma.invoiceLine.update({ where: { id: trip.id }, data: { sourceKind: "MANUAL" } })).rejects.toThrow(/immutable/);
      const snapshot = (await prisma.collectionRun.findUniqueOrThrow({ where: { id: runId } })).templateSnapshot as any[];
      expect(snapshot.find((line) => line.receivableId === f.trip)).toMatchObject({ kind: "FLEXIBLE", scope: { type: "CLASSES" } });
      // The review screen data: badges per line; a hand-added line is MANUAL.
      const invoiceId = (await prisma.invoice.findFirstOrThrow({ where: { schoolId: f.current.school.id, collectionRunId: runId, studentId: s1.student.id } })).id;
      const detail: any = await finance.invoice(f.current.identity.id, f.current.school.id, invoiceId);
      expect(detail.lines.map((line: any) => line.sourceBadge?.label).sort()).toEqual(["Cố định", "Linh hoạt · Lớp chính thức: Mầm Active"]);
      await finance.addInvoiceLine(f.current.identity.id, f.current.school.id, invoiceId, uuid(), uuid(), { receivableId: f.uniform, quantity: "1" });
      const added = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: f.current.school.id, invoiceId, receivableId: f.uniform } });
      expect(added.sourceKind).toBe("MANUAL");
      expect(((await finance.invoice(f.current.identity.id, f.current.school.id, invoiceId)) as any).lines.find((line: any) => line.receivableId === f.uniform).sourceBadge).toEqual({ kind: "MANUAL", label: "Sửa tay", flags: [], detail: "" });
    });

    it("skips eligible Students with no applicable line as NO_APPLICABLE_LINES and refuses generate only when nobody gets a line", async () => {
      const f = await scopeFixture();
      const inA = await enrolled(f.current, { classId: f.classA.id });
      const inB = await enrolled(f.current, { classId: f.classB.id });
      const runId = await openRunFor(f.current);
      const fixedLine = (await linesOf(f.current, runId))[0];
      await finance.removeTemplateLine(f.current.identity.id, f.current.school.id, runId, fixedLine.id, uuid(), uuid(), { expectedVersion: (await finance.run(f.current.identity.id, f.current.school.id, runId)).version });
      // Empty template: everybody is skipped, ready is allowed, generate is refused.
      let preview = await finance.preview(f.current.identity.id, f.current.school.id, runId);
      expect(preview.eligible).toEqual([]);
      expect(preview.skips.filter((skip: any) => skip.reason === "NO_APPLICABLE_LINES").map((skip: any) => skip.studentId).sort()).toEqual([inA.student.id, inB.student.id].sort());
      await finance.readyRun(f.current.identity.id, f.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(finance.generateRun(f.current.identity.id, f.current.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_NO_APPLICABLE_LINES" } });
      expect(await prisma.invoice.count({ where: { schoolId: f.current.school.id, collectionRunId: runId } })).toBe(0);
      expect((await finance.run(f.current.identity.id, f.current.school.id, runId)).status).toBe("READY");

      // A second month: only class A gets the flexible line; the class B Student is skipped, the rest are generated.
      const second = await openRunFor(f.current, "2026-10");
      await finance.removeTemplateLine(f.current.identity.id, f.current.school.id, second, (await linesOf(f.current, second))[0].id, uuid(), uuid(), { expectedVersion: (await finance.run(f.current.identity.id, f.current.school.id, second)).version });
      await saveLine(f.current, second, f.trip, { scope: { type: "CLASSES", classIds: [f.classA.id] } });
      preview = await finance.preview(f.current.identity.id, f.current.school.id, second);
      expect(preview.eligible.map((row: any) => row.studentId)).toEqual([inA.student.id]);
      expect(preview.skips).toEqual([expect.objectContaining({ studentId: inB.student.id, reason: "NO_APPLICABLE_LINES" })]);
      expect(preview.summary).toMatchObject({ eligibleCount: 1, skippedCount: 1 });
      await finance.readyRun(f.current.identity.id, f.current.school.id, second, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      const generated: any = await generate(f.current, second);
      expect(generated.status).toBe("COMPLETED");
      expect(generated.outcome.created.map((item: any) => item.studentId)).toEqual([inA.student.id]);
      expect(generated.outcome.skipped).toEqual([expect.objectContaining({ studentId: inB.student.id, reason: "NO_APPLICABLE_LINES" })]);
      expect(await prisma.invoice.count({ where: { schoolId: f.current.school.id, collectionRunId: second } })).toBe(1);

      // Adding a Student after GENERATED uses the snapshotted scopes: class A joins the flexible line, class B is skipped.
      const lateA = await enrolled(f.current, { classId: f.classA.id });
      const lateB = await enrolled(f.current, { classId: f.classB.id });
      const addedA: any = await finance.addGeneratedStudent(f.current.identity.id, f.current.school.id, second, uuid(), uuid(), { studentId: lateA.student.id });
      expect(addedA.outcome.created).toHaveLength(1);
      expect((await prisma.invoiceLine.findMany({ where: { schoolId: f.current.school.id, invoice: { collectionRunId: second, studentId: lateA.student.id } } })).map((line) => [line.receivableNameSnapshot, line.sourceKind])).toEqual([["Dã ngoại", "TEMPLATE_FLEXIBLE"]]);
      const addedB: any = await finance.addGeneratedStudent(f.current.identity.id, f.current.school.id, second, uuid(), uuid(), { studentId: lateB.student.id });
      expect(addedB.outcome.created).toEqual([]);
      expect(addedB.outcome.skipped).toEqual([expect.objectContaining({ reason: "NO_APPLICABLE_LINES" })]);
      // Idempotent replay and cross-School.
      const key = uuid();
      const first = await finance.addGeneratedStudent(f.current.identity.id, f.current.school.id, second, key, uuid(), { studentId: lateB.student.id });
      expect(await finance.addGeneratedStudent(f.current.identity.id, f.current.school.id, second, key, uuid(), { studentId: lateB.student.id })).toEqual(first);
    });

    // ---- Story 5.36: extracurricular lines from classes --------------------------------------------------------------------------
    async function extraFixture() {
      const current = await roster(await graph());
      await group(current);
      const mk = async (kind: "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR", displayName: string, price: string) => outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind, displayName, unitLabel: "tháng", defaultUnitPrice: price }));
      const fee = await mk("FIXED", "Học phí tháng", "1000");
      const english = await mk("EXTRACURRICULAR", "Tiếng Anh bản ngữ", "600");
      const drawing = await mk("EXTRACURRICULAR", "Năng khiếu vẽ", "400");
      const newClass = async (name: string, receivableId: string) => outcomeId(await finance.createExtracurricularClass(current.identity.id, current.school.id, uuid(), uuid(), { name, schoolYearId: current.year.id, receivableId }));
      const a1 = await newClass("Tiếng Anh A1", english);
      const a2 = await newClass("Tiếng Anh A2", english);
      const ve = await newClass("Vẽ thiếu nhi", drawing);
      const join = (classId: string, enrollmentIds: string[], effectiveFrom = "2026-09-01", effectiveTo?: string) => finance.addExtracurricularMemberships(current.identity.id, current.school.id, classId, uuid(), uuid(), { enrollmentIds, effectiveFrom, ...(effectiveTo ? { effectiveTo } : {}), reason: "Đăng ký" });
      const openFreshRun = async (keepFee = false) => {
        const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
        if (!keepFee) await finance.removeTemplateLine(current.identity.id, current.school.id, runId, (await finance.run(current.identity.id, current.school.id, runId)).templateLines[0]!.id, uuid(), uuid(), { expectedVersion: (await finance.run(current.identity.id, current.school.id, runId)).version });
        return runId;
      };
      return { current, fee, english, drawing, a1, a2, ve, join, openFreshRun };
    }
    const previewOf = (x: Awaited<ReturnType<typeof extraFixture>>, runId: string) => finance.preview(x.current.identity.id, x.current.school.id, runId);
    const linesByStudent = (preview: any, studentId: string) => (preview.eligible.find((row: any) => row.studentId === studentId)?.lines ?? []) as any[];
    const runVersion = async (x: Awaited<ReturnType<typeof extraFixture>>, runId: string) => (await finance.run(x.current.identity.id, x.current.school.id, runId)).version;
    const setExclusion = async (x: Awaited<ReturnType<typeof extraFixture>>, runId: string, classId: string, excluded: boolean, reason?: string, key = uuid()) => finance.setRunExtracurricularExclusion(x.current.identity.id, x.current.school.id, runId, classId, key, uuid(), { excluded, ...(reason ? { reason } : {}), expectedVersion: await runVersion(x, runId) });

    it("lists extracurricular classes with month members and bills merged lines with MID_MONTH and CLASS_CHANGE flags, ignoring memberships outside the month and ineligible Students", async () => {
      const x = await extraFixture();
      const s1 = await enrolled(x.current); const s2 = await enrolled(x.current); const s3 = await enrolled(x.current); const s4 = await enrolled(x.current); const s5 = await enrolled(x.current);
      const ineligible = await enrolled(x.current, { assignment: false });
      await x.join(x.a1, [s1.enrollment.id]);
      await x.join(x.a1, [s2.enrollment.id], "2026-09-14");
      await x.join(x.a1, [s3.enrollment.id], "2026-09-01", "2026-09-15");
      await x.join(x.a2, [s3.enrollment.id], "2026-09-16");
      await x.join(x.a1, [s4.enrollment.id], "2026-08-01", "2026-08-31");
      await x.join(x.ve, [s5.enrollment.id]);
      await x.join(x.a1, [ineligible.enrollment.id]);
      const runId = await x.openFreshRun();
      const list: any = await finance.runExtracurricularClasses(x.current.identity.id, x.current.school.id, runId);
      const byName = Object.fromEntries(list.classes.map((item: any) => [item.name, item]));
      expect(byName["Tiếng Anh A1"]).toMatchObject({ memberCount: 4, transferredCount: 0, excluded: false, receivableName: "Tiếng Anh bản ngữ", defaultUnitPrice: "600", receivableActive: true });
      expect(byName["Tiếng Anh A2"]).toMatchObject({ memberCount: 1, transferredCount: 1 });
      expect(byName["Vẽ thiếu nhi"]).toMatchObject({ memberCount: 1, transferredCount: 0 });
      const preview: any = await previewOf(x, runId);
      // s1, s2, s3 (merged once), s5 are billed; s4 (August only) and the Student without a class are not; nobody has a template line.
      expect(preview.eligible.map((row: any) => row.studentId).sort()).toEqual([s1.student.id, s2.student.id, s3.student.id, s5.student.id].sort());
      expect(preview.skips.filter((skip: any) => skip.reason === "NO_APPLICABLE_LINES").map((skip: any) => skip.studentId)).toEqual([s4.student.id]);
      expect(preview.skips.find((skip: any) => skip.studentId === ineligible.student.id)).toMatchObject({ reason: "NO_CLASS_ASSIGNMENT" });
      const line = (studentId: string) => linesByStudent(preview, studentId)[0];
      expect(line(s1.student.id)).toMatchObject({ kind: "EXTRACURRICULAR", receivableId: x.english, grossAmount: "600", extracurricular: { flags: [], classes: [{ name: "Tiếng Anh A1" }] } });
      expect(line(s2.student.id).extracurricular).toMatchObject({ flags: ["MID_MONTH"], classes: [{ name: "Tiếng Anh A1", effectiveFrom: "2026-09-14" }] });
      expect(linesByStudent(preview, s3.student.id)).toHaveLength(1);
      expect(line(s3.student.id).extracurricular).toMatchObject({ flags: ["CLASS_CHANGE"], classes: [{ name: "Tiếng Anh A1", effectiveTo: "2026-09-15" }, { name: "Tiếng Anh A2", effectiveFrom: "2026-09-16" }] });
      const summaries = Object.fromEntries(preview.lineSummaries.filter((item: any) => item.kind === "EXTRACURRICULAR").map((item: any) => [item.receivableName, item]));
      expect(summaries["Tiếng Anh bản ngữ"]).toMatchObject({ studentCount: 3, subtotal: "1800", scope: { label: "Tiếng Anh A1, Tiếng Anh A2" }, note: "1 HS chuyển lớp tính một lần", templateLineId: null });
      expect(summaries["Năng khiếu vẽ"]).toMatchObject({ studentCount: 1, subtotal: "400" });
      expect(preview.lineTotal).toBe("2200");
      expect(Object.fromEntries(preview.extracurricularClasses.map((item: any) => [item.id, item]))).toMatchObject({ [x.a1]: { billedStudents: 3, subtotal: "1800" }, [x.a2]: { billedStudents: 0, subtotal: "0" }, [x.ve]: { billedStudents: 1, subtotal: "400" } });

      // Excluding a whole class (DRAFT only) removes its members' lines, goes stale, restores, and is audited and idempotent.
      const stale = preview.fingerprint;
      const key = uuid();
      const excluded = await setExclusion(x, runId, x.ve, true, "Lớp nghỉ cả tháng", key);
      expect(excluded.outcome).toMatchObject({ id: runId });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: x.current.school.id, action: "COLLECTION_RUN_EXTRACURRICULAR_CLASS_EXCLUDED" } })).toMatchObject({ reason: "Lớp nghỉ cả tháng", provenance: { newValue: { classId: x.ve, className: "Vẽ thiếu nhi", excluded: true } } });
      expect(await finance.setRunExtracurricularExclusion(x.current.identity.id, x.current.school.id, runId, x.ve, key, uuid(), { excluded: true, reason: "Lớp nghỉ cả tháng", expectedVersion: (excluded.outcome as any).version - 1 })).toEqual(excluded);
      await expect(finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: stale })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      const afterExclude: any = await previewOf(x, runId);
      expect(afterExclude.eligible.map((row: any) => row.studentId)).not.toContain(s5.student.id);
      expect(afterExclude.skips.find((skip: any) => skip.studentId === s5.student.id)).toMatchObject({ reason: "NO_APPLICABLE_LINES" });
      expect(afterExclude.lineSummaries.find((item: any) => item.receivableName === "Năng khiếu vẽ")).toBeUndefined();
      expect((await finance.runExtracurricularClasses(x.current.identity.id, x.current.school.id, runId) as any).classes.find((item: any) => item.id === x.ve).excluded).toBe(true);
      await expect(setExclusion(x, runId, x.ve, true)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { excluded: expect.any(String) } } });
      await setExclusion(x, runId, x.ve, false);
      await expect(setExclusion(x, runId, x.ve, false)).rejects.toMatchObject({ status: 400 });
      expect((await previewOf(x, runId) as any).eligible.map((row: any) => row.studentId)).toContain(s5.student.id);
      await expect(finance.setRunExtracurricularExclusion(x.current.identity.id, x.current.school.id, runId, x.ve, uuid(), uuid(), { excluded: true, expectedVersion: 1 })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_VERSION_CONFLICT" } });
      // Excluding the first class of a merged pair re-attributes the merged Student to the remaining class.
      await setExclusion(x, runId, x.a1, true);
      const onlyA2: any = await previewOf(x, runId);
      expect(linesByStudent(onlyA2, s3.student.id)[0].extracurricular).toMatchObject({ flags: ["MID_MONTH"], classes: [{ name: "Tiếng Anh A2" }] });
      expect(onlyA2.eligible.map((row: any) => row.studentId).sort()).toEqual([s3.student.id, s5.student.id].sort());
      await setExclusion(x, runId, x.a1, false);
    });

    it("blocks READY on membership and receivable changes after the preview, refuses exclusions after DRAFT, and keeps tenants apart", async () => {
      const x = await extraFixture();
      const foreign = await extraFixture();
      const s1 = await enrolled(x.current); const s2 = await enrolled(x.current);
      await x.join(x.a1, [s1.enrollment.id]);
      const runId = await x.openFreshRun();
      let preview: any = await previewOf(x, runId);
      // A membership added after the preview makes it stale.
      await x.join(x.a1, [s2.enrollment.id]);
      await expect(finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      preview = await previewOf(x, runId);
      // So does an ended membership and a receivable price edit.
      const open = await prisma.extracurricularMembership.findFirstOrThrow({ where: { schoolId: x.current.school.id, enrollmentId: s2.enrollment.id } });
      await finance.endExtracurricularMemberships(x.current.identity.id, x.current.school.id, x.a1, uuid(), uuid(), { membershipIds: [open.id], effectiveTo: "2026-09-20", reason: "Nghỉ" });
      await expect(finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      preview = await previewOf(x, runId);
      await finance.updateReceivable(x.current.identity.id, x.current.school.id, x.english, uuid(), uuid(), { displayName: "Tiếng Anh bản ngữ", unitLabel: "tháng", defaultUnitPrice: "700", reason: "Tăng giá" });
      await expect(finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      preview = await previewOf(x, runId);
      expect(linesByStudent(preview, s1.student.id)[0]).toMatchObject({ grossAmount: "700" });
      await finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      // After READY no exclusion can change (API and database); a membership change now blocks generate.
      await expect(setExclusion(x, runId, x.a1, true)).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_NOT_DRAFT" } });
      await expect(prisma.collectionRunExtracurricularExclusion.create({ data: { schoolId: x.current.school.id, collectionRunId: runId, extracurricularClassId: x.a1, actorIdentityId: x.current.identity.id, membershipId: x.current.membership.id, operationId: (await prisma.operation.findFirstOrThrow({ where: { schoolId: x.current.school.id } })).id } })).rejects.toThrow(/DRAFT/);
      await x.join(x.a2, [s1.enrollment.id], "2026-09-10");
      await expect(finance.generateRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      expect(await prisma.invoice.count({ where: { schoolId: x.current.school.id, collectionRunId: runId } })).toBe(0);
      // Tenants: a foreign actor and a foreign class are indistinguishable from missing ones.
      const foreignRun = await foreign.openFreshRun();
      await expect(finance.runExtracurricularClasses(x.current.identity.id, x.current.school.id, foreignRun)).rejects.toMatchObject({ status: 404, response: { code: "COLLECTION_RUN_NOT_FOUND" } });
      const second = outcomeId(await finance.openRun(x.current.identity.id, x.current.school.id, uuid(), uuid(), { schoolYearId: x.current.year.id, billingMonth: "2026-10" }));
      for (const classId of [foreign.a1, uuid()]) await expect(finance.setRunExtracurricularExclusion(x.current.identity.id, x.current.school.id, second, classId, uuid(), uuid(), { excluded: true, expectedVersion: 1 })).rejects.toMatchObject({ status: 404, response: { code: "EXTRACURRICULAR_CLASS_NOT_FOUND" } });
      await expect(finance.setRunExtracurricularExclusion(foreign.current.identity.id, foreign.current.school.id, second, x.a1, uuid(), uuid(), { excluded: true, expectedVersion: 1 })).rejects.toMatchObject({ status: 404 });
      await expect(prisma.collectionRunExtracurricularExclusion.create({ data: { schoolId: x.current.school.id, collectionRunId: second, extracurricularClassId: foreign.a1, actorIdentityId: x.current.identity.id, membershipId: x.current.membership.id, operationId: (await prisma.operation.findFirstOrThrow({ where: { schoolId: x.current.school.id } })).id } })).rejects.toThrow();
    });

    it("generates extracurricular lines with immutable provenance, applies promotions, never rewrites after GENERATED, and adds a Student from live memberships and the snapshot", async () => {
      const x = await extraFixture();
      const s1 = await enrolled(x.current); const s2 = await enrolled(x.current); const s3 = await enrolled(x.current); const s5 = await enrolled(x.current);
      await x.join(x.a1, [s1.enrollment.id]);
      await x.join(x.a1, [s2.enrollment.id], "2026-09-14");
      await x.join(x.a1, [s3.enrollment.id], "2026-09-01", "2026-09-15");
      await x.join(x.a2, [s3.enrollment.id], "2026-09-16");
      await x.join(x.ve, [s5.enrollment.id]);
      await promotion(x.current, s1.student.id, x.english, { name: "Giảm tiếng Anh", discountType: "FIXED_VND", discountValue: "100", priority: "1", stackingMode: "STACKABLE" });
      const runId = await x.openFreshRun(true);
      await setExclusion(x, runId, x.ve, true, "Lớp nghỉ");
      const preview: any = await previewOf(x, runId);
      await finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      expect((await generate(x.current, runId)).status).toBe("COMPLETED");
      const detailOf = async (studentId: string) => (await prisma.invoiceLine.findMany({ where: { schoolId: x.current.school.id, invoice: { collectionRunId: runId, studentId } }, orderBy: { receivableNameSnapshot: "asc" } }));
      // s1: fee + discounted English line; s5 is in the excluded class so only the fixed fee remains.
      const l1 = await detailOf(s1.student.id);
      expect(l1.map((line) => [line.receivableNameSnapshot, line.sourceKind])).toEqual([["Học phí tháng", "TEMPLATE_FIXED"], ["Tiếng Anh bản ngữ", "EXTRACURRICULAR"]].sort((a, b) => (a[0]! < b[0]! ? -1 : 1)));
      const eng = l1.find((line) => line.sourceKind === "EXTRACURRICULAR")!;
      expect(eng).toMatchObject({ quantity: 1, unitPrice: 600n, defaultUnitPriceSnapshot: 600n, grossAmount: 600n, discountAmount: 100n, netAmount: 500n, sourceDetail: { receivableId: x.english, flags: [], classes: [{ id: x.a1, name: "Tiếng Anh A1", effectiveFrom: "2026-09-01", effectiveTo: null }] } });
      const l3 = (await detailOf(s3.student.id)).filter((line) => line.sourceKind === "EXTRACURRICULAR");
      expect(l3).toHaveLength(1);
      expect(l3[0]!.sourceDetail).toMatchObject({ flags: ["CLASS_CHANGE"], classes: [{ id: x.a1, effectiveTo: "2026-09-15" }, { id: x.a2, effectiveFrom: "2026-09-16" }] });
      expect((await detailOf(s2.student.id)).find((line) => line.sourceKind === "EXTRACURRICULAR")!.sourceDetail).toMatchObject({ flags: ["MID_MONTH"] });
      expect((await detailOf(s5.student.id)).map((line) => line.sourceKind)).toEqual(["TEMPLATE_FIXED"]);
      // Immutable provenance; review badges and flags come from the server.
      await expect(prisma.invoiceLine.update({ where: { id: eng.id }, data: { sourceKind: "MANUAL" } })).rejects.toThrow(/immutable/);
      const invoice3 = (await prisma.invoice.findFirstOrThrow({ where: { schoolId: x.current.school.id, collectionRunId: runId, studentId: s3.student.id } })).id;
      const badge = ((await finance.invoice(x.current.identity.id, x.current.school.id, invoice3)) as any).lines.find((line: any) => line.sourceKind === "EXTRACURRICULAR").sourceBadge;
      expect(badge).toMatchObject({ kind: "EXTRACURRICULAR", label: "Ngoại khóa · Tiếng Anh A1 → Tiếng Anh A2", flags: [{ code: "CLASS_CHANGE", label: "Chuyển lớp trong tháng" }] });
      expect(badge.detail).toContain("Tiếng Anh A1 đến 15/09");
      expect(badge.detail).toContain("Tiếng Anh A2 từ 16/09");
      const snapshot: any = (await prisma.collectionRun.findUniqueOrThrow({ where: { id: runId } })).extracurricularSnapshot;
      expect(snapshot.classes.map((item: any) => [item.name, item.excluded]).sort()).toEqual([["Tiếng Anh A1", false], ["Tiếng Anh A2", false], ["Vẽ thiếu nhi", true]]);
      // GENERATED is never rewritten: later membership and price changes leave every Invoice line as generated.
      const before = await prisma.invoiceLine.findMany({ where: { schoolId: x.current.school.id, invoice: { collectionRunId: runId } }, orderBy: { id: "asc" } });
      await x.join(x.a2, [s2.enrollment.id], "2026-09-20");
      await finance.updateReceivable(x.current.identity.id, x.current.school.id, x.english, uuid(), uuid(), { displayName: "Tiếng Anh bản ngữ", unitLabel: "tháng", defaultUnitPrice: "900", reason: "Tăng giá" });
      expect(await prisma.invoiceLine.findMany({ where: { schoolId: x.current.school.id, invoice: { collectionRunId: runId } }, orderBy: { id: "asc" } })).toEqual(before);

      // A Student added later: memberships are read now for the snapshotted, non-excluded classes; price comes from the snapshot.
      const late = await enrolled(x.current);
      await x.join(x.a2, [late.enrollment.id], "2026-09-10");
      await x.join(x.ve, [late.enrollment.id]);
      const lateClass = outcomeId(await finance.createExtracurricularClass(x.current.identity.id, x.current.school.id, uuid(), uuid(), { name: "Lớp mới sau đợt", schoolYearId: x.current.year.id, receivableId: x.drawing }));
      await x.join(lateClass, [late.enrollment.id]);
      const key = uuid();
      const added: any = await finance.addGeneratedStudent(x.current.identity.id, x.current.school.id, runId, key, uuid(), { studentId: late.student.id });
      expect(added.outcome.created).toHaveLength(1);
      const lines = await detailOf(late.student.id);
      expect(lines.map((line) => line.sourceKind).sort()).toEqual(["EXTRACURRICULAR", "TEMPLATE_FIXED"]);
      expect(lines.find((line) => line.sourceKind === "EXTRACURRICULAR")).toMatchObject({ receivableNameSnapshot: "Tiếng Anh bản ngữ", unitPrice: 600n, sourceDetail: { flags: ["MID_MONTH"], classes: [{ id: x.a2, name: "Tiếng Anh A2", effectiveFrom: "2026-09-10" }] } });
      expect(await finance.addGeneratedStudent(x.current.identity.id, x.current.school.id, runId, key, uuid(), { studentId: late.student.id })).toEqual(added);
      expect(await prisma.invoice.count({ where: { schoolId: x.current.school.id, collectionRunId: runId, studentId: late.student.id } })).toBe(1);
    });

    it("makes READY wait for an in-flight membership change and then sees it", async () => {
      const x = await extraFixture();
      const s1 = await enrolled(x.current); const s2 = await enrolled(x.current);
      await x.join(x.a1, [s1.enrollment.id]);
      const runId = await x.openFreshRun();
      const preview: any = await previewOf(x, runId);
      const operation = await prisma.operation.findFirstOrThrow({ where: { schoolId: x.current.school.id } });
      // A membership add in flight: class locked FOR UPDATE, membership row uncommitted.
      const adding = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "ExtracurricularClass" WHERE "id" = ${x.a1}::uuid AND "schoolId" = ${x.current.school.id}::uuid FOR UPDATE`;
        await tx.extracurricularMembership.create({ data: { schoolId: x.current.school.id, schoolYearId: x.current.year.id, extracurricularClassId: x.a1, enrollmentId: s2.enrollment.id, effectiveFrom: date("2026-09-01"), reason: "Đăng ký", actorIdentityId: x.current.identity.id, createdByMembershipId: x.current.membership.id, createOperationId: operation.id } });
      });
      await expect(blockedUntil(() => finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }), adding.release)).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      await adding.done;
      expect((await finance.run(x.current.identity.id, x.current.school.id, runId)).status).toBe("DRAFT");
      const fresh: any = await previewOf(x, runId);
      expect(fresh.eligible.map((row: any) => row.studentId).sort()).toEqual([s1.student.id, s2.student.id].sort());
      await finance.readyRun(x.current.identity.id, x.current.school.id, runId, uuid(), uuid(), { previewFingerprint: fresh.fingerprint });
    });

    it("guards template scope targets on every write and enforces the scope shape at commit", async () => {
      const f = await scopeFixture();
      const s1 = await enrolled(f.current, { classId: f.classA.id });
      const school = f.current.school.id;
      const extra = outcomeId(await finance.createReceivable(f.current.identity.id, school, uuid(), uuid(), { kind: "FLEXIBLE", displayName: "Phí khác", unitLabel: "lần", defaultUnitPrice: "10" }));
      const runId = await openRunFor(f.current);
      await saveLine(f.current, runId, f.trip, { scope: { type: "CLASSES", classIds: [f.classA.id] } });
      await saveLine(f.current, runId, f.uniform, { scope: { type: "STUDENTS", studentIds: [s1.student.id] } });
      const lineOf = (receivableId: string) => prisma.collectionRunTemplateLine.findFirstOrThrow({ where: { schoolId: school, collectionRunId: runId, receivableId } });
      const [tripLine, uniformLine, feeLine] = [await lineOf(f.trip), await lineOf(f.uniform), await lineOf(f.fee)];
      const shape = /Template scope .* needs matching targets/;
      // Shape at commit: CLASSES/STUDENTS without targets, deleting the last target, and ALL with targets are all rejected.
      await expect(prisma.collectionRunTemplateLine.create({ data: { schoolId: school, collectionRunId: runId, receivableId: extra, quantity: 1, scopeType: "CLASSES" } })).rejects.toThrow(shape);
      await expect(prisma.collectionRunTemplateLine.create({ data: { schoolId: school, collectionRunId: runId, receivableId: extra, quantity: 1, scopeType: "STUDENTS" } })).rejects.toThrow(shape);
      await expect(prisma.collectionRunTemplateScopeClass.deleteMany({ where: { schoolId: school, templateLineId: tripLine.id } })).rejects.toThrow(shape);
      await expect(prisma.collectionRunTemplateScopeStudent.deleteMany({ where: { schoolId: school, templateLineId: uniformLine.id } })).rejects.toThrow(shape);
      expect(await prisma.collectionRunTemplateScopeClass.count({ where: { schoolId: school, templateLineId: tripLine.id } })).toBe(1);
      expect(await prisma.collectionRunTemplateScopeStudent.count({ where: { schoolId: school, templateLineId: uniformLine.id } })).toBe(1);
      // Mixed targets and ALL-with-targets need the insert-time guards out of the way; the commit-time shape check still refuses them.
      await expect(prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('ALTER TABLE "CollectionRunTemplateScopeStudent" DISABLE TRIGGER collection_run_template_scope_student_guard');
        await tx.collectionRunTemplateScopeStudent.create({ data: { schoolId: school, templateLineId: tripLine.id, studentId: s1.student.id } });
      })).rejects.toThrow(shape);
      await expect(prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe('ALTER TABLE "CollectionRunTemplateLine" DISABLE TRIGGER collection_run_template_line_scope');
        await tx.collectionRunTemplateLine.update({ where: { id: tripLine.id }, data: { scopeType: "ALL" } });
      })).rejects.toThrow(shape);
      expect((await lineOf(f.trip)).scopeType).toBe("CLASSES");
      // Target semantics are re-validated on UPDATE: other-year class, student without an enrollment in the run's year, or a line of another type.
      const otherYear = await prisma.schoolYear.create({ data: { schoolId: school, name: "Năm 2027", startsOn: date("2027-01-01"), endsOn: date("2028-01-01") } });
      const otherClass = await prisma.class.create({ data: { schoolId: school, schoolYearId: otherYear.id, name: "Lớp năm sau" } });
      const stranger = await prisma.student.create({ data: { schoolId: school, studentCode: `HS-${uuid()}`, fullName: "Không ghi danh", dateOfBirth: date("2022-01-01") } });
      const classTarget = await prisma.collectionRunTemplateScopeClass.findFirstOrThrow({ where: { schoolId: school, templateLineId: tripLine.id } });
      const studentTarget = await prisma.collectionRunTemplateScopeStudent.findFirstOrThrow({ where: { schoolId: school, templateLineId: uniformLine.id } });
      await expect(prisma.collectionRunTemplateScopeClass.update({ where: { id: classTarget.id }, data: { schoolYearId: otherYear.id, classId: otherClass.id } })).rejects.toThrow(/CLASSES template line of the same SchoolYear/);
      await expect(prisma.collectionRunTemplateScopeClass.update({ where: { id: classTarget.id }, data: { templateLineId: feeLine.id } })).rejects.toThrow(/CLASSES template line/);
      await expect(prisma.collectionRunTemplateScopeStudent.update({ where: { id: studentTarget.id }, data: { studentId: stranger.id } })).rejects.toThrow(/enrollment in the run SchoolYear/);
      await expect(prisma.collectionRunTemplateScopeStudent.update({ where: { id: studentTarget.id }, data: { templateLineId: tripLine.id } })).rejects.toThrow(/STUDENTS template line/);
      // Moving a target to a line of another School fails too.
      const foreign = await roster(await graph());
      await expect(prisma.collectionRunTemplateScopeStudent.update({ where: { id: studentTarget.id }, data: { schoolId: foreign.school.id } })).rejects.toThrow();
      // After READY nothing about the targets may change, whoever writes.
      const preview = await finance.preview(f.current.identity.id, school, runId);
      await finance.readyRun(f.current.identity.id, school, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(prisma.collectionRunTemplateScopeClass.delete({ where: { id: classTarget.id } })).rejects.toThrow(/DRAFT/);
      await expect(prisma.collectionRunTemplateScopeStudent.delete({ where: { id: studentTarget.id } })).rejects.toThrow(/DRAFT/);
      await expect(prisma.collectionRunTemplateScopeClass.create({ data: { schoolId: school, schoolYearId: f.current.year.id, templateLineId: tripLine.id, classId: f.classB.id } })).rejects.toThrow(/DRAFT/);
      await expect(prisma.collectionRunTemplateScopeClass.update({ where: { id: classTarget.id }, data: { classId: f.classB.id } })).rejects.toThrow(/DRAFT/);
      await expect(prisma.collectionRunTemplateScopeStudent.update({ where: { id: studentTarget.id }, data: { studentId: s1.student.id } })).rejects.toThrow(/DRAFT/);
      expect(await prisma.collectionRunTemplateScopeClass.count({ where: { schoolId: school, templateLineId: tripLine.id } })).toBe(1);
    });

    it("serializes run seeding with a receivable deactivation through the per-School command lock", async () => {
      const f = await scopeFixture();
      const school = f.current.school.id;
      const late = outcomeId(await finance.createReceivable(f.current.identity.id, school, uuid(), uuid(), { kind: "FIXED", displayName: "Phí muộn", unitLabel: "tháng", defaultUnitPrice: "70" }));
      const operation = await prisma.operation.create({ data: { schoolId: school, membershipId: f.current.membership.id, actorIdentityId: f.current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: f.current.membership.id, route: "direct", fingerprint: "direct", idempotencyKey: uuid(), status: "COMPLETED" } });
      // A deactivation in flight holds what transitionReceivable holds: the School command lock, the receivable lock and an uncommitted INACTIVE transition.
      const deactivating = await holding(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${school}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${late}::uuid AND "schoolId" = ${school}::uuid FOR UPDATE`;
        await tx.receivableLifecycleTransition.create({ data: { schoolId: school, receivableId: late, previousStatus: "ACTIVE", status: "INACTIVE", reason: "Ngừng", actorIdentityId: f.current.identity.id, membershipId: f.current.membership.id, operationId: operation.id, sequence: 2 } });
      });
      const opened: any = await blockedUntil(() => finance.openRun(f.current.identity.id, school, uuid(), uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-09" }), deactivating.release);
      await deactivating.done;
      expect(opened.outcome.templateLines.map((line: any) => line.receivableId)).toEqual([f.fee]);
      // The other order: once the run exists, deactivating a seeded receivable does not touch the DRAFT line and the next run omits it.
      const next = outcomeId(await finance.openRun(f.current.identity.id, school, uuid(), uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-10" }));
      expect((await finance.run(f.current.identity.id, school, next)).templateLines.map((line: any) => line.receivableId)).toEqual([f.fee]);
      await finance.transitionReceivable(f.current.identity.id, school, f.fee, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng" });
      expect((await finance.run(f.current.identity.id, school, next)).templateLines.map((line: any) => line.receivableId)).toEqual([f.fee]);
      const third = outcomeId(await finance.openRun(f.current.identity.id, school, uuid(), uuid(), { schoolYearId: f.current.year.id, billingMonth: "2026-11" }));
      expect((await finance.run(f.current.identity.id, school, third)).templateLines).toEqual([]);
    });

    it("edits name, unit and price with audit and replay, refuses price below the refund price and foreign Schools, and keeps Invoice line snapshots", async () => {
      const fixture = await issueFixture("100000");
      const { current, receivableId, invoice } = fixture;
      const foreign = await graph();
      const before = await prisma.invoiceLine.findMany({ where: { schoolId: current.school.id, invoiceId: invoice.id, receivableId }, orderBy: { id: "asc" } });
      expect(before.length).toBeGreaterThan(0);
      const body = { displayName: "Học phí mới", unitLabel: "kỳ", defaultUnitPrice: "120000", reason: "Điều chỉnh học phí" };
      const key = uuid();
      const edited = await finance.updateReceivable(current.identity.id, current.school.id, receivableId, key, uuid(), body);
      expect(edited.outcome).toMatchObject({ id: receivableId, displayName: "Học phí mới", unitLabel: "kỳ", defaultUnitPrice: "120000" });
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })).toMatchObject({ displayName: "Học phí mới", unitLabel: "kỳ", defaultUnitPrice: 120000n });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "RECEIVABLE_EDITED" } })).toMatchObject({ reason: "Điều chỉnh học phí", membershipId: current.membership.id, provenance: { operationId: edited.id, oldValue: { displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100000" }, newValue: { displayName: "Học phí mới", unitLabel: "kỳ", defaultUnitPrice: "120000" } } });
      // Same key and body replays the stored outcome without a second audit; a changed body under the key conflicts.
      expect(await finance.updateReceivable(current.identity.id, current.school.id, receivableId, key, uuid(), body)).toEqual(edited);
      await expect(finance.updateReceivable(current.identity.id, current.school.id, receivableId, key, uuid(), { ...body, defaultUnitPrice: "130000" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "RECEIVABLE_EDITED" } })).toBe(1);
      // Existing Invoice lines are never rewritten.
      expect(await prisma.invoiceLine.findMany({ where: { schoolId: current.school.id, invoiceId: invoice.id, receivableId }, orderBy: { id: "asc" } })).toEqual(before);
      expect(before[0]).toMatchObject({ receivableNameSnapshot: "Học phí", unitLabelSnapshot: "tháng", defaultUnitPriceSnapshot: 100000n });

      // The default price may not drop below the current refund price (amendment A1).
      await finance.updateReceivableRefundPrice(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { refundUnitPrice: "90000" });
      await expect(finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { ...body, defaultUnitPrice: "89999" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { defaultUnitPrice: expect.any(String) } } });
      await finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { ...body, defaultUnitPrice: "90000" });
      for (const invalid of [{ displayName: " " }, { unitLabel: "123" }, { defaultUnitPrice: "0" }, { defaultUnitPrice: "1.5" }, { defaultUnitPrice: "9007199254740992" }, { reason: "" }]) {
        await expect(finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { ...body, defaultUnitPrice: "95000", ...invalid })).rejects.toMatchObject({ status: 400 });
      }
      await expect(finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { ...body, defaultUnitPrice: "90000" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { displayName: expect.any(String) } } });
      // Cross-School: a foreign Finance actor cannot see or edit it, and the database keeps every other column append-only.
      await group(foreign);
      await expect(finance.updateReceivable(foreign.identity.id, foreign.school.id, receivableId, uuid(), uuid(), body)).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_NOT_FOUND" } });
      await expect(prisma.receivable.update({ where: { id: receivableId }, data: { code: "HACK" } })).rejects.toThrow(/append-only/);
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })).toMatchObject({ displayName: "Học phí mới", defaultUnitPrice: 90000n });
    });

    it("makes a DRAFT run preview stale when a referenced Receivable is edited", async () => {
      const current = await roster(await graph());
      await group(current);
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: "Phí", unitLabel: "lần", defaultUnitPrice: "35000" }));
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.updateReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { displayName: "Phí", unitLabel: "lần", defaultUnitPrice: "40000", reason: "Tăng giá" });
      await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe("DRAFT");
      const fresh = await finance.preview(current.identity.id, current.school.id, runId);
      expect(fresh.fingerprint).not.toBe(preview.fingerprint);
      await expect(finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: fresh.fingerprint })).resolves.toMatchObject({ status: "COMPLETED" });
    });

    it("changes the kind of an unused Receivable with audit and refuses once an Invoice line or template line uses it", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await group(current);
      await group(foreign);
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { kind: "FIXED", displayName: "Phí", unitLabel: "lần", defaultUnitPrice: "100" }));
      const foreignReceivableId = outcomeId(await finance.createReceivable(foreign.identity.id, foreign.school.id, uuid(), uuid(), { kind: "FIXED", displayName: "Phí foreign", unitLabel: "lần", defaultUnitPrice: "100" }));
      await expect(finance.updateReceivableKind(current.identity.id, current.school.id, foreignReceivableId, uuid(), uuid(), { kind: "FLEXIBLE" })).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_NOT_FOUND" } });
      await expect(finance.updateReceivableKind(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { kind: "FIXED" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { kind: expect.any(String) } } });
      const changed = await finance.updateReceivableKind(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { kind: "FLEXIBLE" });
      expect(changed.outcome).toMatchObject({ id: receivableId, kind: "FLEXIBLE", kindLocked: false });
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId }, include: { group: true } })).toMatchObject({ group: { schoolId: current.school.id, kind: "FLEXIBLE" } });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "RECEIVABLE_KIND_CHANGED" } })).toMatchObject({ provenance: { operationId: changed.id, oldValue: { kind: "FIXED" }, newValue: { kind: "FLEXIBLE" } } });

      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: 1 });
      await expect(finance.updateReceivableKind(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { kind: "FIXED" })).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
      await expect(prisma.receivable.update({ where: { id: receivableId }, data: { groupId: outcomeId(await group(current, "FIXED")) } })).rejects.toThrow(/kind cannot change/);
      expect((await finance.read(current.identity.id, current.school.id)).receivables).toEqual([expect.objectContaining({ id: receivableId, kind: "FLEXIBLE", kindLocked: true })]);
      expect(await prisma.receivable.findUniqueOrThrow({ where: { id: receivableId } })).toMatchObject({ groupId: expect.any(String) });
    });

    it("replays same-key outcomes, rejects changed fingerprints, and re-authorizes revoked access", async () => {
      const current = await graph();
      const key = uuid();
      const operationId = uuid();
      await group(current);
      const body = { kind: "FIXED", displayName: "Dịch vụ", unitLabel: "lần", defaultUnitPrice: "100" };
      const first = await finance.createReceivable(
        current.identity.id,
        current.school.id,
        key,
        operationId,
        body,
      );
      expect(
        await finance.createReceivable(
          current.identity.id,
          current.school.id,
          key,
          uuid(),
          body,
        ),
      ).toEqual(first);
      expect(
        await prisma.receivable.count({
          where: { schoolId: current.school.id },
        }),
      ).toBe(1);
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          key,
          uuid(),
          { ...body, displayName: "Khác" },
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "IDEMPOTENCY_CONFLICT" },
      });

      const other = await graph();
      await expect(
        finance.operation(other.identity.id, other.school.id, first.id),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "OPERATION_NOT_FOUND" },
      });
      await prisma.positionCapabilityGrant.deleteMany({
        where: {
          schoolId: current.school.id,
          positionId: current.position.id,
          capability: "FINANCE_MANAGE",
        },
      });
      await expect(
        finance.read(current.identity.id, current.school.id),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: "CAPABILITY_DENIED" },
      });
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          key,
          uuid(),
          body,
        ),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: "CAPABILITY_DENIED" },
      });
    });

    it("validates monthly open, returns the existing run, and serializes concurrent opens to one database row", async () => {
      const current = await roster(await graph());
      await expect(
        finance.openRun(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          { schoolYearId: current.year.id, billingMonth: "2026-13" },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { billingMonth: expect.any(String) } },
      });
      await expect(
        finance.openRun(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          { schoolYearId: current.year.id, billingMonth: "2027-01" },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { billingMonth: expect.any(String) } },
      });

      const first = await open(current);
      const existing = await open(current);
      expect(outcomeId(existing)).toBe(outcomeId(first));

      const concurrent = await Promise.all(
        Array.from({ length: 4 }, () =>
          finance.openRun(
            current.identity.id,
            current.school.id,
            uuid(),
            uuid(),
            { schoolYearId: current.year.id, billingMonth: "2026-10" },
          ),
        ),
      );
      expect(new Set(concurrent.map(outcomeId)).size).toBe(1);
      expect(
        await prisma.collectionRun.count({
          where: { schoolId: current.school.id },
        }),
      ).toBe(2);
      await expect(
        prisma.collectionRun.create({
          data: {
            schoolId: current.school.id,
            schoolYearId: current.year.id,
            billingMonth: "not-a-month",
          },
        }),
      ).rejects.toMatchObject({ code: "P2039" });
    });

    it("derives the complete eligible School roster without a persisted selection command", async () => {
      const current = await roster(await graph());
      const firstStudent = await enrolled(current);
      const secondStudent = await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      expect(preview.eligible.map(({ studentId }) => studentId).sort()).toEqual(
        [firstStudent.student.id, secondStudent.student.id].sort(),
      );
      expect(preview.skips).toEqual([]);
    });

    it("uses roster lifecycle, enrollment effective interval, and class status for authoritative eligible and categorized skip rows", async () => {
      const current = await roster(await graph());
      const eligible = await enrolled(current);
      const trial = await enrolled(current, { lifecycle: "TRIAL" });
      const missingAssignment = await enrolled(current, { assignment: false });
      const futureAssignment = await enrolled(current, {
        effectiveFrom: "2026-10-01",
      });
      const archived = await enrolled(current, {
        classId: current.archivedClass.id,
      });
      const ended = await enrolled(current);
      await prisma.studentEnrollment.update({
        where: { id: ended.enrollment.id },
        data: { lifecycle: "WITHDRAWN", endedOn: date("2026-09-01") },
      });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      expect(preview.eligible).toEqual([
        expect.objectContaining({
          studentId: eligible.student.id,
          classId: current.activeClass.id,
        }),
      ]);
      expect(preview.skips).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ studentId: trial.student.id, reason: "NOT_ENROLLED" }),
          expect.objectContaining({
            studentId: missingAssignment.student.id,
            reason: "NO_CLASS_ASSIGNMENT",
          }),
          expect.objectContaining({
            studentId: futureAssignment.student.id,
            reason: "NO_CLASS_ASSIGNMENT",
          }),
          expect.objectContaining({ studentId: archived.student.id, reason: "CLASS_INACTIVE" }),
          expect.objectContaining({ studentId: ended.student.id, reason: "ENROLLMENT_NOT_EFFECTIVE" }),
        ]),
      );
      expect(preview).not.toHaveProperty("total");
    });

    it("rejects stale preview fingerprints after roster and SchoolYear facts change without partial lifecycle writes", async () => {
      const current = await roster(await graph());
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      const rosterPreview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      await prisma.class.update({
        where: { id: current.activeClass.id },
        data: { status: "ARCHIVED" },
      });
      await expect(
        finance.readyRun(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { previewFingerprint: rosterPreview.fingerprint },
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect(
        (await finance.run(current.identity.id, current.school.id, runId))
          .status,
      ).toBe("DRAFT");

      const enrollmentPreview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      await prisma.studentEnrollment.update({
        where: { id: student.enrollment.id },
        data: { lifecycle: "WITHDRAWN", endedOn: date("2026-09-01") },
      });
      await expect(
        finance.readyRun(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { previewFingerprint: enrollmentPreview.fingerprint },
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });

      const yearPreview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      await prisma.schoolYear.update({
        where: { id: current.year.id },
        data: { endsOn: date("2026-12-31") },
      });
      await expect(
        finance.readyRun(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { previewFingerprint: yearPreview.fingerprint },
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect(
        (await finance.run(current.identity.id, current.school.id, runId))
          .status,
      ).toBe("DRAFT");
    });

    it("enforces tenant and capability boundaries, DRAFT lifecycle, and Operation reconciliation for a ready run", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await prisma.schoolCalendarVersion.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      await enrolled(current);
      const runId = outcomeId(await open(current));
      await expect(
        finance.run(foreign.identity.id, foreign.school.id, runId),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "COLLECTION_RUN_NOT_FOUND" },
      });

      const preview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      const key = uuid();
      const operationId = uuid();
      const ready = await finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        key,
        operationId,
        { previewFingerprint: preview.fingerprint },
      );
      expect(ready).toMatchObject({
        id: operationId,
        status: "COMPLETED",
        outcome: { id: runId, status: "READY", version: 2 },
      });
      expect(
        await finance.readyRun(
          current.identity.id,
          current.school.id,
          runId,
          key,
          uuid(),
          { previewFingerprint: preview.fingerprint },
        ),
      ).toEqual(ready);
      await expect(
        finance.preview(current.identity.id, current.school.id, runId),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "COLLECTION_RUN_NOT_DRAFT" },
      });
      await expect(
        finance.operation(foreign.identity.id, foreign.school.id, operationId),
      ).rejects.toMatchObject({
        status: 404,
        response: { code: "OPERATION_NOT_FOUND" },
      });
      expect(
        await finance.operation(
          current.identity.id,
          current.school.id,
          operationId,
        ),
      ).toEqual({
        id: operationId,
        status: "COMPLETED",
        outcome: ready.outcome,
        progress: null,
      });
      expect(
        await prisma.collectionRunLifecycleTransition.findMany({
          where: { schoolId: current.school.id, collectionRunId: runId },
          orderBy: { sequence: "asc" },
        }),
      ).toMatchObject([
        {
          previousStatus: null,
          status: "DRAFT",
          membershipId: current.membership.id,
          sequence: 1,
        },
        {
          previousStatus: "DRAFT",
          status: "READY",
          membershipId: current.membership.id,
          operationId,
          sequence: 2,
        },
      ]);
      await prisma.positionCapabilityGrant.deleteMany({
        where: {
          schoolId: current.school.id,
          positionId: current.position.id,
          capability: "FINANCE_MANAGE",
        },
      });
      await expect(
        finance.run(current.identity.id, current.school.id, runId),
      ).rejects.toMatchObject({
        status: 403,
        response: { code: "CAPABILITY_DENIED" },
      });
    });

    it("generates immutable empty DRAFT invoices from the authoritative roster and replays the original outcome", async () => {
      const current = await roster(await graph());
      const eligible = await enrolled(current);
      const skipped = await enrolled(current, { lifecycle: "TRIAL" });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      await finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: preview.fingerprint },
      );
      const key = uuid();
      const operationId = uuid();
      const generated = await generate(current, runId, key, operationId);
      expect(generated).toMatchObject({
        id: operationId,
        status: "COMPLETED",
        outcome: {
          run: { status: "GENERATED" },
          created: [{ studentId: eligible.student.id }],
          skipped: [{ studentId: skipped.student.id, reason: "NOT_ENROLLED" }],
        },
      });
      const invoice = await prisma.invoice.findFirstOrThrow({
        where: {
          schoolId: current.school.id,
          studentId: eligible.student.id,
          collectionRunId: runId,
        },
      });
      expect(invoice).toMatchObject({
        status: "DRAFT",
        studentCodeSnapshot: eligible.student.studentCode,
        studentNameSnapshot: eligible.student.fullName,
        enrollmentIdSnapshot: eligible.enrollment.id,
        classIdSnapshot: current.activeClass.id,
        billingMonth: "2026-09",
        classAssignmentIdSnapshot: expect.any(String),
        classAssignmentEffectiveFromSnapshot: date("2026-01-01"),
      });
      expect(invoice.selectionProvenance).toMatchObject({
        policy: "COLLECTION_RUN_DEFAULT_ROSTER_V1",
        enrollmentId: eligible.enrollment.id,
        assignmentId: invoice.classAssignmentIdSnapshot,
        assignmentInterval: ["2026-01-01T00:00:00.000Z", null],
      });
      await prisma.student.update({
        where: { id: eligible.student.id },
        data: { fullName: "Tên mới" },
      });
      expect(
        (await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } }))
          .studentNameSnapshot,
      ).toBe("Học sinh Finance");
      expect(
        await generate(current, runId, key, uuid()),
      ).toEqual(generated);
      expect(
        await prisma.invoice.count({
          where: { schoolId: current.school.id, collectionRunId: runId },
        }),
      ).toBe(1);
      await expect(
        generate(current, runId),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "COLLECTION_RUN_STATE_CONFLICT" },
      });
      expect(
        await prisma.collectionRunLifecycleTransition.findMany({
          where: { schoolId: current.school.id, collectionRunId: runId },
          orderBy: { sequence: "asc" },
        }),
      ).toMatchObject([
        { status: "DRAFT" },
        { previousStatus: "DRAFT", status: "READY" },
        { previousStatus: "READY", status: "GENERATED", operationId },
      ]);
      expect(
        await prisma.auditRecord.findFirstOrThrow({
          where: {
            schoolId: current.school.id,
            action: "COLLECTION_RUN_GENERATED",
          },
        }),
      ).toMatchObject({
        membershipId: current.membership.id,
        provenance: {
          operationId,
          newValue: { created: [{ studentId: eligible.student.id }] },
        },
      });
      await expect(
        prisma.collectionRunLifecycleTransition.create({
          data: {
            schoolId: current.school.id, collectionRunId: runId,
            previousStatus: "GENERATED", status: "CLOSED",
            actorIdentityId: current.identity.id, membershipId: current.membership.id,
            operationId, sequence: 4,
          },
        }),
      ).rejects.toThrow(/does not match parent state/);
    });

    it("rejects generation when roster changes after READY without creating a job or Invoice", async () => {
      const current = await roster(await graph());
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await prisma.studentEnrollment.update({ where: { id: student.enrollment.id }, data: { lifecycle: "WITHDRAWN", endedOn: date("2026-09-01") } });
      await expect(generate(current, runId)).rejects.toMatchObject({ status: 409, response: { code: "PREVIEW_STALE" } });
      await expect(prisma.collectionRunGeneration.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).resolves.toBe(0);
      await expect(prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).resolves.toBe(0);
    });

    it("snapshots daily meal template facts, rejects invalid template input, and uses the snapshot for a late Student", async () => {
      const current = await roster(await graph()); const foreign = await roster(await graph());
      const first = await enrolled(current);
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      const groupId = outcomeId(await group(current));
      const mealId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: "MEAL", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000" }));
      const key = uuid(); const operationId = uuid();
      const saved = await finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, operationId, { receivableId: mealId, quantity: "22", expectedVersion: 1 });
      expect(saved.outcome).toMatchObject({ templateLines: [{ receivableId: mealId, unitLabel: "ngày", defaultUnitPrice: "35000", quantity: "22", amount: "770000" }] });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, uuid(), { receivableId: mealId, quantity: "21", expectedVersion: 1 })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "0", expectedVersion: 2 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: foreign.school.id, quantity: "1", expectedVersion: 2 })).rejects.toMatchObject({ status: 400 });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "1", expectedVersion: 1 })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_VERSION_CONFLICT" } });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "1", expectedVersion: 2 })).rejects.toMatchObject({ status: 409 });
      await generate(current, runId);
      const later = await enrolled(current);
      const generatedRun = await prisma.collectionRun.findUniqueOrThrow({
        where: { id: runId },
      });
      expect(generatedRun.templateSnapshot).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ receivableId: mealId, amount: "770000" }),
        ]),
      );
      expect(JSON.stringify(generatedRun.templateSnapshot)).not.toContain("receivableStatus");
      expect(JSON.stringify(generatedRun.templateSnapshot)).not.toContain("receivableGroupStatus");
      const firstInvoice = await prisma.invoice.findFirstOrThrow({
        where: {
          schoolId: current.school.id,
          collectionRunId: runId,
          studentId: first.student.id,
        },
        include: { lines: true },
      });
      expect(firstInvoice.total).toBe(770000n);
      expect(firstInvoice.lines).toEqual([
        expect.objectContaining({
          receivableId: mealId,
          receivableCodeSnapshot: "MEAL",
          receivableNameSnapshot: "Tiền ăn",
          unitLabelSnapshot: "ngày",
          defaultUnitPriceSnapshot: 35000n,
          unitPrice: 35000n,
          quantity: 22,
          amount: 770000n,
        }),
      ]);
      await finance.transitionReceivable(current.identity.id, current.school.id, mealId, uuid(), uuid(), { status: "INACTIVE", reason: "Đổi catalog" });
      const added = await finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id });
      expect(added.outcome).toMatchObject({ created: [{ studentId: later.student.id }] });
      const invoices = await prisma.invoice.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, include: { lines: true } });
      expect(invoices).toHaveLength(2);
      expect(invoices.flatMap((invoice) => invoice.lines)).toEqual(expect.arrayContaining([expect.objectContaining({ receivableId: mealId, unitLabelSnapshot: "ngày", defaultUnitPriceSnapshot: 35000n, quantity: 22, amount: 770000n })]));
    });

    it("invalidates a DRAFT preview when live template catalog price or lifecycle facts change", async () => {
      const current = await roster(await graph());
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        {
          groupId,
          code: "MEAL",
          displayName: "Tiền ăn",
          unitLabel: "ngày",
          defaultUnitPrice: "35000",
        },
      ));
      const runId = outcomeId(await finance.openRun(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        { schoolYearId: current.year.id, billingMonth: "2026-09" },
      ));
      await finance.saveTemplateLine(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { receivableId, quantity: "22", expectedVersion: 1 },
      );

      const pricePreview = await finance.preview(current.identity.id, current.school.id, runId);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.receivable.update({
          where: { id: receivableId },
          data: { defaultUnitPrice: 36000n },
        });
      });
      await expect(finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: pricePreview.fingerprint },
      )).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });

      const lifecyclePreview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.transitionReceivable(
        current.identity.id,
        current.school.id,
        receivableId,
        uuid(),
        uuid(),
        { status: "INACTIVE", reason: "Ngừng áp dụng" },
      );
      await expect(finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: lifecyclePreview.fingerprint },
      )).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe("DRAFT");
    });

    it("rejects generate when READY template catalog facts no longer match the confirmed preview", async () => {
      const current = await roster(await graph());
      await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        {
          groupId,
          code: "READY_MEAL",
          displayName: "Tiền ăn",
          unitLabel: "ngày",
          defaultUnitPrice: "35000",
        },
      ));
      const runId = outcomeId(await open(current));
      await finance.saveTemplateLine(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { receivableId, quantity: "22", expectedVersion: 1 },
      );
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: preview.fingerprint },
      );
      const ready = await prisma.collectionRun.findUniqueOrThrow({ where: { id: runId } });
      expect(ready.readyPreviewFingerprint).toBe(preview.fingerprint);
      await expect(prisma.collectionRun.update({
        where: { id: runId },
        data: { readyPreviewFingerprint: "forged-fingerprint" },
      })).rejects.toThrow(/fingerprint is immutable/);
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.receivable.update({
          where: { id: receivableId },
          data: { defaultUnitPrice: 36000n },
        });
      });
      await expect(generate(current, runId)).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect(await prisma.collectionRunGeneration.count({
        where: { schoolId: current.school.id, collectionRunId: runId },
      })).toBe(0);
      expect(await prisma.invoice.count({
        where: { schoolId: current.school.id, collectionRunId: runId },
      })).toBe(0);
      expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe("READY");
    });

    it("rejects generate when a template receivable becomes inactive after READY", async () => {
      const current = await roster(await graph());
      await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        { groupId, code: "READY_LIFECYCLE", displayName: "Khoản thu", unitLabel: "lần", defaultUnitPrice: "35000" },
      ));
      const runId = outcomeId(await open(current));
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), {
        receivableId,
        quantity: "1",
        expectedVersion: 1,
      });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), {
        previewFingerprint: preview.fingerprint,
      });
      await finance.transitionReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), {
        status: "INACTIVE",
        reason: "Ngừng sau xác nhận",
      });
      await expect(generate(current, runId)).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect(await prisma.collectionRunGeneration.count({
        where: { schoolId: current.school.id, collectionRunId: runId },
      })).toBe(0);
      expect(await prisma.invoice.count({
        where: { schoolId: current.school.id, collectionRunId: runId },
      })).toBe(0);
    });

    it("returns template lines by descending server-calculated amount with an ID tie-breaker", async () => {
      const current = await roster(await graph());
      const groupId = outcomeId(await group(current));
      const create = (code: string, price: string) => finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        { groupId, code, displayName: code, unitLabel: "lần", defaultUnitPrice: price },
      );
      const lowId = outcomeId(await create("LOW", "10000"));
      const tiedFirstId = outcomeId(await create("TIED_A", "20000"));
      const tiedSecondId = outcomeId(await create("TIED_B", "10000"));
      const highId = outcomeId(await create("HIGH", "35000"));
      const runId = outcomeId(await finance.openRun(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        { schoolYearId: current.year.id, billingMonth: "2026-09" },
      ));
      let version = 1;
      for (const [receivableId, quantity] of [[lowId, "1"], [tiedFirstId, "2"], [tiedSecondId, "4"], [highId, "3"]] as const) {
        await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), {
          receivableId,
          quantity,
          expectedVersion: version++,
        });
      }

      const persistedLines = await prisma.collectionRunTemplateLine.findMany({
        where: { schoolId: current.school.id, collectionRunId: runId },
        select: { id: true, receivableId: true },
        orderBy: { id: "asc" },
      });
      const expectedTiedReceivableIds = persistedLines
        .filter(({ receivableId }) => [tiedFirstId, tiedSecondId].includes(receivableId))
        .map(({ receivableId }) => receivableId);
      const run = await finance.run(current.identity.id, current.school.id, runId);
      const templateLines = run.templateLines as Array<{ id: string; receivableId: string; amount: string }>;
      expect(templateLines.map(({ receivableId, amount }: { receivableId: string; amount: string }) => ({ receivableId, amount }))).toEqual([
        { receivableId: highId, amount: "105000" },
        ...expectedTiedReceivableIds.map((receivableId) => ({ receivableId, amount: "40000" })),
        { receivableId: lowId, amount: "10000" },
      ]);
      expect(templateLines.every((line: { id: string; receivableId: string; amount: string }) => !("position" in line))).toBe(true);
    });

    it("enforces template tenant graph, unique quantity, DRAFT lifecycle, replay, and competing versions at the PostgreSQL boundary", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản gate", unitLabel: "lần", defaultUnitPrice: "100" }));
      const foreignGroupId = outcomeId(await group(foreign));
      const foreignReceivableId = outcomeId(await finance.createReceivable(foreign.identity.id, foreign.school.id, uuid(), uuid(), { groupId: foreignGroupId, displayName: "Khoản foreign", unitLabel: "lần", defaultUnitPrice: "100" }));
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      await expect(prisma.collectionRunTemplateLine.create({ data: { schoolId: current.school.id, collectionRunId: runId, receivableId: foreignReceivableId, quantity: 1 } })).rejects.toMatchObject({ code: "P2003" });
      await expect(prisma.collectionRunTemplateLine.create({ data: { schoolId: current.school.id, collectionRunId: runId, receivableId, quantity: 0 } })).rejects.toThrow();
      const key = uuid();
      const saved = await finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, uuid(), { receivableId, quantity: "1", expectedVersion: 1 });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, uuid(), { receivableId, quantity: "1", expectedVersion: 1 })).resolves.toEqual(saved);
      expect(await prisma.collectionRunTemplateLine.count({ where: { schoolId: current.school.id, collectionRunId: runId, receivableId } })).toBe(1);
      const races = await Promise.allSettled([
        finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "2", expectedVersion: 2 }),
        finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "3", expectedVersion: 2 }),
      ]);
      expect(races.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(races.filter((result) => result.status === "rejected")[0]).toMatchObject({ reason: { status: 409, response: { code: "COLLECTION_RUN_VERSION_CONFLICT" } } });
      await enrolled(current);
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(prisma.collectionRunTemplateLine.updateMany({ where: { schoolId: current.school.id, collectionRunId: runId }, data: { quantity: 4 } })).rejects.toThrow(/immutable outside DRAFT/);
      await expect(prisma.collectionRunTemplateLine.deleteMany({ where: { schoolId: current.school.id, collectionRunId: runId } })).rejects.toThrow(/immutable outside DRAFT/);
    });

    it("prepares one revision from immutable source facts, then atomically issues it and cancels the source", async () => {
      const fixture = await issueFixture();
      const issued = await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      expect(issued.outcome).toMatchObject({ status: "ISSUED" });
      const key = uuid(); const operationId = uuid();
      const prepared = await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, key, operationId, { reason: "Sai khoản thu" });
      const replacementId = outcomeId(prepared);
      expect(await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, key, uuid(), { reason: "Sai khoản thu" })).toEqual(prepared);
      const replacement = await prisma.invoice.findUniqueOrThrow({ where: { id: replacementId } });
      const source = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      expect(replacement).toMatchObject({ status: "DRAFT", revisesInvoiceId: source.id, revisionReason: "Sai khoản thu", studentId: source.studentId, collectionRunId: source.collectionRunId, studentNameSnapshot: source.studentNameSnapshot });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Lý do khác" })).rejects.toMatchObject({ status: 409, response: { code: "INVOICE_REVISION_EXISTS" } });
      await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { receivableId: fixture.receivableId, quantity: "1" });
      const issuedRevision = await finance.issueRevision(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      expect(issuedRevision.outcome).toMatchObject({ id: replacementId, status: "ISSUED", revisesInvoiceId: source.id });
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: source.id } })).toMatchObject({ status: "CANCELLED", obligationTotalSnapshot: source.obligationTotalSnapshot });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, action: "INVOICE_CANCELLED_FOR_REVISION" } })).toMatchObject({ provenance: { operationId: issuedRevision.id, newValue: { status: "CANCELLED", replacementInvoiceId: replacementId } } });
      await expect(prisma.invoice.create({ data: { schoolId: fixture.current.school.id, studentId: source.studentId, collectionRunId: source.collectionRunId, schoolYearId: source.schoolYearId, billingMonth: source.billingMonth, rosterAsOf: source.rosterAsOf, studentCodeSnapshot: source.studentCodeSnapshot, studentNameSnapshot: source.studentNameSnapshot, enrollmentIdSnapshot: source.enrollmentIdSnapshot, enrollmentLifecycleSnapshot: source.enrollmentLifecycleSnapshot, enrollmentEffectiveFromSnapshot: source.enrollmentEffectiveFromSnapshot, enrollmentEndedOnSnapshot: source.enrollmentEndedOnSnapshot, classAssignmentIdSnapshot: source.classAssignmentIdSnapshot, classAssignmentEffectiveFromSnapshot: source.classAssignmentEffectiveFromSnapshot, classAssignmentEffectiveToSnapshot: source.classAssignmentEffectiveToSnapshot, classIdSnapshot: source.classIdSnapshot, classNameSnapshot: source.classNameSnapshot, selectionProvenance: source.selectionProvenance as Prisma.InputJsonValue, revisesInvoiceId: source.id, revisionReason: "Duplicate" } })).rejects.toThrow();
      await expect(prisma.invoice.update({ where: { id: source.id }, data: { studentNameSnapshot: "Mutated" } })).rejects.toThrow(/immutable/);
      await expect(prisma.invoice.update({ where: { id: source.id }, data: { status: "CANCELLED", total: 1n } })).rejects.toThrow(/immutable|Cancellation/);
    });

    it("rejects revision access, closed run/year, and direct lifecycle or lineage writes", async () => {
      const fixture = await issueFixture(); const foreign = await graph();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await expect(finance.prepareRevision(foreign.identity.id, foreign.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Foreign" })).rejects.toMatchObject({ status: 404 });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Revoked" })).rejects.toMatchObject({ status: 403 });
      await prisma.positionCapabilityGrant.create({ data: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await prisma.schoolYear.update({ where: { id: fixture.current.year.id }, data: { closedAt: new Date() } });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Closed year" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_CLOSED" } });
      await expect(prisma.invoice.update({ where: { id: fixture.invoice.id }, data: { status: "CANCELLED" } })).rejects.toThrow(/replacement/);
      await expect(prisma.invoice.create({ data: { schoolId: fixture.current.school.id, studentId: fixture.student.student.id, collectionRunId: fixture.invoice.collectionRunId, schoolYearId: fixture.invoice.schoolYearId, billingMonth: fixture.invoice.billingMonth, rosterAsOf: fixture.invoice.rosterAsOf, studentCodeSnapshot: fixture.invoice.studentCodeSnapshot, studentNameSnapshot: fixture.invoice.studentNameSnapshot, enrollmentIdSnapshot: fixture.invoice.enrollmentIdSnapshot, enrollmentLifecycleSnapshot: fixture.invoice.enrollmentLifecycleSnapshot, enrollmentEffectiveFromSnapshot: fixture.invoice.enrollmentEffectiveFromSnapshot, enrollmentEndedOnSnapshot: fixture.invoice.enrollmentEndedOnSnapshot, classAssignmentIdSnapshot: fixture.invoice.classAssignmentIdSnapshot, classAssignmentEffectiveFromSnapshot: fixture.invoice.classAssignmentEffectiveFromSnapshot, classAssignmentEffectiveToSnapshot: fixture.invoice.classAssignmentEffectiveToSnapshot, classIdSnapshot: fixture.invoice.classIdSnapshot, classNameSnapshot: fixture.invoice.classNameSnapshot, selectionProvenance: fixture.invoice.selectionProvenance as Prisma.InputJsonValue, status: "ISSUED" } })).rejects.toThrow(/DRAFT/);
    });

    it("rejects generate when the roster changes after READY and persists no stale snapshot", async () => {
      const current = await roster(await graph());
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await prisma.studentEnrollment.update({
        where: { id: student.enrollment.id },
        data: { lifecycle: "WITHDRAWN", endedOn: date("2026-09-01") },
      });

      await expect(generate(current, runId)).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(0);
    });

    it("reports only inserted initial invoices and classifies existing eligible rows", async () => {
      const current = await roster(await graph());
      const existing = await enrolled(current);
      const remaining = await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      const assignment = await prisma.enrollmentClassAssignment.findFirstOrThrow({ where: { schoolId: current.school.id, enrollmentId: existing.enrollment.id } });
      await prisma.invoice.create({ data: {
        schoolId: current.school.id, studentId: existing.student.id, collectionRunId: runId,
        schoolYearId: current.year.id, billingMonth: "2026-09", rosterAsOf: date("2026-09-01"),
        studentCodeSnapshot: existing.student.studentCode, studentNameSnapshot: existing.student.fullName,
        enrollmentIdSnapshot: existing.enrollment.id, enrollmentLifecycleSnapshot: "ENROLLED",
        enrollmentEffectiveFromSnapshot: date("2026-01-01"), classAssignmentIdSnapshot: assignment.id,
        classAssignmentEffectiveFromSnapshot: assignment.effectiveFrom, classIdSnapshot: current.activeClass.id,
        classNameSnapshot: current.activeClass.name, selectionProvenance: { legacy: true },
      } });
      const generated = await generate(current, runId);
      expect(generated.outcome).toMatchObject({ created: [{ studentId: remaining.student.id }], skipped: [{ studentId: existing.student.id, reason: "INVOICE_EXISTS" }] });
      const outcome = generated.outcome as { created: unknown[]; skipped: unknown[] };
      expect(outcome.created).toHaveLength(1);
      expect(outcome.skipped).toHaveLength(1);
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(2);
    });

    it("serializes concurrent generate keys and preserves the final generated invariant", async () => {
      const current = await roster(await graph());
      await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      const results = await Promise.allSettled([
        generate(current, runId),
        generate(current, runId),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((result) => result.status === "rejected")[0]).toMatchObject({
        reason: { status: 409, response: { code: "COLLECTION_RUN_STATE_CONFLICT" } },
      });
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(1);
      expect(await prisma.collectionRunLifecycleTransition.count({ where: { schoolId: current.school.id, collectionRunId: runId, status: "GENERATED" } })).toBe(1);
    });

    it("does not generate for a foreign run, revoked capability, or closed year", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(finance.generateRun(foreign.identity.id, foreign.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 404, response: { code: "COLLECTION_RUN_NOT_FOUND" } });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.generateRun(current.identity.id, current.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
      await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
      await prisma.schoolYear.update({ where: { id: current.year.id }, data: { closedAt: new Date() } });
      await expect(finance.generateRun(current.identity.id, current.school.id, runId, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "SCHOOL_YEAR_CLOSED" } });
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(0);
    });

    it("adds exactly one eligible same-School Student after generation without changing prior snapshots", async () => {
      const current = await roster(await graph());
      const generatedStudent = await enrolled(current);
      const invalidStudent = await enrolled(current, { lifecycle: "TRIAL" });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const original = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, studentId: generatedStudent.student.id, collectionRunId: runId } });
      const addedStudent = await enrolled(current);
      const key = uuid();
      const operationId = uuid();
      const added = await finance.addGeneratedStudent(current.identity.id, current.school.id, runId, key, operationId, { studentId: addedStudent.student.id });
      expect(added).toMatchObject({ id: operationId, outcome: { created: [{ studentId: addedStudent.student.id }], skipped: [] } });
      await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, key, uuid(), { studentId: addedStudent.student.id })).resolves.toEqual(added);
       await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: generatedStudent.student.id })).resolves.toMatchObject({ outcome: { created: [], skipped: [{ reason: "INVOICE_EXISTS" }] } });
      await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: invalidStudent.student.id })).resolves.toMatchObject({ outcome: { created: [], skipped: [{ reason: "NOT_ENROLLED" }] } });
      expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId } })).toBe(2);
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: original.id } })).toMatchObject({ studentNameSnapshot: generatedStudent.student.fullName });
      await expect(prisma.invoice.update({ where: { id: original.id }, data: { studentNameSnapshot: "Mutated" } })).rejects.toThrow(/immutable/);
      await expect(prisma.$executeRaw`UPDATE "Invoice" SET "status" = "status" WHERE "id" = ${original.id}::uuid`).resolves.toBe(1);
      await expect(prisma.invoice.delete({ where: { id: original.id } })).rejects.toThrow(/forbidden/);
    });

    it("serializes concurrent generated-student commands to one Invoice and one created outcome", async () => {
      const current = await roster(await graph());
      await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const later = await enrolled(current);
       const results = await Promise.all([
         finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id }),
         finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id }),
       ]);
       expect(results.filter((result) => (result.outcome as { created: unknown[] }).created.length)).toHaveLength(1);
       expect(results.filter((result) => (result.outcome as { skipped: { reason: string }[] }).skipped.some(({ reason }) => reason === "INVOICE_EXISTS"))).toHaveLength(1);
       expect(await prisma.invoice.count({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: later.student.id } })).toBe(1);
    });

    it("does not add a generated Student for foreign access, revoked capability, or a closed year", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await enrolled(current);
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const later = await enrolled(current);
      await expect(finance.addGeneratedStudent(foreign.identity.id, foreign.school.id, runId, uuid(), uuid(), { studentId: later.student.id })).rejects.toMatchObject({ status: 404, response: { code: "COLLECTION_RUN_NOT_FOUND" } });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id })).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
      await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
      await prisma.schoolYear.update({ where: { id: current.year.id }, data: { closedAt: new Date() } });
      await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: later.student.id })).rejects.toMatchObject({ status: 409, response: { code: "SCHOOL_YEAR_CLOSED" } });
    });

    it("returns a 1,000-student authoritative preview within three seconds", async () => {
      const current = await roster(await graph());
      const students = Array.from({ length: 1000 }, () => ({
        id: uuid(),
        schoolId: current.school.id,
        studentCode: `HS-${uuid()}`,
        fullName: "Học sinh tải",
        dateOfBirth: date("2022-01-01"),
      }));
      const enrollments = students.map((student) => ({
        id: uuid(),
        schoolId: current.school.id,
        studentId: student.id,
        schoolYearId: current.year.id,
        classId: current.activeClass.id,
        lifecycle: "ENROLLED" as const,
        effectiveFrom: date("2026-01-01"),
        schoolYearName: current.year.name,
        schoolYearStartsOn: current.year.startsOn,
        schoolYearEndsOn: current.year.endsOn,
        className: current.activeClass.name,
      }));
      await prisma.student.createMany({ data: students });
      await prisma.studentEnrollment.createMany({ data: enrollments });
      await prisma.enrollmentClassAssignment.createMany({
        data: enrollments.map((enrollment) => ({
          schoolId: current.school.id,
          enrollmentId: enrollment.id,
          schoolYearId: current.year.id,
          classId: current.activeClass.id,
          effectiveFrom: date("2026-01-01"),
          reason: "Performance test",
        })),
      });
      const runId = outcomeId(await open(current));
      const started = performance.now();
      const preview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      expect(performance.now() - started).toBeLessThanOrEqual(3000);
      expect(preview.eligible).toHaveLength(1000);
      expect(preview.skips).toHaveLength(0);
    }, 15000);

    it("generates 200 empty DRAFT invoices within thirty seconds without duplicates", async () => {
      const current = await roster(await graph());
      const students = Array.from({ length: 200 }, () => ({
        id: uuid(),
        schoolId: current.school.id,
        studentCode: `HS-${uuid()}`,
        fullName: "Học sinh tạo hóa đơn",
        dateOfBirth: date("2022-01-01"),
      }));
      const enrollments = students.map((student) => ({
        id: uuid(),
        schoolId: current.school.id,
        studentId: student.id,
        schoolYearId: current.year.id,
        classId: current.activeClass.id,
        lifecycle: "ENROLLED" as const,
        effectiveFrom: date("2026-01-01"),
        schoolYearName: current.year.name,
        schoolYearStartsOn: current.year.startsOn,
        schoolYearEndsOn: current.year.endsOn,
        className: current.activeClass.name,
      }));
      await prisma.student.createMany({ data: students });
      await prisma.studentEnrollment.createMany({ data: enrollments });
      await prisma.enrollmentClassAssignment.createMany({
        data: enrollments.map((enrollment) => ({
          schoolId: current.school.id,
          enrollmentId: enrollment.id,
          schoolYearId: current.year.id,
          classId: current.activeClass.id,
          effectiveFrom: date("2026-01-01"),
          reason: "Generate performance test",
        })),
      });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(
        current.identity.id,
        current.school.id,
        runId,
      );
      await finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: preview.fingerprint },
      );
      const started = performance.now();
      const queued = await finance.generateRun(current.identity.id, current.school.id, runId, uuid(), uuid());
      expect(queued).toMatchObject({ status: "PENDING", outcome: null, progress: { total: 200, processed: 0, eligible: 0, skipped: 0 } });
      await finance.processNextGeneration();
      const progress = await finance.operation(current.identity.id, current.school.id, queued.id);
      expect(progress).toMatchObject({ status: "PENDING", progress: { status: "RUNNING", processed: 50, eligible: 50, skipped: 0 } });
        let generated = await finance.operation(current.identity.id, current.school.id, queued.id);
        while (generated.status !== "COMPLETED" || !generated.outcome) {
          if (generated.status === "FAILED") throw new Error(`Generation failed: ${JSON.stringify(generated.outcome)}`);
          // A concurrently enabled worker may own the generation lease; yield until it publishes the terminal Operation.
          if (!await finance.processNextGeneration()) await new Promise((resolve) => setTimeout(resolve, 25));
          generated = await finance.operation(current.identity.id, current.school.id, queued.id);
       }
      expect(performance.now() - started).toBeLessThanOrEqual(30000);
      expect(
        (generated.outcome as { created: unknown[] }).created,
      ).toHaveLength(200);
      expect(
        await prisma.invoice.count({
          where: { schoolId: current.school.id, collectionRunId: runId },
        }),
      ).toBe(200);
    }, 40000);

    it("persists, audits, replays, edits and removes authoritative DRAFT lines without leaking tenants", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await prisma.schoolCalendarVersion.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivable = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: "TUITION", displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100000" });
      const receivableId = outcomeId(receivable);
      const promotionVersionId = await promotion(current, student.student.id, receivableId, { name: "Ưu đãi manual line", discountType: "FIXED_VND", discountValue: "25", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
      const key = uuid(); const operationId = uuid();
      const body = { receivableId, quantity: "2", unitPrice: "120000", overrideReason: "Điều chỉnh học phí", source: { serviceDate: "2026-09-01", attendanceState: "PRESENT", pickedUpAt: "17:30", lateCareMinutes: 30 }, sourceReason: "Nhập tay từ bảng theo dõi" };
      const added = await finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, operationId, body);
      expect(added).toMatchObject({ id: operationId, outcome: { total: "239976", lines: expect.arrayContaining([expect.objectContaining({ quantity: "2", unitPrice: "120000", amount: "239975", grossAmount: "240000", discountAmount: "25", netAmount: "239975", sourceReason: body.sourceReason })]) } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, uuid(), body)).resolves.toEqual(added);
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, uuid(), { ...body, quantity: "3" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "2147483647", unitPrice: "9007199254740991", overrideReason: "Vượt giới hạn" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1", source: { attendanceState: "ABSENT", pickedUpAt: "17:30" }, sourceReason: "Mâu thuẫn" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { source: expect.any(String) } } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1", source: { attendanceState: "PRESENT", pickedUpAt: "25:99" }, sourceReason: "Giờ sai" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { "source.pickedUpAt": expect.any(String) } } });
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { total: 1n } })).rejects.toThrow(/derived/);
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, invoiceId: invoice.id, receivableId } });
      expect(line).toMatchObject({ amount: 239975n, grossAmount: 240000n, discountAmount: 25n, netAmount: 239975n, promotionEvaluationProvenance: expect.objectContaining({ applications: [expect.objectContaining({ versionId: promotionVersionId, discountType: "FIXED_VND", discountValue: "25", appliedDiscount: "25", assignmentReason: "Ưu đãi integration" })] }), sourceActorIdentityId: current.identity.id, sourceMembershipId: current.membership.id, sourceProvenance: { enrollmentId: student.enrollment.id } });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "INVOICE_LINE_ADDED" } })).toMatchObject({ provenance: { operationId } });
      const editKey = uuid(); const editOperation = uuid();
      const edited = await finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, editKey, editOperation, { quantity: "3", unitPrice: "100000", overrideReason: "Dùng giá catalog" });
       expect(edited.outcome).toMatchObject({ total: "299976", lines: expect.arrayContaining([expect.objectContaining({ amount: "299975", grossAmount: "300000", discountAmount: "25", netAmount: "299975" })]) });
      expect(await prisma.invoiceLine.findUniqueOrThrow({ where: { id: line.id } })).toMatchObject({ amount: 299975n, grossAmount: 300000n, discountAmount: 25n, netAmount: 299975n, promotionEvaluationProvenance: expect.objectContaining({ applications: [expect.objectContaining({ versionId: promotionVersionId, discountValue: "25", appliedDiscount: "25" })] }) });
      await expect(finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, editKey, uuid(), { quantity: "3", unitPrice: "100000", overrideReason: "Dùng giá catalog" })).resolves.toEqual(edited);
      await expect(finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, editKey, uuid(), { quantity: "4", unitPrice: "100000", overrideReason: "Dùng giá catalog" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      const preserved = await finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, uuid(), uuid(), { quantity: "2" });
       expect(preserved.outcome).toMatchObject({ lines: expect.arrayContaining([expect.objectContaining({ unitPrice: "100000", overrideReason: "Dùng giá catalog" })]) });
      const cleared = await finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, uuid(), uuid(), { quantity: "2", source: null });
       expect(cleared.outcome).toMatchObject({ lines: expect.arrayContaining([expect.objectContaining({ source: null, sourceReason: null, sourceAudit: null })]) });
      const removeKey = uuid(); const removeOperation = uuid();
      const removed = await finance.removeInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, removeKey, removeOperation);
       expect(removed).toMatchObject({ outcome: { total: "1", lines: expect.arrayContaining([expect.objectContaining({ amount: "1" })]) } });
      await expect(finance.removeInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, removeKey, uuid())).resolves.toEqual(removed);
      expect(await prisma.auditRecord.findMany({ where: { schoolId: current.school.id, action: { in: ["INVOICE_LINE_EDITED", "INVOICE_LINE_REMOVED"] } } })).toEqual(expect.arrayContaining([expect.objectContaining({ action: "INVOICE_LINE_EDITED", provenance: expect.objectContaining({ operationId: editOperation, oldValue: expect.any(Object) }) }), expect.objectContaining({ action: "INVOICE_LINE_REMOVED", provenance: expect.objectContaining({ operationId: removeOperation, oldValue: expect.any(Object) }) })]));
      await expect(finance.invoice(foreign.identity.id, foreign.school.id, invoice.id)).rejects.toMatchObject({ status: 404, response: { code: "INVOICE_NOT_FOUND" } });
       await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "0" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
       await expect(prisma.invoiceLine.create({ data: { schoolId: current.school.id, invoiceId: invoice.id, receivableId, receivableNameSnapshot: "Sai", unitLabelSnapshot: "lần", defaultUnitPriceSnapshot: 1n, unitPrice: 1n, quantity: 1, amount: 2n } })).rejects.toThrow();
       await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
       await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1" })).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
        expect(await prisma.invoiceLine.count({ where: { schoolId: current.school.id, invoiceId: invoice.id } })).toBe(1);
       await prisma.positionCapabilityGrant.create({ data: { schoolId: current.school.id, positionId: current.position.id, capability: "FINANCE_MANAGE" } });
       await finance.transitionReceivable(current.identity.id, current.school.id, receivableId, uuid(), uuid(), { status: "INACTIVE", reason: "Race catalog" });
       await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
        expect(await prisma.invoiceLine.count({ where: { schoolId: current.school.id, invoiceId: invoice.id } })).toBe(1);
       const [lineGuard] = await prisma.$queryRaw<Array<{ definition: string; labels: string[] }>>`SELECT pg_get_functiondef(p.oid)::text AS definition, ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = '"InvoiceStatus"'::regtype ORDER BY enumsortorder)::text[] AS labels FROM pg_proc p WHERE p.proname = 'reject_invoice_line_after_issue'`;
       expect(lineGuard).toBeDefined();
          expect(lineGuard).toMatchObject({ labels: ["DRAFT", "ISSUED", "CANCELLED", "CLOSED"] });
       expect(lineGuard!.definition).toContain("IS DISTINCT FROM 'DRAFT'");
     });

    it("serializes concurrent DRAFT line commands to durable totals and distinct audit outcomes", async () => {
      const current = await roster(await graph()); await enrolled(current);
      const groupId = outcomeId(await group(current));
      const catalog = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Tiền ăn", unitLabel: "tháng", defaultUnitPrice: "100" });
      const runId = outcomeId(await open(current));
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
      const results = await Promise.all([finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId: outcomeId(catalog), quantity: "1" }), finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId: outcomeId(catalog), quantity: "2" })]);
      expect(results).toHaveLength(2);
       expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ total: 301n });
      expect(await prisma.invoiceLine.count({ where: { schoolId: current.school.id, invoiceId: invoice.id } })).toBe(3);
      expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_LINE_ADDED" } })).toBe(2);
    });

    it("issues a positive DRAFT atomically with immutable account, policy, due-date, obligation and operation snapshots", async () => {
      const { current, student, invoice, bank, operationId: fixtureOperationId } = await issueFixture();
      const key = uuid(); const operationId = uuid();
      const issued = await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, operationId, { bankAccountId: bank.id, grossAmount: "1", discount: "9007199254740991", netAmount: "1", total: "1", formula: "browser-owned" });
      expect(issued).toMatchObject({ id: operationId, status: "COMPLETED", outcome: { id: invoice.id, status: "ISSUED", total: "9007199254740991", student: { name: student.student.fullName, className: "Mầm Active" }, issue: { obligationTotal: "9007199254740991", bankAccount: { id: bank.id, receivingBank: "Ngân hàng Ánh Hoa", accountNumber: "123456789" }, transferContent: "Hoc sinh Finance Mam Active", policy: { dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE" } } } });
      expect((issued.outcome as any).issue.dueOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      await expect(finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, uuid(), { bankAccountId: bank.id })).resolves.toEqual(issued);
      const otherBank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng B", bankBin: "970436", accountNumber: "987", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: otherBank.id, status: "ACTIVE", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId: fixtureOperationId, sequence: 1 } });
      await expect(finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, uuid(), { bankAccountId: otherBank.id })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      expect(await finance.operation(current.identity.id, current.school.id, operationId)).toEqual({ id: operationId, status: "COMPLETED", outcome: issued.outcome, progress: null });
      expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_ISSUED" } })).toBe(1);
      const stored = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(stored).toMatchObject({ status: "ISSUED", obligationTotalSnapshot: 9007199254740991n, bankAccountIdSnapshot: bank.id, transferContentSnapshot: "Hoc sinh Finance Mam Active", dueDaysAfterIssueSnapshot: 7 });
      await prisma.student.update({ where: { id: student.student.id }, data: { fullName: "Tên live mới" } });
      await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: bank.id, previousStatus: "ACTIVE", status: "INACTIVE", reason: "Đổi tài khoản", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId: issued.id, sequence: 2 } });
      await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-09-22"), dueDaysAfterIssue: 30, taxTreatment: "TAX_INCLUDED", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "SCHOOL_ADMIN_APPROVAL", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      expect(await finance.invoice(current.identity.id, current.school.id, invoice.id)).toMatchObject({ issue: { transferContent: "Hoc sinh Finance Mam Active", bankAccount: { accountNumber: "123456789" }, policy: { dueDaysAfterIssue: 7 } } });
    });

    it("projects a minimal School-scoped issued receipt queue and removes a concurrently closed Invoice", async () => {
      const { current, invoice, bank } = await issueFixture();
      await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
      const queue = await finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: invoice.billingMonth, limit: "1" });
      expect(queue.invoices).toEqual([expect.objectContaining({ id: invoice.id, status: "ISSUED", outstanding: "9007199254740991", student: expect.objectContaining({ code: expect.any(String), name: expect.any(String) }) })]);
      expect(queue.invoices[0]).not.toHaveProperty("lines");
      expect(queue.invoices[0]).not.toHaveProperty("issue");
      const classes = await finance.receiptQueueClasses(current.identity.id, current.school.id, { billingMonth: invoice.billingMonth });
      expect(classes.classes).toContainEqual(expect.objectContaining({ id: invoice.classIdSnapshot }));
      await expect(finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: invoice.billingMonth, classIdSnapshot: crypto.randomUUID() })).resolves.toMatchObject({ invoices: [] });
      await finance.closeInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { actualAmount: "9007199254740991" });
      await expect(finance.receiptQueueDetail(current.identity.id, current.school.id, invoice.id)).rejects.toMatchObject({ status: 404, response: { code: "RECEIPT_QUEUE_INVOICE_UNAVAILABLE" } });
      await expect(finance.receiptQueue(current.identity.id, current.school.id, { billingMonth: invoice.billingMonth })).resolves.toMatchObject({ invoices: [] });
    });

    it("pages only authorized minimal issued queue rows and rejects foreign, filtered, or revoked reads", async () => {
      const fixture = await issueFixture("100");
      const later = await enrolled(fixture.current);
      await finance.addGeneratedStudent(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.collectionRunId, uuid(), uuid(), { studentId: later.student.id });
      const laterInvoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: fixture.invoice.collectionRunId, studentId: later.student.id } });
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, laterInvoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });

      const first = await finance.receiptQueue(fixture.current.identity.id, fixture.current.school.id, { billingMonth: fixture.invoice.billingMonth, limit: "1" });
      expect(first.invoices).toHaveLength(1);
      expect(first.meta.nextCursor).toEqual(expect.any(String));
      expect(Object.keys(first.invoices[0]!).sort()).toEqual(["billingMonth", "channel", "class", "collectionRunId", "direction", "id", "issuedAt", "outstanding", "schoolYearId", "status", "student"]);
      expect(first.invoices[0]).toMatchObject({ status: "ISSUED", outstanding: "100", student: { code: expect.any(String), name: expect.any(String) } });
      expect(first.invoices[0]).not.toHaveProperty("lines");
      expect(first.invoices[0]).not.toHaveProperty("issue");

      const second = await finance.receiptQueue(fixture.current.identity.id, fixture.current.school.id, { billingMonth: fixture.invoice.billingMonth, limit: "1", cursor: first.meta.nextCursor });
      expect(second.invoices).toHaveLength(1);
      expect(second.invoices[0]!.id).not.toBe(first.invoices[0]!.id);

      const app = await createApi();
      await app.listen(0, "127.0.0.1");
      try {
        const baseUrl = `http://127.0.0.1:${(app.getHttpServer().address() as { port: number }).port}`;
        const response = await fetch(`${baseUrl}/api/app/schools/${fixture.current.school.id}/finance/receipt-queue?billingMonth=${fixture.invoice.billingMonth}&limit=1`, { headers: { cookie: await appSession(baseUrl, fixture.current.identity.emailNormalized) } });
        expect(response.status).toBe(200);
        const body = await response.json() as { data: typeof first };
        expect(Object.keys(body)).toEqual(["data"]);
        expect(Object.keys(body.data.invoices[0]!).sort()).toEqual(["billingMonth", "channel", "class", "collectionRunId", "direction", "id", "issuedAt", "outstanding", "schoolYearId", "status", "student"]);
      } finally {
        await app.close();
      }

      const foreign = await issueFixture("100");
      await finance.issueInvoice(foreign.current.identity.id, foreign.current.school.id, foreign.invoice.id, uuid(), uuid(), { bankAccountId: foreign.bank.id });
      const foreignIssued = await prisma.invoice.findUniqueOrThrow({ where: { id: foreign.invoice.id } });
      const foreignCursor = Buffer.from(JSON.stringify({ id: foreign.invoice.id, issuedAt: foreignIssued.issuedAt!.toISOString(), filters: first.filters })).toString("base64url");
      const mismatched = Buffer.from(JSON.stringify({ id: first.invoices[0]!.id, issuedAt: first.invoices[0]!.issuedAt, filters: { ...first.filters, student: "Không khớp" } })).toString("base64url");
      await expect(finance.receiptQueue(fixture.current.identity.id, fixture.current.school.id, { billingMonth: fixture.invoice.billingMonth, limit: "1", cursor: foreignCursor })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
      await expect(finance.receiptQueue(fixture.current.identity.id, fixture.current.school.id, { billingMonth: fixture.invoice.billingMonth, limit: "1", cursor: mismatched })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { cursor: expect.any(String) } } });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.receiptQueue(fixture.current.identity.id, fixture.current.school.id, { billingMonth: fixture.invoice.billingMonth })).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
    });

    it("rechecks calculated promotion facts before Issue and persists only immutable issued applications", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Issue snapshot", discountType: "FIXED_VND", discountValue: "25", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
      const operationId = uuid(); await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
      const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "A", bankBin: "970436", accountNumber: "1", accountHolderName: "A", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
       await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: bank.id, status: "ACTIVE", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId, sequence: 1 } });
       await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
       const draftLine = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, invoiceId: invoice.id } });
       const provenance = (draftLine.promotionEvaluationProvenance as any).applications[0];
       const applicationData = { schoolId: current.school.id, invoiceId: invoice.id, invoiceLineId: draftLine.id, ordinal: 0, policyId: provenance.policyId, versionId: provenance.versionId, targetId: provenance.targetId, assignmentId: provenance.assignmentId, discountType: provenance.discountType, discountValue: BigInt(provenance.discountValue), priority: provenance.priority, stackingMode: provenance.stackingMode, appliedDiscount: BigInt(provenance.appliedDiscount), grossAmount: draftLine.grossAmount, discountAmount: draftLine.discountAmount, netAmount: draftLine.netAmount, versionInterval: provenance.versionInterval, assignmentInterval: provenance.assignmentInterval, assignmentReason: provenance.assignmentReason };
       await expect(prisma.issuedPromotionApplication.create({ data: applicationData })).rejects.toThrow(/requires matching Draft same-School provenance and outcome/);
       const key = uuid(); const operationIdForIssue = uuid();
      const issued = await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, operationIdForIssue, { bankAccountId: bank.id });
      expect(issued.outcome).toMatchObject({ status: "ISSUED", lines: [expect.objectContaining({ promotionApplicationSnapshot: [expect.objectContaining({ versionId, appliedDiscount: "25", assignmentReason: "Ưu đãi integration" })] })] });
       const application = await prisma.issuedPromotionApplication.findFirstOrThrow({ where: { schoolId: current.school.id, invoiceId: invoice.id } });
       expect(application).toMatchObject({ grossAmount: 100n, discountAmount: 25n, netAmount: 75n });
      await expect(finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, uuid(), { bankAccountId: bank.id })).resolves.toEqual(issued);
      expect(await prisma.issuedPromotionApplication.count({ where: { schoolId: current.school.id, invoiceId: invoice.id } })).toBe(1);
       await expect(prisma.issuedPromotionApplication.create({ data: { schoolId: application.schoolId, invoiceId: application.invoiceId, invoiceLineId: application.invoiceLineId, ordinal: 1, policyId: application.policyId, versionId: application.versionId, targetId: application.targetId, assignmentId: application.assignmentId, discountType: application.discountType, discountValue: application.discountValue, priority: application.priority, stackingMode: application.stackingMode, appliedDiscount: application.appliedDiscount, grossAmount: application.grossAmount, discountAmount: application.discountAmount, netAmount: application.netAmount, versionInterval: application.versionInterval as any, assignmentInterval: application.assignmentInterval as any, assignmentReason: application.assignmentReason } })).rejects.toThrow(/requires matching Draft same-School provenance and outcome/);
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.promotionPolicyVersion.update({ where: { id: versionId }, data: { discountValue: 99n } }); });
      expect(await finance.invoice(current.identity.id, current.school.id, invoice.id)).toMatchObject({ lines: [expect.objectContaining({ promotionApplicationSnapshot: [expect.objectContaining({ versionId, appliedDiscount: "25" })] })] });
      await expect(prisma.issuedPromotionApplication.update({ where: { id: application.id }, data: { assignmentReason: "Không được sửa" } })).rejects.toThrow(/immutable/);
    });

    it("database trigger rejects issued applications for DRAFT invoices and invoice-line mismatches", async () => {
      const fixture = await issueFixture();
      const draftLine = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      const application = (invoiceId: string, invoiceLineId: string, ordinal = 0) => ({ schoolId: fixture.current.school.id, invoiceId, invoiceLineId, ordinal, policyId: uuid(), versionId: uuid(), targetId: uuid(), assignmentId: uuid(), discountType: "FIXED_VND" as const, discountValue: 1n, priority: 1, stackingMode: "STACKABLE" as const, appliedDiscount: 1n, grossAmount: 1n, discountAmount: 1n, netAmount: 0n, versionInterval: ["2026-09-01T00:00:00.000Z", null], assignmentInterval: ["2026-09-01T00:00:00.000Z", null], assignmentReason: "Direct PostgreSQL guard" });
       await expect(prisma.issuedPromotionApplication.create({ data: application(fixture.invoice.id, draftLine.id) })).rejects.toThrow(/requires matching Draft same-School provenance and outcome/);
       await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
       const replacementId = outcomeId(await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Trigger graph" }));
       await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { receivableId: fixture.receivableId, quantity: "1" });
       const replacementLine = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: replacementId } });
       await expect(prisma.issuedPromotionApplication.create({ data: application(fixture.invoice.id, replacementLine.id) })).rejects.toThrow(/requires matching Draft same-School provenance and outcome/);
    });

    it("rejects a stale calculated promotion at Issue without any partial snapshot or Issue outcome", async () => {
      const fixture = await issueFixture();
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      await prisma.invoiceLine.update({ where: { id: line.id }, data: { promotionEvaluationProvenance: { version: "PROMOTION_EVALUATION_V1", applications: [{ policyId: uuid(), versionId: uuid(), targetId: uuid(), assignmentId: uuid(), assignmentReason: "Stale", versionInterval: ["2026-09-01T00:00:00.000Z", null], assignmentInterval: ["2026-09-01T00:00:00.000Z", null], discountType: "FIXED_VND", discountValue: "1", priority: 1, stackingMode: "STACKABLE", appliedDiscount: "1" }] } } });
      await expect(finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id })).rejects.toMatchObject({ status: 409, response: { code: "PROMOTION_REVIEW_REQUIRED" } });
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ status: "DRAFT", issuedAt: null });
      expect(await prisma.issuedPromotionApplication.count({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toBe(0);
      expect(await prisma.auditRecord.count({ where: { schoolId: fixture.current.school.id, action: "INVOICE_ISSUED" } })).toBe(0);
    });

    it("closes only a fully terminal generated run atomically, replays the outcome, and database guards preserve the lock", async () => {
      const { current, invoice, bank } = await issueFixture();
      const runId = invoice.collectionRunId;
      const key = uuid(); const operationId = uuid();
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, key, operationId, { reason: "Đã rà soát" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      expect(await prisma.collectionRunLifecycleTransition.count({ where: { schoolId: current.school.id, collectionRunId: runId, status: "CLOSED" } })).toBe(0);
      await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, key, operationId, { reason: "Đã rà soát" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      await finance.closeInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { actualAmount: "9007199254740991" });
      const closed = await finance.closeRun(current.identity.id, current.school.id, runId, key, operationId, { reason: "Đã rà soát" });
      expect(closed).toMatchObject({ id: operationId, status: "COMPLETED", outcome: { id: runId, status: "CLOSED" } });
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, key, uuid(), { reason: "Đã rà soát" })).resolves.toEqual(closed);
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, key, uuid(), { reason: "Lý do khác" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      expect(await prisma.collectionRunLifecycleTransition.findMany({ where: { schoolId: current.school.id, collectionRunId: runId }, orderBy: { sequence: "asc" } })).toMatchObject([{ status: "DRAFT" }, { status: "READY" }, { status: "GENERATED" }, { previousStatus: "GENERATED", status: "CLOSED", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId }]);
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "COLLECTION_RUN_CLOSED" } })).toMatchObject({ reason: "Đã rà soát", membershipId: current.membership.id, provenance: { operationId } });
      await expect(finance.addGeneratedStudent(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentId: (await enrolled(current)).student.id })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_STATE_CONFLICT" } });
      await expect(prisma.collectionRun.update({ where: { id: runId }, data: { status: "GENERATED" } })).rejects.toThrow();
    });

    it("closes a run with an issued revision and its cancelled source, but keeps nonterminal invoices blocking", async () => {
      const fixture = await issueFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const prepared = await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Sửa số tiền" });
      const replacementId = outcomeId(prepared);
      await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { receivableId: fixture.receivableId, quantity: "1" });
      await expect(finance.closeRun(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.collectionRunId, uuid(), uuid(), { reason: "Còn bản nháp" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      await finance.issueRevision(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await expect(finance.closeRun(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.collectionRunId, uuid(), uuid(), { reason: "Còn hóa đơn đã phát hành" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { actualAmount: "9007199254740991" });
      await expect(finance.closeRun(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.collectionRunId, uuid(), uuid(), { reason: "Đã kiểm tra bản điều chỉnh" })).resolves.toMatchObject({ outcome: { status: "CLOSED" } });
      await expect(prisma.collectionRun.findUniqueOrThrow({ where: { id: fixture.invoice.collectionRunId } })).resolves.toMatchObject({ status: "CLOSED" });
    });

    it("rejects direct DRAFT or READY close, contradictory lifecycle history, and every closed-run business mutation", async () => {
      const current = await roster(await graph());
      const draftId = outcomeId(await open(current));
      await expect(prisma.collectionRun.update({ where: { id: draftId }, data: { status: "CLOSED" } })).rejects.toThrow(/only from GENERATED/);
      await enrolled(current);
      const readyId = outcomeId(await open(current, "2026-10"));
      const preview = await finance.preview(current.identity.id, current.school.id, readyId);
      await finance.readyRun(current.identity.id, current.school.id, readyId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(prisma.collectionRun.update({ where: { id: readyId }, data: { status: "CLOSED" } })).rejects.toThrow(/only from GENERATED/);
       const { current: issuedCurrent, invoice, bank } = await issueFixture();
       await finance.issueInvoice(issuedCurrent.identity.id, issuedCurrent.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
       const runId = invoice.collectionRunId;
       await finance.closeInvoice(issuedCurrent.identity.id, issuedCurrent.school.id, invoice.id, uuid(), uuid(), { actualAmount: "9007199254740991" });
       await finance.closeRun(issuedCurrent.identity.id, issuedCurrent.school.id, runId, uuid(), uuid(), { reason: "Khóa dữ liệu" });
      await expect(prisma.collectionRun.update({ where: { id: runId }, data: { billingMonth: "2026-10" } })).rejects.toThrow(/business data is immutable/);
      await expect(prisma.collectionRunLifecycleTransition.create({ data: { schoolId: issuedCurrent.school.id, collectionRunId: runId, previousStatus: "GENERATED", status: "CLOSED", actorIdentityId: issuedCurrent.identity.id, membershipId: issuedCurrent.membership.id, operationId: uuid(), sequence: 4 } })).rejects.toThrow(/does not match parent state|Contradictory/);
    });

    it("denies foreign or revoked close and serializes close against generated-student addition", async () => {
       const fixture = await issueFixture(); const foreign = await roster(await graph());
       await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
       const runId = fixture.invoice.collectionRunId;
      await expect(finance.closeRun(foreign.identity.id, foreign.school.id, runId, uuid(), uuid(), { reason: "Foreign" })).rejects.toMatchObject({ status: 404, response: { code: "COLLECTION_RUN_NOT_FOUND" } });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.closeRun(fixture.current.identity.id, fixture.current.school.id, runId, uuid(), uuid(), { reason: "Revoked" })).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
       await prisma.positionCapabilityGrant.create({ data: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
       await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "9007199254740991" });
      const later = await enrolled(fixture.current);
      const results = await Promise.allSettled([
        finance.closeRun(fixture.current.identity.id, fixture.current.school.id, runId, uuid(), uuid(), { reason: "Concurrent" }),
        finance.addGeneratedStudent(fixture.current.identity.id, fixture.current.school.id, runId, uuid(), uuid(), { studentId: later.student.id }),
      ]);
      const run = await prisma.collectionRun.findUniqueOrThrow({ where: { id: runId } });
      if (run.status === "CLOSED") expect(await prisma.invoice.count({ where: { schoolId: fixture.current.school.id, collectionRunId: runId, status: "DRAFT" } })).toBe(0);
      else expect(results.some((result) => result.status === "rejected" && (result.reason as any)?.response?.code === "COLLECTION_RUN_INVOICES_NOT_TERMINAL")).toBe(true);
    });

    it("selects the FinancePolicy and due date from one Vietnam-local issue instant at a UTC boundary", async () => {
      const { invoice, bank, current } = await issueFixture();
      await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-09-22"), dueDaysAfterIssue: 11, taxTreatment: "TAX_INCLUDED", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "SCHOOL_ADMIN_APPROVAL", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      const fixedNow = new Date("2026-09-21T17:30:00.000Z"); vi.useFakeTimers(); vi.setSystemTime(fixedNow);
      const issued = await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
      vi.useRealTimers();
      expect(issued.outcome).toMatchObject({ issue: { issuedAt: fixedNow.toISOString(), dueOn: "2026-10-03", policy: { effectiveFrom: "2026-09-22", dueDaysAfterIssue: 11, taxTreatment: "TAX_INCLUDED", reversalMode: "SCHOOL_ADMIN_APPROVAL" } } });
    });

    it("refuses issue without an effective FinancePolicy without partial invoice, audit, or operation outcome", async () => {
      const { current, invoice, bank } = await issueFixture();
      await prisma.$transaction(async (tx) => { await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`; await tx.financePolicy.deleteMany({ where: { schoolId: current.school.id } }); });
      await expect(finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id })).rejects.toMatchObject({ status: 409, response: { code: "FINANCE_POLICY_NOT_CONFIGURED" } });
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).toMatchObject({ status: "DRAFT", issuedAt: null, obligationTotalSnapshot: null });
      expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_ISSUED" } })).toBe(0);
    });

    it("rejects normal issue through the API and direct status writes after SchoolYear or CollectionRun finality", async () => {
      const closedYear = await issueFixture();
      await prisma.schoolYear.update({ where: { id: closedYear.current.year.id }, data: { closedAt: new Date() } });
      await expect(finance.issueInvoice(closedYear.current.identity.id, closedYear.current.school.id, closedYear.invoice.id, uuid(), uuid(), { bankAccountId: closedYear.bank.id })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_CLOSED" } });
      await expect(prisma.invoice.update({ where: { id: closedYear.invoice.id }, data: { status: "ISSUED" } })).rejects.toThrow(/CLOSED SchoolYear/);
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: closedYear.invoice.id } })).toMatchObject({ status: "DRAFT", issuedAt: null });

       const closedRun = await issueFixture();
       await finance.issueInvoice(closedRun.current.identity.id, closedRun.current.school.id, closedRun.invoice.id, uuid(), uuid(), { bankAccountId: closedRun.bank.id });
       await finance.closeInvoice(closedRun.current.identity.id, closedRun.current.school.id, closedRun.invoice.id, uuid(), uuid(), { actualAmount: "9007199254740991" });
       await finance.closeRun(closedRun.current.identity.id, closedRun.current.school.id, closedRun.invoice.collectionRunId, uuid(), uuid(), { reason: "Đóng đợt thu" });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: closedRun.invoice.id } });
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
        await tx.invoice.update({ where: { id: issued.id }, data: { status: "DRAFT", issuedAt: null, bankAccountIdSnapshot: null, receivingBankSnapshot: null, receivingBankBinSnapshot: null, accountNumberSnapshot: null, accountHolderNameSnapshot: null, transferContentSnapshot: null, obligationLinesSnapshot: Prisma.DbNull, obligationTotalSnapshot: null, financePolicyEffectiveFrom: null, dueDaysAfterIssueSnapshot: null, taxTreatmentSnapshot: null, debtScopeSnapshot: null, reversalModeSnapshot: null, dueOn: null } });
      });
      await expect(prisma.invoice.update({ where: { id: issued.id }, data: { status: "ISSUED", issuedAt: issued.issuedAt!, bankAccountIdSnapshot: issued.bankAccountIdSnapshot!, receivingBankSnapshot: issued.receivingBankSnapshot!, receivingBankBinSnapshot: issued.receivingBankBinSnapshot!, accountNumberSnapshot: issued.accountNumberSnapshot!, accountHolderNameSnapshot: issued.accountHolderNameSnapshot!, transferContentSnapshot: issued.transferContentSnapshot!, obligationLinesSnapshot: issued.obligationLinesSnapshot as Prisma.InputJsonValue, obligationTotalSnapshot: issued.obligationTotalSnapshot!, financePolicyEffectiveFrom: issued.financePolicyEffectiveFrom!, dueDaysAfterIssueSnapshot: issued.dueDaysAfterIssueSnapshot!, taxTreatmentSnapshot: issued.taxTreatmentSnapshot!, debtScopeSnapshot: issued.debtScopeSnapshot!, reversalModeSnapshot: issued.reversalModeSnapshot!, dueOn: issued.dueOn! } })).rejects.toThrow(/CLOSED CollectionRun/);
    });

    it("rejects SchoolYear close while a generated CollectionRun has DRAFT invoices", async () => {
      const fixture = await issueFixture();
      await prisma.positionCapabilityGrant.create({ data: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "ROSTER_MANAGE" } });
      const input = { schoolYearId: fixture.current.year.id, effectiveTo: "2026-12-31", reason: "Kết năm", confirmation: "ĐÓNG NĂM HỌC" };
      const preview = await rosterService.previewCloseYear(fixture.current.identity.id, fixture.current.school.id, input);
      await expect(rosterService.closeYear(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...input, previewFingerprint: preview.fingerprint })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      expect(await prisma.schoolYear.findUniqueOrThrow({ where: { id: fixture.current.year.id } })).toMatchObject({ closedAt: null });
    });

    it("refuses foreign or inactive accounts, empty/non-DRAFT invoices, revoked actors, and changed issue retries without writes", async () => {
      const fixture = await issueFixture(); const foreign = await issueFixture();
      await expect(finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: foreign.bank.id })).rejects.toMatchObject({ status: 404, response: { code: "BANK_ACCOUNT_NOT_FOUND" } });
      await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: fixture.current.school.id, bankAccountId: fixture.bank.id, previousStatus: "ACTIVE", status: "INACTIVE", reason: "Không dùng", actorIdentityId: fixture.current.identity.id, membershipId: fixture.current.membership.id, operationId: fixture.operationId, sequence: 2 } });
      await expect(finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id })).rejects.toMatchObject({ status: 404, response: { code: "BANK_ACCOUNT_NOT_FOUND" } });
      expect(await prisma.auditRecord.count({ where: { schoolId: fixture.current.school.id, action: "INVOICE_ISSUED" } })).toBe(0);
      const empty = await issueFixture(); await prisma.invoiceLine.deleteMany({ where: { invoiceId: empty.invoice.id } });
      await expect(finance.issueInvoice(empty.current.identity.id, empty.current.school.id, empty.invoice.id, uuid(), uuid(), { bankAccountId: empty.bank.id })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { invoiceId: expect.any(String) } } });
      const issued = await issueFixture(); const issuedResult = await finance.issueInvoice(issued.current.identity.id, issued.current.school.id, issued.invoice.id, uuid(), uuid(), { bankAccountId: issued.bank.id });
      await expect(finance.issueInvoice(issued.current.identity.id, issued.current.school.id, issued.invoice.id, uuid(), uuid(), { bankAccountId: issued.bank.id })).rejects.toMatchObject({ status: 409, response: { code: "INVOICE_NOT_DRAFT" } });
      const key = uuid(); await expect(finance.issueInvoice(issued.current.identity.id, issued.current.school.id, issued.invoice.id, key, uuid(), { bankAccountId: issued.bank.id })).rejects.toMatchObject({ status: 409 });
      expect(issuedResult.status).toBe("COMPLETED");
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id })).rejects.toMatchObject({ status: 403, response: { code: "CAPABILITY_DENIED" } });
    });

    it("serializes concurrent issue attempts and database guards reject lifecycle, snapshot, total and line mutation", async () => {
      const { current, invoice, bank, receivableId } = await issueFixture();
      const attempts = await Promise.allSettled([finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id }), finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id })]);
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((attempt) => attempt.status === "rejected")[0]).toMatchObject({ reason: { status: 409, response: { code: "INVOICE_NOT_DRAFT" } } });
      expect(await prisma.auditRecord.count({ where: { schoolId: current.school.id, action: "INVOICE_ISSUED" } })).toBe(1);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { total: 1n } })).rejects.toThrow(/immutable/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { transferContentSnapshot: "Injected" } })).rejects.toThrow(/immutable/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { bankAccountIdSnapshot: bank.id, receivingBankSnapshot: "Injected", accountNumberSnapshot: "0", accountHolderNameSnapshot: "Injected", obligationLinesSnapshot: [], obligationTotalSnapshot: 1n, financePolicyEffectiveFrom: date("2026-01-01"), dueDaysAfterIssueSnapshot: 1, taxTreatmentSnapshot: "TAX_INCLUDED", debtScopeSnapshot: "CURRENT_SCHOOL_YEAR_ONLY", reversalModeSnapshot: "SCHOOL_ADMIN_APPROVAL", dueOn: date("2026-01-01") } })).rejects.toThrow(/immutable/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { status: "DRAFT" } })).rejects.toThrow(/immutable/);
      await expect(prisma.invoiceLine.create({ data: { schoolId: current.school.id, invoiceId: invoice.id, receivableId, receivableNameSnapshot: "Injected", unitLabelSnapshot: "lần", defaultUnitPriceSnapshot: 1n, unitPrice: 1n, quantity: 1, amount: 1n } })).rejects.toThrow(/DRAFT/);
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { invoiceId: invoice.id } });
      await expect(prisma.invoiceLine.update({ where: { id: line.id }, data: { unitPrice: 1n } })).rejects.toThrow(/DRAFT/);
       await expect(prisma.$queryRaw<Array<{ labels: string[] }>>`SELECT ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = '"InvoiceStatus"'::regtype ORDER BY enumsortorder)::text[] AS labels`).resolves.toEqual([{ labels: ["DRAFT", "ISSUED", "CANCELLED", "CLOSED"] }]);
    });

    it("renders the VietQR payment image only for an unsettled issued Invoice, audited and School-scoped", async () => {
      const { current, invoice, bank } = await issueFixture("1350000");
      await expect(finance.paymentImage(current.identity.id, current.school.id, invoice.id)).rejects.toMatchObject({ status: 409, response: { code: "PAYMENT_IMAGE_UNAVAILABLE" } });
      await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
      expect(issued).toMatchObject({ receivingBankBinSnapshot: "970436", transferContentSnapshot: expect.stringMatching(/^[A-Za-z0-9 ]{1,50}$/) });
      await expect(finance.invoice(current.identity.id, current.school.id, invoice.id)).resolves.toMatchObject({ paymentImageAvailable: true, issue: { bankAccount: { bankBin: "970436" } } });
      const image = await finance.paymentImage(current.identity.id, current.school.id, invoice.id);
      expect(image.png.subarray(1, 4).toString()).toBe("PNG");
      expect(image.fileName).toBe(`${issued.obligationCodeSnapshot}-${issued.studentCodeSnapshot}.png`);
      await expect(prisma.auditRecord.findFirst({ where: { schoolId: current.school.id, action: "INVOICE_PAYMENT_IMAGE_DOWNLOADED" } })).resolves.toMatchObject({ membershipId: current.membership.id, provenance: { invoiceId: invoice.id, amount: "1350000" } });
      await expect(prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).resolves.toMatchObject({ status: "ISSUED" });
      const foreign = await roster(await graph());
      await expect(finance.paymentImage(foreign.identity.id, foreign.school.id, invoice.id)).rejects.toMatchObject({ status: 404 });
      await expect(finance.paymentImage(foreign.identity.id, current.school.id, invoice.id)).rejects.toMatchObject({ status: 404 });
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { receivingBankBinSnapshot: "970418" } })).rejects.toThrow(/immutable/);
      await finance.closeInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { actualAmount: "1350000" });
      await expect(finance.invoice(current.identity.id, current.school.id, invoice.id)).resolves.toMatchObject({ paymentImageAvailable: false });
      await expect(finance.paymentImage(current.identity.id, current.school.id, invoice.id)).rejects.toMatchObject({ status: 409, response: { code: "PAYMENT_IMAGE_UNAVAILABLE" } });
    });

    it("rejects direct DRAFT snapshot injection and incomplete or incoherent DRAFT-to-ISSUED mutation", async () => {
      const { invoice, bank } = await issueFixture();
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { bankAccountIdSnapshot: bank.id } })).rejects.toThrow(/Draft invoice cannot contain issue snapshots/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: new Date(), bankAccountIdSnapshot: bank.id, receivingBankSnapshot: "Bank", accountNumberSnapshot: "1", accountHolderNameSnapshot: "Holder", transferContentSnapshot: "Content", obligationLinesSnapshot: [], obligationTotalSnapshot: 1n, financePolicyEffectiveFrom: date("2026-01-01"), dueDaysAfterIssueSnapshot: 1, taxTreatmentSnapshot: "NOT_APPLICABLE", debtScopeSnapshot: "CURRENT_SCHOOL_YEAR_ONLY", reversalModeSnapshot: "DIRECT", dueOn: date("2026-01-02"), obligationCodeSnapshot: "OBL-INCONSISTENT" } })).rejects.toThrow(/internally inconsistent/);
    });

    it("posts immutable exact, shortfall, and overpayment receipts once, then carries a shortfall only into the next monthly DRAFT", async () => {
      const exact = await issueFixture();
      await finance.issueInvoice(exact.current.identity.id, exact.current.school.id, exact.invoice.id, uuid(), uuid(), { bankAccountId: exact.bank.id });
      const exactKey = uuid(); const exactOperationId = uuid();
      const exactResult = await finance.closeInvoice(exact.current.identity.id, exact.current.school.id, exact.invoice.id, exactKey, exactOperationId, { actualAmount: "9007199254740991" });
      await expect(finance.closeInvoice(exact.current.identity.id, exact.current.school.id, exact.invoice.id, exactKey, uuid(), { actualAmount: "9007199254740991" })).resolves.toEqual(exactResult);
      expect(exactResult).toMatchObject({ id: exactOperationId, outcome: { status: "CLOSED", receipt: { outcome: "EXACT", difference: null } } });
      expect(await prisma.receipt.count({ where: { schoolId: exact.current.school.id, invoiceId: exact.invoice.id } })).toBe(1);
      expect(await prisma.settlementDifference.count({ where: { schoolId: exact.current.school.id, invoiceId: exact.invoice.id } })).toBe(0);

      const shortfall = await issueFixture();
      await finance.issueInvoice(shortfall.current.identity.id, shortfall.current.school.id, shortfall.invoice.id, uuid(), uuid(), { bankAccountId: shortfall.bank.id });
      const shortfallResult = await finance.closeInvoice(shortfall.current.identity.id, shortfall.current.school.id, shortfall.invoice.id, uuid(), uuid(), { actualAmount: "9007199254740981" });
       expect(shortfallResult.outcome).toMatchObject({ status: "CLOSED", receipt: { outcome: "SHORTFALL", difference: { signedAmount: "10" } } });
      const nextRunId = outcomeId(await open(shortfall.current, "2026-10"));
      const nextPreview = await finance.preview(shortfall.current.identity.id, shortfall.current.school.id, nextRunId);
      await finance.readyRun(shortfall.current.identity.id, shortfall.current.school.id, nextRunId, uuid(), uuid(), { previewFingerprint: nextPreview.fingerprint });
      await generate(shortfall.current, nextRunId);
       const carried = await prisma.invoice.findFirstOrThrow({ where: { schoolId: shortfall.current.school.id, collectionRunId: nextRunId, studentId: shortfall.student.student.id }, include: { settlementCarries: true } });
       expect(carried).toMatchObject({ status: "DRAFT", total: 11n, settlementCarries: [expect.objectContaining({ type: "SHORTFALL_CARRY", amount: 10n })] });
       expect(await prisma.financeLedgerEvent.findFirstOrThrow({ where: { schoolId: shortfall.current.school.id, invoiceId: carried.id, type: "SETTLEMENT_CARRY_POSTED" } })).toMatchObject({ provenance: { settlementCarryId: carried.settlementCarries[0]!.id } });
      await expect(prisma.settlementCarry.update({ where: { id: carried.settlementCarries[0]!.id }, data: { amount: 1n } })).rejects.toThrow(/immutable/);

      const concurrent = await issueFixture("100");
      await finance.issueInvoice(concurrent.current.identity.id, concurrent.current.school.id, concurrent.invoice.id, uuid(), uuid(), { bankAccountId: concurrent.bank.id });
      const attempts = await Promise.allSettled([
        finance.closeInvoice(concurrent.current.identity.id, concurrent.current.school.id, concurrent.invoice.id, uuid(), uuid(), { actualAmount: "100" }),
        finance.closeInvoice(concurrent.current.identity.id, concurrent.current.school.id, concurrent.invoice.id, uuid(), uuid(), { actualAmount: "100" }),
      ]);
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.receipt.count({ where: { schoolId: concurrent.current.school.id, invoiceId: concurrent.invoice.id } })).toBe(1);

      const overpayment = await issueFixture("100");
      await finance.issueInvoice(overpayment.current.identity.id, overpayment.current.school.id, overpayment.invoice.id, uuid(), uuid(), { bankAccountId: overpayment.bank.id });
      const overpaymentResult = await finance.closeInvoice(overpayment.current.identity.id, overpayment.current.school.id, overpayment.invoice.id, uuid(), uuid(), { actualAmount: "101" });
       expect(overpaymentResult.outcome).toMatchObject({ receipt: { outcome: "OVERPAYMENT", difference: { signedAmount: "-1" } } });
    });

    it("persists prepaid coverage facts with immutable future provenance on the DRAFT Invoice", async () => {
      const fixture = await coverageFixture();
      const fact = await prisma.invoicePromotionCoverageFact.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id, billingMonth: "2026-10" } });
      expect(fact).toMatchObject({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-10", versionId: fixture.versionId, originalPrice: 100n, reduction: 10n, serviceStart: date("2026-10-01"), serviceEnd: date("2026-11-01"), calendarEffectiveFrom: date("2026-01-01"), timezone: "Asia/Ho_Chi_Minh" });
      expect(await prisma.studentPromotionalCoverage.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      await expect(prisma.invoicePromotionCoverageFact.update({ where: { id: fact.id }, data: { billingMonth: "2026-11" } })).rejects.toThrow(/append-only/);
      await expect(prisma.collectionRunCoverageSelection.create({ data: { schoolId: fixture.current.school.id, collectionRunId: fixture.runId, studentId: fixture.student.student.id, versionId: fixture.versionId, billingMonth: "2026-11" } })).rejects.toThrow(/DRAFT/);
    });

    it("manages DRAFT invoice coverage with derivation, discount suppression, rejection of extra fields, and atomic clear", async () => {
      const fixture = await coverageFixture();
      await expect(
        finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), {
          versionId: fixture.versionId,
          studentId: fixture.student.student.id,
        })
      ).rejects.toMatchObject({ status: 400, response: { code: "VALIDATION_ERROR" } });
      await expect(
        finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), {
          versionId: fixture.versionId,
          amount: "100",
        })
      ).rejects.toMatchObject({ status: 400, response: { code: "VALIDATION_ERROR" } });
      await expect(
        finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), {
          versionId: fixture.versionId,
          billingMonth: "2026-09",
        })
      ).rejects.toMatchObject({ status: 400, response: { code: "VALIDATION_ERROR" } });

      const clearOpId = uuid();
      const clearRes = await finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), clearOpId, { versionId: null });
      expect(clearRes.status).toBe("COMPLETED");
      expect(await prisma.invoicePromotionCoverageFact.count({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toBe(0);

      const applyOpId = uuid();
      const applyKey = uuid();
      const applied = await finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, applyKey, applyOpId, { versionId: fixture.versionId });
      expect(applied.status).toBe("COMPLETED");
      const replay = await finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, applyKey, uuid(), { versionId: fixture.versionId });
      expect(replay).toEqual(applied);

      const facts = await prisma.invoicePromotionCoverageFact.findMany({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id }, orderBy: { billingMonth: "asc" } });
      expect(facts).toHaveLength(2);
      expect(facts[0]!.billingMonth).toBe("2026-09");
      expect(facts[1]!.billingMonth).toBe("2026-10");

      const run2Id = outcomeId(await finance.openRun(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { schoolYearId: fixture.current.year.id, billingMonth: "2026-10" }));
      await finance.saveTemplateLine(fixture.current.identity.id, fixture.current.school.id, run2Id, uuid(), uuid(), { receivableId: fixture.coveredReceivableId, quantity: "1", expectedVersion: 1 });
      const preview2 = await finance.preview(fixture.current.identity.id, fixture.current.school.id, run2Id);
      await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, run2Id, uuid(), uuid(), { previewFingerprint: preview2.fingerprint });
      const gen2 = await generate(fixture.current, run2Id);
      expect(gen2.status).toBe("COMPLETED");
      const invoice2 = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: run2Id, studentId: fixture.student.student.id } });
      await expect(
        finance.applyInvoiceCoverage(fixture.current.identity.id, fixture.current.school.id, invoice2.id, uuid(), uuid(), { versionId: fixture.versionId })
      ).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_ALREADY_RESERVED" } });
    });

    it("rejects source-line mutation and revision while a DRAFT Invoice owns coverage facts", async () => {
      const fixture = await coverageFixture();
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      await expect(finance.editInvoiceLine(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, line.id, uuid(), uuid(), { quantity: "2" })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_FACTS_IMMUTABLE" } });
      await expect(finance.removeInvoiceLine(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, line.id, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_FACTS_IMMUTABLE" } });
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Không được mất coverage" })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_REVISION_FORBIDDEN" } });
    });

    it("closes a coverage Invoice exactly once and atomically issues immutable paid coverage with replay", async () => {
      const fixture = await coverageFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      const key = uuid(); const operationId = uuid();
      const closed = await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, key, operationId, { actualAmount: issued.obligationTotalSnapshot!.toString() });
      await expect(finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, key, uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() })).resolves.toEqual(closed);
      expect(closed).toMatchObject({ id: operationId, outcome: { status: "CLOSED", receipt: { actualAmount: issued.obligationTotalSnapshot!.toString(), outcome: "EXACT", difference: null }, coverageFacts: [expect.objectContaining({ billingMonth: "2026-09", issuedAt: expect.any(String) }), expect.objectContaining({ billingMonth: "2026-10", issuedAt: expect.any(String) })] } });
      const receipt = await prisma.receipt.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      const coverage = await prisma.studentPromotionalCoverage.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, billingMonth: "2026-10" } });
      expect(coverage).toMatchObject({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-10", sourceInvoiceId: fixture.invoice.id, sourceReceiptId: receipt.id, versionId: fixture.versionId, originalPrice: 100n, reduction: 10n });
      await expect(prisma.studentPromotionalCoverage.update({ where: { id: coverage.id }, data: { reduction: 0n } })).rejects.toThrow(/append-only/);
    });

    it("serializes concurrent exact coverage close attempts without duplicate Receipt or coverage", async () => {
      const fixture = await coverageFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      const attempts = await Promise.allSettled([
        finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() }),
        finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() }),
      ]);
      expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.receipt.count({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toBe(1);
      expect(await prisma.studentPromotionalCoverage.count({ where: { schoolId: fixture.current.school.id, sourceInvoiceId: fixture.invoice.id } })).toBe(2);
    });

    it("rolls back a non-exact coverage close without Receipt, difference, carry, or coverage", async () => {
      const fixture = await coverageFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      await expect(finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: (issued.obligationTotalSnapshot! - 1n).toString() })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_EXACT_AMOUNT_REQUIRED" } });
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ status: "ISSUED" });
      expect(await prisma.receipt.count({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toBe(0);
      expect(await prisma.settlementDifference.count({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toBe(0);
      expect(await prisma.settlementCarry.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      expect(await prisma.studentPromotionalCoverage.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
    });

    it("rejects cross-scope coverage provenance and duplicate coverage at the PostgreSQL boundary", async () => {
      const fixture = await coverageFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() });
      expect(await prisma.studentPromotionalCoverage.findMany({ where: { schoolId: fixture.current.school.id }, orderBy: { billingMonth: "asc" } })).toEqual([expect.objectContaining({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-09" }), expect.objectContaining({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-10" })]);
      const fact = await prisma.invoicePromotionCoverageFact.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      const coverage = await prisma.studentPromotionalCoverage.findFirstOrThrow({ where: { schoolId: fixture.current.school.id } });
      await expect(prisma.studentPromotionalCoverage.create({ data: { schoolId: fixture.current.school.id, studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.otherReceivableId, billingMonth: fact.billingMonth, sourceFactId: fact.id, sourceInvoiceId: fixture.invoice.id, sourceReceiptId: coverage.sourceReceiptId, policyId: fact.policyId, versionId: fact.versionId, originalPrice: fact.originalPrice, reduction: fact.reduction, serviceStart: fact.serviceStart, serviceEnd: fact.serviceEnd, calendarEffectiveFrom: fact.calendarEffectiveFrom, timezone: fact.timezone } })).rejects.toThrow(/exact closed same-scope/);
      await expect(prisma.studentPromotionalCoverage.create({ data: { schoolId: fixture.current.school.id, studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fact.receivableId, billingMonth: fact.billingMonth, sourceFactId: fact.id, sourceInvoiceId: fixture.invoice.id, sourceReceiptId: coverage.sourceReceiptId, policyId: fact.policyId, versionId: fact.versionId, originalPrice: fact.originalPrice, reduction: fact.reduction, serviceStart: fact.serviceStart, serviceEnd: fact.serviceEnd, calendarEffectiveFrom: fact.calendarEffectiveFrom, timezone: fact.timezone } })).rejects.toThrow();
    });

    it("skips only the issued coverage receivable-period in the later normal monthly run", async () => {
      const fixture = await coverageFixture();
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const issued = await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: issued.obligationTotalSnapshot!.toString() });
      const nextRunId = outcomeId(await finance.openRun(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { schoolYearId: fixture.current.year.id, billingMonth: "2026-10" }));
      await finance.saveTemplateLine(fixture.current.identity.id, fixture.current.school.id, nextRunId, uuid(), uuid(), { receivableId: fixture.coveredReceivableId, quantity: "1", expectedVersion: 1 });
      await finance.saveTemplateLine(fixture.current.identity.id, fixture.current.school.id, nextRunId, uuid(), uuid(), { receivableId: fixture.otherReceivableId, quantity: "1", expectedVersion: 2 });
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, nextRunId);
      expect(preview.eligible[0]!.lines).toEqual([expect.objectContaining({ receivableId: fixture.otherReceivableId, grossAmount: "25", netAmount: "25" })]);
      await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, nextRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(fixture.current, nextRunId);
      const nextInvoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: nextRunId }, include: { lines: true } });
      expect(nextInvoice.lines).toEqual([expect.objectContaining({ receivableId: fixture.otherReceivableId, amount: 25n })]);
    });

    it("serializes concurrent direct reversal inserts at the PostgreSQL coverage lock", async () => {
      const fixture = await coverageFixture(); const coverage = await closeCoverage(fixture);
      const attempts = await Promise.allSettled([
        prisma.coverageReversal.create({ data: { schoolId: fixture.current.school.id, coverageId: coverage.id, amount: 50n, calculatedAmount: 50n, effectiveOn: date("2026-10-01"), reason: "Direct A" } }),
        prisma.coverageReversal.create({ data: { schoolId: fixture.current.school.id, coverageId: coverage.id, amount: 50n, calculatedAmount: 50n, effectiveOn: date("2026-10-01"), reason: "Direct B" } }),
      ]);
      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(attempts.filter((result) => result.status === "rejected")).toHaveLength(1);
      expect(await prisma.coverageReversal.aggregate({ where: { schoolId: fixture.current.school.id, coverageId: coverage.id }, _sum: { amount: true } })).toMatchObject({ _sum: { amount: 50n } });
    });

    it("rejects cross-School reversal graph and preserves append-only reversal records", async () => {
      const fixture = await coverageFixture(); const coverage = await closeCoverage(fixture); const foreign = await coverageFixture(); const foreignCoverage = await closeCoverage(foreign);
      await expect(prisma.coverageReversal.create({ data: { schoolId: fixture.current.school.id, coverageId: foreignCoverage.id, amount: 1n, calculatedAmount: 1n, effectiveOn: date("2026-10-01"), reason: "Cross school" } })).rejects.toThrow();
      const posted = await prisma.coverageReversal.create({ data: { schoolId: fixture.current.school.id, coverageId: coverage.id, amount: 1n, calculatedAmount: 1n, effectiveOn: date("2026-10-01"), reason: "Hoàn" } });
      await expect(prisma.coverageReversal.update({ where: { id: posted.id }, data: { amount: 0n } })).rejects.toThrow(/append-only/);
    });

    it("creates immutable settlement transfer when correcting a CLOSED receipt-backed Invoice", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "100" });
      const prepared = await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Sửa sau thu" });
      const replacementId = (prepared.outcome as any).id;
      await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { receivableId: fixture.receivableId, quantity: "1" });
      await finance.issueRevision(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const transfer = await prisma.settlementTransfer.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, replacementInvoiceId: replacementId } });
      expect(transfer).toMatchObject({ sourceInvoiceId: fixture.invoice.id, studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, amount: 100n });
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: replacementId } })).toMatchObject({ status: "CLOSED" });
      await expect(finance.invoice(fixture.current.identity.id, fixture.current.school.id, replacementId)).resolves.toMatchObject({ status: "CLOSED", receipt: null, settlementTransfer: { sourceInvoiceId: fixture.invoice.id, sourceReceiptId: transfer.sourceReceiptId, amount: "100", postedAt: expect.any(String) } });
      await expect(prisma.settlementTransfer.update({ where: { id: transfer.id }, data: { amount: 0n } })).rejects.toThrow(/append-only/);
    });
    it("rejects a CLOSED correction when transfer amount differs and preserves source/replacement facts", async () => {
      for (const replacementAmount of ["99", "101"]) {
        const fixture = await issueFixture("100"); await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id }); await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "100" });
        const prepared = await finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Sai tổng" }); const replacementId = (prepared.outcome as any).id;
        await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { receivableId: fixture.receivableId, quantity: replacementAmount });
        await expect(finance.issueRevision(fixture.current.identity.id, fixture.current.school.id, replacementId, uuid(), uuid(), { bankAccountId: fixture.bank.id })).rejects.toMatchObject({ status: 409, response: { code: "SETTLEMENT_TRANSFER_AMOUNT_MISMATCH" } });
        expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ status: "CLOSED" }); expect(await prisma.invoice.findUniqueOrThrow({ where: { id: replacementId } })).toMatchObject({ status: "DRAFT" }); expect(await prisma.settlementTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      }
    });
    it("rejects bundled snapshot mutation on CLOSED to CANCELLED correction", async () => {
      const fixture = await issueFixture("100"); await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id }); await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "100" });
      await expect(prisma.invoice.update({ where: { id: fixture.invoice.id }, data: { status: "CANCELLED", total: 1n } })).rejects.toThrow(/only change status/);
    });
    it("moves bounded same-scope outstanding debt append-only, replays safely, and settles the target through actual receipt", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const targetRunId = outcomeId(await open(fixture.current, "2026-10"));
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, targetRunId);
      await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(fixture.current, targetRunId);
      const target = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: targetRunId, studentId: fixture.student.student.id } });
      const key = uuid(); const operationId = uuid(); const body = { sourceInvoiceId: fixture.invoice.id, targetInvoiceId: target.id, amount: "40", reason: "Đối soát cuối năm" };
      const transferred = await finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, key, operationId, body);
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, key, uuid(), body)).resolves.toEqual(transferred);
      expect(transferred).toMatchObject({ id: operationId, outcome: { sourceOutstanding: "60", amount: "40" } });
      const debt = await prisma.debtTransfer.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, operationId } });
      expect(debt).toMatchObject({ sourceInvoiceId: fixture.invoice.id, targetInvoiceId: target.id, amount: 40n, studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, key, uuid(), { ...body, amount: "41" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      await expect(finance.editInvoiceLine(fixture.current.identity.id, fixture.current.school.id, target.id, debt.targetLineId, uuid(), uuid(), { quantity: "2" })).rejects.toMatchObject({ status: 409, response: { code: "PRIOR_DEBT_IMMUTABLE" } });
      await expect(finance.removeInvoiceLine(fixture.current.identity.id, fixture.current.school.id, target.id, debt.targetLineId, uuid(), uuid())).rejects.toMatchObject({ status: 409, response: { code: "PRIOR_DEBT_IMMUTABLE" } });
      await expect(prisma.invoiceLine.update({ where: { id: debt.targetLineId }, data: { amount: 1n } })).rejects.toThrow(/PRIOR_DEBT lines are immutable/);
      await expect(prisma.invoiceLine.delete({ where: { id: debt.targetLineId } })).rejects.toThrow(/PRIOR_DEBT lines are immutable/);
      const competing = await Promise.allSettled([
        finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, amount: "40", reason: "Cạnh tranh A" }),
        finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, amount: "40", reason: "Cạnh tranh B" }),
      ]);
      expect(competing.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.debtTransfer.aggregate({ where: { schoolId: fixture.current.school.id, sourceInvoiceId: fixture.invoice.id }, _sum: { amount: true } })).toMatchObject({ _sum: { amount: 80n } });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, amount: "61" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_EXCEEDS_OUTSTANDING" } });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { reason: "Không được sửa nguồn debt" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_REVISION_FORBIDDEN" } });
      await expect(finance.prepareRevision(fixture.current.identity.id, fixture.current.school.id, target.id, uuid(), uuid(), { reason: "Không được sửa đích debt" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_REVISION_FORBIDDEN" } });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "19" });
       expect(await prisma.settlementDifference.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } })).toMatchObject({ signedAmount: 1n });
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, target.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
       await expect(finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, target.id, uuid(), uuid(), { actualAmount: "82" })).resolves.toMatchObject({ outcome: { receipt: { outcome: "OVERPAYMENT", difference: { signedAmount: "-1" } } } });
      await expect(prisma.debtTransfer.update({ where: { id: debt.id }, data: { amount: 1n } })).rejects.toThrow(/append-only/);
    });
    it("rejects foreign debt targets without creating provenance or changing source outstanding", async () => {
      const fixture = await issueFixture("100"); const foreign = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { sourceInvoiceId: fixture.invoice.id, targetInvoiceId: foreign.invoice.id, amount: "1", reason: "Sai trường" })).rejects.toMatchObject({ status: 404, response: { code: "INVOICE_NOT_FOUND" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ status: "ISSUED", obligationTotalSnapshot: 100n });
    });
    it("rejects debt transfer target lifecycle, student/year graph, and coverage source without observable writes", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const targetRunId = outcomeId(await open(fixture.current, "2026-10"));
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, targetRunId); await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(fixture.current, targetRunId);
      const target = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: targetRunId } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.collectionRun.update({ where: { id: targetRunId }, data: { status: "CLOSED" } }); });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { sourceInvoiceId: fixture.invoice.id, targetInvoiceId: target.id, amount: "1", reason: "Run đóng" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_TARGET_CLOSED" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      const coverage = await coverageFixture(); await finance.issueInvoice(coverage.current.identity.id, coverage.current.school.id, coverage.invoice.id, uuid(), uuid(), { bankAccountId: coverage.bank.id });
      const coverageTargetRun = outcomeId(await open(coverage.current, "2026-10")); const coveragePreview = await finance.preview(coverage.current.identity.id, coverage.current.school.id, coverageTargetRun); await finance.readyRun(coverage.current.identity.id, coverage.current.school.id, coverageTargetRun, uuid(), uuid(), { previewFingerprint: coveragePreview.fingerprint }); await generate(coverage.current, coverageTargetRun);
      const coverageTarget = await prisma.invoice.findFirstOrThrow({ where: { schoolId: coverage.current.school.id, collectionRunId: coverageTargetRun } });
      await expect(finance.transferDebt(coverage.current.identity.id, coverage.current.school.id, uuid(), uuid(), { sourceInvoiceId: coverage.invoice.id, targetInvoiceId: coverageTarget.id, amount: "1", reason: "Coverage" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_COVERAGE_SOURCE_FORBIDDEN" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: coverage.current.school.id } })).toBe(0);
    });
    it("rejects same-School different-Student, different-SchoolYear, and closed-SchoolYear targets without source changes", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const targetRunId = outcomeId(await open(fixture.current, "2026-10"));
      const otherStudent = await enrolled(fixture.current);
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, targetRunId); await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(fixture.current, targetRunId);
      const ownTarget = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: targetRunId, studentId: fixture.student.student.id } });
      const otherTarget = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: targetRunId, studentId: otherStudent.student.id } });
      const body = { sourceInvoiceId: fixture.invoice.id, targetInvoiceId: otherTarget.id, amount: "1", reason: "Sai học sinh" };
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), body)).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_GRAPH_CONFLICT" } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.invoice.update({ where: { id: ownTarget.id }, data: { schoolYearId: crypto.randomUUID() } }); });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, targetInvoiceId: ownTarget.id, reason: "Sai năm học" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_GRAPH_CONFLICT" } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.invoice.update({ where: { id: ownTarget.id }, data: { schoolYearId: fixture.current.year.id } }); await tx.schoolYear.update({ where: { id: fixture.current.year.id }, data: { closedAt: new Date() } }); });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, targetInvoiceId: ownTarget.id, reason: "Năm học đã đóng" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_TARGET_CLOSED" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ status: "ISSUED", obligationTotalSnapshot: 100n });
    });
    it("does not auto-carry debt transfer or PRIOR_DEBT into a newly created SchoolYear", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const nextYear = await prisma.schoolYear.create({ data: { schoolId: fixture.current.school.id, name: "Năm học không carry", startsOn: date("2027-01-01"), endsOn: date("2028-01-01") } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.schoolYear.update({ where: { id: fixture.current.year.id }, data: { closedAt: new Date() } }); await tx.schoolYear.update({ where: { id: nextYear.id }, data: { closedAt: new Date() } }); });
      expect(await prisma.debtTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      expect(await prisma.invoiceLine.count({ where: { schoolId: fixture.current.school.id, kind: "PRIOR_DEBT" } })).toBe(0);
      expect(await prisma.invoice.findUniqueOrThrow({ where: { id: fixture.invoice.id } })).toMatchObject({ schoolYearId: fixture.current.year.id, status: "ISSUED" });
    });
    it("rejects direct reversal request bypass and aggregate cap without adding facts", async () => {
      const direct = await coverageFixture(); const coverage = await closeCoverage(direct);
      await expect(prisma.coverageReversalRequest.create({ data: { schoolId: direct.current.school.id, coverageId: coverage.id, amount: 1n, calculatedAmount: 1n, effectiveOn: date("2026-10-01"), reason: "Bypass", policyMode: "SCHOOL_ADMIN_APPROVAL", requestedByMembershipId: direct.current.membership.id } })).rejects.toThrow(/positive exact paid source snapshot/);
      await expect(prisma.coverageReversal.create({ data: { schoolId: direct.current.school.id, coverageId: coverage.id, amount: 91n, calculatedAmount: 91n, effectiveOn: date("2026-10-01"), reason: "Over cap" } })).rejects.toThrow(/exceeds/);
      expect(await prisma.coverageReversal.count({ where: { schoolId: direct.current.school.id } })).toBe(0);
    });
    it("projects immutable report cutoffs, four workspaces, export audit, expiry, tenant and revoked denial", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "90" });
      const events = await prisma.financeLedgerEvent.findMany({ where: { schoolId: fixture.current.school.id }, orderBy: { postedAt: "asc" } });
      expect(events.map((event) => event.type)).toEqual(expect.arrayContaining(["INVOICE_ISSUED", "RECEIPT_POSTED", "SETTLEMENT_DIFFERENCE_POSTED"]));
      expect(events.find((event) => event.type === "RECEIPT_POSTED")?.provenance).toMatchObject({ invoiceId: fixture.invoice.id, lines: expect.any(Array) });
      await expect(prisma.financeLedgerEvent.delete({ where: { id: events[0]!.id } })).rejects.toThrow(/append-only/);
      const beforeReceipt = new Date(events.find((event) => event.type === "RECEIPT_POSTED")!.postedAt.getTime() - 1);
      await expect(finance.report(fixture.current.identity.id, fixture.current.school.id, "overview", { asOf: beforeReceipt.toISOString(), schoolYearId: fixture.current.year.id })).resolves.toMatchObject({ reportDefinitionVersion: "FINANCE_LEDGER_V5", summary: { netBilled: "100", actualReceipt: "0" } });
      for (const workspace of ["overview", "collection-runs", "outstanding", "cash-adjustments"]) await expect(finance.report(fixture.current.identity.id, fixture.current.school.id, workspace, { billingMonth: "2026-09", className: fixture.current.activeClass.name })).resolves.toMatchObject({ workspace, timezone: "Asia/Ho_Chi_Minh" });
      const key = uuid(); const operationId = uuid(); const exported = await finance.requestReportExport(fixture.current.identity.id, fixture.current.school.id, "cash-adjustments", key, operationId, { billingMonth: "2026-09" });
      await expect(finance.requestReportExport(fixture.current.identity.id, fixture.current.school.id, "cash-adjustments", key, uuid(), { billingMonth: "2026-09" })).resolves.toEqual(exported);
      const exportOutcome = exported.outcome as { exportId: string };
      expect(await finance.operation(fixture.current.identity.id, fixture.current.school.id, operationId)).toMatchObject({ id: operationId, status: "COMPLETED", outcome: { exportId: exportOutcome.exportId } });
      expect(await prisma.financeReportExport.count({ where: { schoolId: fixture.current.school.id, operationId } })).toBe(1);
      const downloaded = await finance.downloadReportExport(fixture.current.identity.id, fixture.current.school.id, exportOutcome.exportId);
      expect(downloaded).toMatchObject({ workspace: "cash-adjustments" }); expect(Buffer.from(downloaded.csv).toString()).toContain("FINANCE_LEDGER_V5");
      expect(await prisma.auditRecord.count({ where: { schoolId: fixture.current.school.id, action: { in: ["FINANCE_REPORT_EXPORT_REQUESTED", "FINANCE_REPORT_EXPORT_DOWNLOADED"] } } })).toBe(2);
      const secondActor = await schoolAdmin(fixture.current);
      await expect(finance.downloadReportExport(secondActor.identity.id, fixture.current.school.id, exportOutcome.exportId)).resolves.toMatchObject({ workspace: "cash-adjustments" });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, action: "FINANCE_REPORT_EXPORT_DOWNLOADED", membershipId: secondActor.membership.id }, orderBy: { createdAt: "desc" } })).toMatchObject({ provenance: { exportId: exportOutcome.exportId, requestedByMembershipId: fixture.current.membership.id } });
      await prisma.financeReportExport.update({ where: { id: exportOutcome.exportId }, data: { expiresAt: new Date(0) } });
      await expect(finance.downloadReportExport(fixture.current.identity.id, fixture.current.school.id, exportOutcome.exportId)).rejects.toMatchObject({ status: 404 });
      const revokedExport = await finance.requestReportExport(fixture.current.identity.id, fixture.current.school.id, "overview", uuid(), uuid(), {});
      const revokedOutcome = revokedExport.outcome as { exportId: string };
      await prisma.financeReportExport.update({ where: { id: revokedOutcome.exportId }, data: { revokedAt: new Date() } });
      await expect(finance.downloadReportExport(fixture.current.identity.id, fixture.current.school.id, revokedOutcome.exportId)).rejects.toMatchObject({ status: 404 });
      const foreign = await graph();
      await expect(finance.report(foreign.identity.id, fixture.current.school.id, "overview", {})).rejects.toMatchObject({ status: 404 });
      await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: fixture.current.school.id, positionId: fixture.current.position.id, capability: "FINANCE_MANAGE" } });
      await expect(finance.report(fixture.current.identity.id, fixture.current.school.id, "overview", {})).rejects.toMatchObject({ status: 403 });
    });
    it("projects only matching immutable invoice lines for a group and marks whole-invoice cash unallocated", async () => {
      const fixture = await issueFixture("100");
      const primary = await prisma.receivable.findFirstOrThrow({ where: { id: fixture.receivableId, schoolId: fixture.current.school.id }, include: { group: true } });
      const secondaryGroupId = outcomeId(await group(fixture.current, "FIXED"));
      const secondaryReceivableId = outcomeId(await finance.createReceivable(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { groupId: secondaryGroupId, displayName: "Khoản phụ", unitLabel: "lần", defaultUnitPrice: "50" }));
      await finance.addInvoiceLine(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { receivableId: secondaryReceivableId, quantity: "1" });
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      await finance.closeInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { actualAmount: "150" });

      const overview = await finance.report(fixture.current.identity.id, fixture.current.school.id, "overview", { groupName: primary.group.name });
      expect(overview).toMatchObject({ filters: { groupName: primary.group.name }, summary: { gross: "100", netBilled: "100", actualReceipt: "0" } });
      expect(overview.rows).toEqual([expect.objectContaining({ grossAmount: "100", netAmount: "100" })]);

      const cash = await finance.report(fixture.current.identity.id, fixture.current.school.id, "cash-adjustments", { groupName: primary.group.name });
      expect(cash.summary.actualReceipt).toBe("0");
      expect(cash.rows).toEqual(expect.arrayContaining([expect.objectContaining({ type: "RECEIPT_POSTED", amount: "150", provenance: expect.objectContaining({ groupAllocation: "UNALLOCATED_WHOLE_INVOICE_EVENT" }) })]));
    });
  },
);
