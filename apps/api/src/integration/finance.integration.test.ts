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

async function group(
  input: Awaited<ReturnType<typeof graph>>,
  name = "Học phí",
) {
  return finance.createGroup(
    input.identity.id,
    input.school.id,
    uuid(),
    uuid(),
    { name },
  );
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
      const groupId = outcomeId(await group(input, `T${uuid().slice(0, 8)}`));
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
  await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
  const preview = await finance.preview(current.identity.id, current.school.id, runId);
  await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const generated = await generate(current, runId);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  expect(generated).toMatchObject({ status: "COMPLETED", outcome: expect.anything() });
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
  const operationId = uuid();
  await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
  const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng Ánh Hoa", accountNumber: "123456789", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  await prisma.bankAccountLifecycleTransition.create({ data: { schoolId: current.school.id, bankAccountId: bank.id, status: "ACTIVE", actorIdentityId: current.identity.id, membershipId: current.membership.id, operationId, sequence: 1 } });
  await prisma.financePolicy.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  return { current, student, receivableId, invoice, bank, operationId };
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
  options: { name: string; discountType: "FIXED_VND" | "PERCENTAGE"; discountValue: string; priority: string; stackingMode: "STACKABLE" | "EXCLUSIVE"; fulfillmentMode?: "DISCOUNT" | "PREPAID_COVERAGE" },
) {
  const created = await finance.createPromotionPolicy(input.identity.id, input.school.id, uuid(), uuid(), {
    ...options, receivableIds: [receivableId], effectiveFrom: "2026-09-01",
  });
  const versionId = (created.outcome as any).versions[0].id;
  await finance.activatePromotionVersion(input.identity.id, input.school.id, versionId, uuid(), uuid());
  await finance.assignPromotionStudents(input.identity.id, input.school.id, versionId, uuid(), uuid(), {
    studentIds: [studentId], effectiveFrom: "2026-09-01", reason: "Ưu đãi integration",
  });
  return versionId;
}

async function coverageFixture(reversalMode: "DIRECT" | "SCHOOL_ADMIN_APPROVAL" = "DIRECT") {
  const current = await roster(await graph());
  const student = await enrolled(current);
  await prisma.schoolCalendarVersion.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id } });
  const groupId = outcomeId(await group(current, "Coverage"));
  const coveredReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Học phí coverage", unitLabel: "tháng", defaultUnitPrice: "100" }));
  const otherReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Tiền ăn bình thường", unitLabel: "tháng", defaultUnitPrice: "25" }));
  const versionId = await promotion(current, student.student.id, coveredReceivableId, { name: "Nộp trước", discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "EXCLUSIVE", fulfillmentMode: "PREPAID_COVERAGE" });
  const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
  await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: coveredReceivableId, quantity: "1", expectedVersion: 1 });
  await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
  await finance.replaceCoverageSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { selections: [{ studentId: student.student.id, versionId, billingMonth: "2026-10" }] });
  const preview = await finance.preview(current.identity.id, current.school.id, runId);
  await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  const generated = await generate(current, runId);
  if (generated.status !== "COMPLETED") throw new Error(JSON.stringify(generated.outcome));
  const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId, studentId: student.student.id } });
  const operationId = uuid();
  await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
  const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng Ánh Hoa", accountNumber: "123456789", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
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
  return prisma.studentPromotionalCoverage.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, sourceInvoiceId: fixture.invoice.id } });
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
    await tx.collectionRunSelection.deleteMany({
      where: { schoolId: { in: ids } },
    });
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
        groups: [{ id: groupId, status: "ACTIVE" }],
        receivables: [
          { id: receivableId, available: true, defaultUnitPrice: "123456789" },
        ],
      });
    });

    it("creates only active same-School multi-target promotion policies and atomically assigns valid Students", async () => {
      const current = await roster(await graph()); const foreign = await roster(await graph());
      const activeGroupId = outcomeId(await group(current, "Ưu đãi"));
      const activeOne = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: activeGroupId, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100" }));
      const activeTwo = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: activeGroupId, displayName: "Tiền ăn", unitLabel: "tháng", defaultUnitPrice: "50" }));
      const inactiveGroupId = outcomeId(await group(current, "Ngừng"));
      const inactiveReceivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId: inactiveGroupId, displayName: "Xe đưa đón", unitLabel: "tháng", defaultUnitPrice: "20" }));
      await finance.transitionReceivable(current.identity.id, current.school.id, inactiveReceivableId, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng" });
      const foreignGroupId = outcomeId(await group(foreign)); const foreignReceivableId = outcomeId(await finance.createReceivable(foreign.identity.id, foreign.school.id, uuid(), uuid(), { groupId: foreignGroupId, displayName: "Ngoại trường", unitLabel: "tháng", defaultUnitPrice: "10" }));
      const policyInput = { name: "Con cán bộ", receivableIds: [activeOne, activeTwo], discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE", effectiveFrom: "2026-09-01" };
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { ...policyInput, receivableIds: [activeOne, inactiveReceivableId] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
      await finance.transitionGroup(current.identity.id, current.school.id, inactiveGroupId, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng nhóm" });
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { ...policyInput, receivableIds: [activeOne, inactiveReceivableId] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, uuid(), uuid(), { ...policyInput, receivableIds: [activeOne, foreignReceivableId] })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableIds: expect.any(String) } } });
      const key = uuid(); const operationId = uuid(); const created = await finance.createPromotionPolicy(current.identity.id, current.school.id, key, operationId, policyInput);
      const versionId = ((created.outcome as any).versions[0]).id;
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, key, uuid(), policyInput)).resolves.toEqual(created);
      await expect(finance.createPromotionPolicy(current.identity.id, current.school.id, key, uuid(), { ...policyInput, discountValue: "11" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
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
      const groupId = outcomeId(await group(current, "Evaluator"));
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
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const groupId = outcomeId(await group(current, "Promotion stale"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Stale 1", discountType: "FIXED_VND", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current));
      const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const groupId = outcomeId(await group(current, "Staged promotion"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Staged", discountType: "FIXED_VND", discountValue: "25", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current));
      const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const groupId = outcomeId(await group(current, "Tie break"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      await promotion(current, student.student.id, receivableId, { name: "Tie A", discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      await promotion(current, student.student.id, receivableId, { name: "Tie B", discountType: "PERCENTAGE", discountValue: "10", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      const policyIds = preview.eligible[0]!.lines[0]!.promotionEvaluation.applications.map((item: any) => item.policyId);
      expect(policyIds).toEqual([...policyIds].sort());
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      const persisted = ((await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, receivableId } })).promotionEvaluationProvenance as any).applications.map((item: any) => item.policyId);
      expect(persisted).toEqual(policyIds);
    });

    it("closes a generated run whose DRAFT invoices are all zero-net", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current, "Zero net"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      await promotion(current, student.student.id, receivableId, { name: "Miễn toàn bộ", discountType: "FIXED_VND", discountValue: "100", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId); await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      expect(await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } })).toMatchObject({ status: "DRAFT", total: 0n });
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { reason: "Không còn nghĩa vụ" })).resolves.toMatchObject({ outcome: { status: "CLOSED" } });
    });

    it("serializes School-scoped promotion mutation and READY evaluation with the same transaction advisory lock", async () => {
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current, "Promotion lock"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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

    it("retains inactive catalog history while making it unavailable and rejecting new selection", async () => {
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
          code: "ACTIVITY",
          displayName: "Ngoại khóa",
          unitLabel: "tháng",
          defaultUnitPrice: "50000",
        },
      );
      const receivableId = (created.outcome as { id: string }).id;
      await finance.transitionGroup(
        current.identity.id,
        current.school.id,
        groupId,
        uuid(),
        uuid(),
        { status: "INACTIVE", reason: "Ngừng áp dụng" },
      );

      await expect(
        finance.read(current.identity.id, current.school.id),
      ).resolves.toMatchObject({
        groups: [{ id: groupId, status: "INACTIVE" }],
        receivables: [{ id: receivableId, status: "ACTIVE", available: false }],
      });
      await expect(
        finance.createReceivable(
          current.identity.id,
          current.school.id,
          uuid(),
          uuid(),
          {
            groupId,
            code: "NEW",
            displayName: "Không được chọn",
            unitLabel: "lần",
            defaultUnitPrice: "1",
          },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { groupId: expect.any(String) } },
      });
      expect(
        await prisma.receivableGroupLifecycleTransition.count({
          where: { schoolId: current.school.id, receivableGroupId: groupId },
        }),
      ).toBe(2);
    });

    it("replays same-key outcomes, rejects changed fingerprints, and re-authorizes revoked access", async () => {
      const current = await graph();
      const key = uuid();
      const operationId = uuid();
      const body = { name: "Dịch vụ" };
      const first = await finance.createGroup(
        current.identity.id,
        current.school.id,
        key,
        operationId,
        body,
      );
      expect(
        await finance.createGroup(
          current.identity.id,
          current.school.id,
          key,
          uuid(),
          body,
        ),
      ).toEqual(first);
      expect(
        await prisma.receivableGroup.count({
          where: { schoolId: current.school.id },
        }),
      ).toBe(1);
      await expect(
        finance.createGroup(
          current.identity.id,
          current.school.id,
          key,
          uuid(),
          { name: "Khác" },
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
        finance.createGroup(
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

    it("canonicalizes selected IDs and replays only an identical selection command and Operation", async () => {
      const current = await roster(await graph());
      const firstStudent = await enrolled(current);
      const secondStudent = await enrolled(current);
      const runId = outcomeId(await open(current));
      const key = uuid();
      const operationId = uuid();
      const body = {
        studentIds: [
          secondStudent.student.id,
          firstStudent.student.id,
          secondStudent.student.id,
        ],
      };
      const saved = await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        key,
        operationId,
        body,
      );
      expect(saved).toMatchObject({
        status: "COMPLETED",
        outcome: {
          id: runId,
          version: 2,
          selectedStudentIds: [
            firstStudent.student.id,
            secondStudent.student.id,
          ].sort(),
        },
      });
      expect(
        await finance.replaceSelection(
          current.identity.id,
          current.school.id,
          runId,
          key,
          uuid(),
          { studentIds: [firstStudent.student.id, secondStudent.student.id] },
        ),
      ).toEqual(saved);
      await expect(
        finance.replaceSelection(
          current.identity.id,
          current.school.id,
          runId,
          key,
          uuid(),
          { studentIds: [firstStudent.student.id] },
        ),
      ).rejects.toMatchObject({
        status: 409,
        response: { code: "IDEMPOTENCY_CONFLICT" },
      });
      expect(
        await prisma.collectionRunSelection.count({
          where: { schoolId: current.school.id, collectionRunId: runId },
        }),
      ).toBe(2);
      expect(
        await prisma.auditRecord.count({
          where: {
            schoolId: current.school.id,
            action: "COLLECTION_RUN_SELECTION_REPLACED",
          },
        }),
      ).toBe(1);
      await expect(
        finance.replaceSelection(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { studentIds: [uuid()] },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { studentIds: expect.any(String) } },
      });
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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        {
          studentIds: [
            eligible.student.id,
            trial.student.id,
            missingAssignment.student.id,
            futureAssignment.student.id,
            archived.student.id,
            ended.student.id,
          ],
        },
      );

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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: [student.student.id] },
      );
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
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      await expect(
        finance.replaceSelection(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { studentIds: [foreign.school.id] },
        ),
      ).rejects.toMatchObject({
        status: 400,
        response: { fieldErrors: { studentIds: expect.any(String) } },
      });
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: [student.student.id] },
      );
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
        outcome: { id: runId, status: "READY", version: 3 },
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
        finance.replaceSelection(
          current.identity.id,
          current.school.id,
          runId,
          uuid(),
          uuid(),
          { studentIds: [student.student.id] },
        ),
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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: [eligible.student.id, skipped.student.id] },
      );
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
        policy: "COLLECTION_RUN_SELECTION_V1",
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

    it("snapshots daily meal template facts, rejects invalid template input, and uses the snapshot for a late Student", async () => {
      const current = await roster(await graph()); const foreign = await roster(await graph());
      const first = await enrolled(current); const later = await enrolled(current);
      const runId = outcomeId(await finance.openRun(current.identity.id, current.school.id, uuid(), uuid(), { schoolYearId: current.year.id, billingMonth: "2026-09" }));
      const groupId = outcomeId(await group(current, "Bữa ăn"));
      const mealId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: "MEAL", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000" }));
      const key = uuid(); const operationId = uuid();
      const saved = await finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, operationId, { receivableId: mealId, quantity: "22", expectedVersion: 1 });
      expect(saved.outcome).toMatchObject({ templateLines: [{ receivableId: mealId, unitLabel: "ngày", defaultUnitPrice: "35000", quantity: "22", amount: "770000" }] });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, key, uuid(), { receivableId: mealId, quantity: "21", expectedVersion: 1 })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "0", expectedVersion: 2 })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: foreign.school.id, quantity: "1", expectedVersion: 2 })).rejects.toMatchObject({ status: 400 });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "1", expectedVersion: 1 })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_VERSION_CONFLICT" } });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [first.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await expect(finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId: mealId, quantity: "1", expectedVersion: 3 })).rejects.toMatchObject({ status: 409 });
      await generate(current, runId);
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
      const groupId = outcomeId(await group(current, "Khoản thu mẫu"));
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
      const student = await enrolled(current);
      const groupId = outcomeId(await group(current, "Catalog READY"));
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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: [student.student.id] },
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
      const student = await enrolled(current);
      const groupId = outcomeId(await group(current, "Lifecycle READY"));
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
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), {
        studentIds: [student.student.id],
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

    it("invalidates a DRAFT preview when an owning ReceivableGroup lifecycle changes", async () => {
      const current = await roster(await graph());
      const groupId = outcomeId(await group(current, "Nhóm khoản thu mẫu"));
      const receivableId = outcomeId(await finance.createReceivable(
        current.identity.id,
        current.school.id,
        uuid(),
        uuid(),
        {
          groupId,
          code: "GROUP_LIFECYCLE",
          displayName: "Khoản thu theo nhóm",
          unitLabel: "lần",
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
        { receivableId, quantity: "1", expectedVersion: 1 },
      );
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.transitionGroup(
        current.identity.id,
        current.school.id,
        groupId,
        uuid(),
        uuid(),
        { status: "INACTIVE", reason: "Ngừng nhóm khoản thu" },
      );
      await expect(finance.readyRun(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { previewFingerprint: preview.fingerprint },
      )).rejects.toMatchObject({
        status: 409,
        response: { code: "PREVIEW_STALE" },
      });
      expect((await finance.run(current.identity.id, current.school.id, runId)).status).toBe("DRAFT");
    });

    it("returns template lines by descending server-calculated amount with an ID tie-breaker", async () => {
      const current = await roster(await graph());
      const groupId = outcomeId(await group(current, "Thứ tự template"));
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
      const student = await enrolled(current);
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [existing.student.id, remaining.student.id] });
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
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const student = await enrolled(current);
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const addedStudent = await enrolled(current);
      const invalidStudent = await enrolled(current, { lifecycle: "TRIAL" });
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [generatedStudent.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const original = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, studentId: generatedStudent.student.id, collectionRunId: runId } });
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
      await expect(prisma.collectionRunSelection.create({ data: { schoolId: current.school.id, collectionRunId: runId, studentId: addedStudent.student.id } })).rejects.toThrow(/immutable/);
    });

    it("serializes concurrent generated-student commands to one Invoice and one created outcome", async () => {
      const current = await roster(await graph());
      const first = await enrolled(current);
      const later = await enrolled(current);
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [first.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
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
      const first = await enrolled(current);
      const later = await enrolled(current);
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [first.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: students.map((student) => student.id) },
      );
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
      await finance.replaceSelection(
        current.identity.id,
        current.school.id,
        runId,
        uuid(),
        uuid(),
        { studentIds: students.map((student) => student.id) },
      );
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
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const current = await roster(await graph()); const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const catalog = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Tiền ăn", unitLabel: "tháng", defaultUnitPrice: "100" });
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
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
      const otherBank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "Ngân hàng B", accountNumber: "987", accountHolderName: "Ánh Hoa", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
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
      expect(Object.keys(first.invoices[0]!).sort()).toEqual(["billingMonth", "class", "id", "issuedAt", "outstanding", "schoolYearId", "status", "student"]);
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
        expect(Object.keys(body.data.invoices[0]!).sort()).toEqual(["billingMonth", "class", "id", "issuedAt", "outstanding", "schoolYearId", "status", "student"]);
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
      const groupId = outcomeId(await group(current, "Issue promotion"));
      const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Khoản", unitLabel: "lần", defaultUnitPrice: "100" }));
      const versionId = await promotion(current, student.student.id, receivableId, { name: "Issue snapshot", discountType: "FIXED_VND", discountValue: "25", priority: "1", stackingMode: "STACKABLE" });
      const runId = outcomeId(await open(current)); const template = await finance.run(current.identity.id, current.school.id, runId);
      await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
      await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(current, runId);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
      const operationId = uuid(); await prisma.operation.create({ data: { id: operationId, schoolId: current.school.id, membershipId: current.membership.id, actorIdentityId: current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: current.membership.id, route: "fixture", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
      const bank = await prisma.bankAccount.create({ data: { schoolId: current.school.id, receivingBank: "A", accountNumber: "1", accountHolderName: "A", transferTemplate: "{{studentName}} {{className}}", actorIdentityId: current.identity.id, membershipId: current.membership.id } });
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
      const student = await enrolled(current);
      const readyId = outcomeId(await open(current, "2026-10"));
      await finance.replaceSelection(current.identity.id, current.school.id, readyId, uuid(), uuid(), { studentIds: [student.student.id] });
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
        await tx.invoice.update({ where: { id: issued.id }, data: { status: "DRAFT", issuedAt: null, bankAccountIdSnapshot: null, receivingBankSnapshot: null, accountNumberSnapshot: null, accountHolderNameSnapshot: null, transferContentSnapshot: null, obligationLinesSnapshot: Prisma.DbNull, obligationTotalSnapshot: null, financePolicyEffectiveFrom: null, dueDaysAfterIssueSnapshot: null, taxTreatmentSnapshot: null, debtScopeSnapshot: null, reversalModeSnapshot: null, dueOn: null } });
      });
      await expect(prisma.invoice.update({ where: { id: issued.id }, data: { status: "ISSUED", issuedAt: issued.issuedAt!, bankAccountIdSnapshot: issued.bankAccountIdSnapshot!, receivingBankSnapshot: issued.receivingBankSnapshot!, accountNumberSnapshot: issued.accountNumberSnapshot!, accountHolderNameSnapshot: issued.accountHolderNameSnapshot!, transferContentSnapshot: issued.transferContentSnapshot!, obligationLinesSnapshot: issued.obligationLinesSnapshot as Prisma.InputJsonValue, obligationTotalSnapshot: issued.obligationTotalSnapshot!, financePolicyEffectiveFrom: issued.financePolicyEffectiveFrom!, dueDaysAfterIssueSnapshot: issued.dueDaysAfterIssueSnapshot!, taxTreatmentSnapshot: issued.taxTreatmentSnapshot!, debtScopeSnapshot: issued.debtScopeSnapshot!, reversalModeSnapshot: issued.reversalModeSnapshot!, dueOn: issued.dueOn! } })).rejects.toThrow(/CLOSED CollectionRun/);
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

    it("rejects direct DRAFT snapshot injection and incomplete or incoherent DRAFT-to-ISSUED mutation", async () => {
      const { invoice, bank } = await issueFixture();
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { bankAccountIdSnapshot: bank.id } })).rejects.toThrow(/Draft invoice cannot contain issue snapshots/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: new Date(), bankAccountIdSnapshot: bank.id, receivingBankSnapshot: "Bank", accountNumberSnapshot: "1", accountHolderNameSnapshot: "Holder", transferContentSnapshot: "Content", obligationLinesSnapshot: [], obligationTotalSnapshot: 1n, financePolicyEffectiveFrom: date("2026-01-01"), dueDaysAfterIssueSnapshot: 1, taxTreatmentSnapshot: "NOT_APPLICABLE", debtScopeSnapshot: "CURRENT_SCHOOL_YEAR_ONLY", reversalModeSnapshot: "DIRECT", dueOn: date("2026-01-02") } })).rejects.toThrow(/internally inconsistent/);
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
      await finance.replaceSelection(shortfall.current.identity.id, shortfall.current.school.id, nextRunId, uuid(), uuid(), { studentIds: [shortfall.student.student.id] });
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

    it("snapshots selected prepaid coverage facts with immutable future provenance before the DRAFT Invoice is exposed", async () => {
      const fixture = await coverageFixture();
      const fact = await prisma.invoicePromotionCoverageFact.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      expect(fact).toMatchObject({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-10", versionId: fixture.versionId, originalPrice: 100n, reduction: 10n, serviceStart: date("2026-10-01"), serviceEnd: date("2026-11-01"), calendarEffectiveFrom: date("2026-01-01"), timezone: "Asia/Ho_Chi_Minh" });
      expect(await prisma.studentPromotionalCoverage.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      await expect(prisma.invoicePromotionCoverageFact.update({ where: { id: fact.id }, data: { billingMonth: "2026-11" } })).rejects.toThrow(/append-only/);
      await expect(prisma.collectionRunCoverageSelection.create({ data: { schoolId: fixture.current.school.id, collectionRunId: fixture.runId, studentId: fixture.student.student.id, versionId: fixture.versionId, billingMonth: "2026-11" } })).rejects.toThrow(/DRAFT/);
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
      expect(closed).toMatchObject({ id: operationId, outcome: { status: "CLOSED", receipt: { actualAmount: issued.obligationTotalSnapshot!.toString(), outcome: "EXACT", difference: null }, coverageFacts: [expect.objectContaining({ billingMonth: "2026-10", issuedAt: expect.any(String) })] } });
      const receipt = await prisma.receipt.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, invoiceId: fixture.invoice.id } });
      const coverage = await prisma.studentPromotionalCoverage.findFirstOrThrow({ where: { schoolId: fixture.current.school.id } });
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
      expect(await prisma.studentPromotionalCoverage.count({ where: { schoolId: fixture.current.school.id, sourceInvoiceId: fixture.invoice.id } })).toBe(1);
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
      expect(await prisma.studentPromotionalCoverage.findMany({ where: { schoolId: fixture.current.school.id } })).toEqual([expect.objectContaining({ studentId: fixture.student.student.id, schoolYearId: fixture.current.year.id, receivableId: fixture.coveredReceivableId, billingMonth: "2026-10" })]);
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
      await finance.replaceSelection(fixture.current.identity.id, fixture.current.school.id, nextRunId, uuid(), uuid(), { studentIds: [fixture.student.student.id] });
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, nextRunId);
      expect(preview.eligible[0]!.lines).toEqual([expect.objectContaining({ receivableId: fixture.otherReceivableId, grossAmount: "25", netAmount: "25" })]);
      await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, nextRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(fixture.current, nextRunId);
      const nextInvoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: nextRunId }, include: { lines: true } });
      expect(nextInvoice.lines).toEqual([expect.objectContaining({ receivableId: fixture.otherReceivableId, amount: 25n })]);
    });

    it("calculates reversal only from the coverage calendar snapshot with excluded effective day and floor VND", async () => {
      const fixture = await coverageFixture();
      const eligibilityOperationId = uuid();
      await prisma.operation.create({ data: { id: eligibilityOperationId, schoolId: fixture.current.school.id, membershipId: fixture.current.membership.id, actorIdentityId: fixture.current.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: fixture.current.membership.id, route: "fixture-eligibility-calendar", fingerprint: "fixture", idempotencyKey: uuid(), status: "COMPLETED" } });
      await prisma.coverageRefundEligibility.create({ data: { schoolId: fixture.current.school.id, studentId: fixture.student.student.id, reason: "TRANSFER_OUT", effectiveOn: date("2026-10-10"), actorIdentityId: fixture.current.identity.id, membershipId: fixture.current.membership.id, operationId: eligibilityOperationId } });
      await prisma.schoolCalendarHoliday.create({ data: { schoolId: fixture.current.school.id, calendarVersionId: (await prisma.schoolCalendarVersion.findFirstOrThrow({ where: { schoolId: fixture.current.school.id } })).id, name: "Nghỉ", startsOn: date("2026-10-05"), endsOn: date("2026-10-05") } });
      const coverage = await closeCoverage(fixture);
      const preview = await finance.previewCoverageReversal(fixture.current.identity.id, fixture.current.school.id, { coverageId: coverage.id, effectiveOn: "2026-10-10" });
       expect(preview).toMatchObject({ denominator: 26, remainingDays: 18, calculatedAmount: "62", availableAmount: "90", source: { invoiceId: fixture.invoice.id, receiptId: coverage.sourceReceiptId, timezone: "Asia/Ho_Chi_Minh", eligibility: { reason: "TRANSFER_OUT", effectiveOn: "2026-10-10" } } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.studentPromotionalCoverage.update({ where: { id: coverage.id }, data: { serviceStart: date("2026-10-04"), serviceEnd: date("2026-10-05") } }); });
       await expect(finance.previewCoverageReversal(fixture.current.identity.id, fixture.current.school.id, { coverageId: coverage.id, effectiveOn: "2026-10-04" })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_REFUND_ELIGIBILITY_REQUIRED" } });
    });

    it("caps direct reversal under replay and concurrent posts", async () => {
      const fixture = await coverageFixture(); const coverage = await closeCoverage(fixture);
      const key = uuid(); const first = await finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, key, uuid(), { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Rút học", amount: "50", confirmation: fixture.student.student.fullName });
      await expect(finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, key, uuid(), { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Rút học", amount: "50", confirmation: fixture.student.student.fullName })).resolves.toEqual(first);
      const attempts = await Promise.allSettled([finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Còn lại", amount: "40", confirmation: fixture.student.student.fullName }), finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Vượt", amount: "41", confirmation: fixture.student.student.fullName })]);
      expect(attempts.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      expect(await prisma.coverageReversal.aggregate({ where: { schoolId: fixture.current.school.id, coverageId: coverage.id }, _sum: { amount: true } })).toMatchObject({ _sum: { amount: 90n } });
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

    it("requires a distinct School Admin to approve or refuse reversal requests", async () => {
      const fixture = await coverageFixture("SCHOOL_ADMIN_APPROVAL"); const coverage = await closeCoverage(fixture); const body = { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Rút học", amount: "10" };
      const requested = await finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), body);
      const requestId = (requested.outcome as any).id;
      await expect(finance.decideCoverageReversal(fixture.current.identity.id, fixture.current.school.id, requestId, uuid(), uuid(), { decision: "APPROVE", reason: "Tự duyệt" })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_REVERSAL_DECISION_DENIED" } });
      const admin = await schoolAdmin(fixture.current);
      await expect(finance.decideCoverageReversal(admin.identity.id, fixture.current.school.id, requestId, uuid(), uuid(), { decision: "APPROVE", reason: "Duyệt" })).resolves.toMatchObject({ outcome: { status: "POSTED", requestId } });
      const refused = await finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { ...body, amount: "1", reason: "Không còn dùng" });
      await expect(finance.decideCoverageReversal(admin.identity.id, fixture.current.school.id, (refused.outcome as any).id, uuid(), uuid(), { decision: "REFUSE", reason: "Thiếu chứng từ" })).resolves.toMatchObject({ outcome: { status: "REFUSED" } });
    });

    it("rejects cross-School reversal graph and preserves append-only reversal records", async () => {
      const fixture = await coverageFixture(); const coverage = await closeCoverage(fixture); const foreign = await coverageFixture(); const foreignCoverage = await closeCoverage(foreign);
      await expect(prisma.coverageReversal.create({ data: { schoolId: fixture.current.school.id, coverageId: foreignCoverage.id, amount: 1n, calculatedAmount: 1n, effectiveOn: date("2026-10-01"), reason: "Cross school" } })).rejects.toThrow();
      const posted = await finance.createCoverageReversal(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { coverageId: coverage.id, effectiveOn: "2026-10-01", reason: "Hoàn", amount: "1", confirmation: fixture.student.student.fullName });
      await expect(prisma.coverageReversal.update({ where: { id: (posted.outcome as any).id }, data: { amount: 0n } })).rejects.toThrow(/append-only/);
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
      await finance.replaceSelection(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { studentIds: [fixture.student.student.id] });
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
      await finance.replaceSelection(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { studentIds: [fixture.student.student.id] });
      const preview = await finance.preview(fixture.current.identity.id, fixture.current.school.id, targetRunId); await finance.readyRun(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { previewFingerprint: preview.fingerprint }); await generate(fixture.current, targetRunId);
      const target = await prisma.invoice.findFirstOrThrow({ where: { schoolId: fixture.current.school.id, collectionRunId: targetRunId } });
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.collectionRun.update({ where: { id: targetRunId }, data: { status: "CLOSED" } }); });
      await expect(finance.transferDebt(fixture.current.identity.id, fixture.current.school.id, uuid(), uuid(), { sourceInvoiceId: fixture.invoice.id, targetInvoiceId: target.id, amount: "1", reason: "Run đóng" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_TARGET_CLOSED" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: fixture.current.school.id } })).toBe(0);
      const coverage = await coverageFixture(); await finance.issueInvoice(coverage.current.identity.id, coverage.current.school.id, coverage.invoice.id, uuid(), uuid(), { bankAccountId: coverage.bank.id });
      const coverageTargetRun = outcomeId(await open(coverage.current, "2026-10")); await finance.replaceSelection(coverage.current.identity.id, coverage.current.school.id, coverageTargetRun, uuid(), uuid(), { studentIds: [coverage.student.student.id] }); const coveragePreview = await finance.preview(coverage.current.identity.id, coverage.current.school.id, coverageTargetRun); await finance.readyRun(coverage.current.identity.id, coverage.current.school.id, coverageTargetRun, uuid(), uuid(), { previewFingerprint: coveragePreview.fingerprint }); await generate(coverage.current, coverageTargetRun);
      const coverageTarget = await prisma.invoice.findFirstOrThrow({ where: { schoolId: coverage.current.school.id, collectionRunId: coverageTargetRun } });
      await expect(finance.transferDebt(coverage.current.identity.id, coverage.current.school.id, uuid(), uuid(), { sourceInvoiceId: coverage.invoice.id, targetInvoiceId: coverageTarget.id, amount: "1", reason: "Coverage" })).rejects.toMatchObject({ status: 409, response: { code: "DEBT_TRANSFER_COVERAGE_SOURCE_FORBIDDEN" } });
      expect(await prisma.debtTransfer.count({ where: { schoolId: coverage.current.school.id } })).toBe(0);
    });
    it("rejects same-School different-Student, different-SchoolYear, and closed-SchoolYear targets without source changes", async () => {
      const fixture = await issueFixture("100");
      await finance.issueInvoice(fixture.current.identity.id, fixture.current.school.id, fixture.invoice.id, uuid(), uuid(), { bankAccountId: fixture.bank.id });
      const targetRunId = outcomeId(await open(fixture.current, "2026-10"));
      const otherStudent = await enrolled(fixture.current);
      await finance.replaceSelection(fixture.current.identity.id, fixture.current.school.id, targetRunId, uuid(), uuid(), { studentIds: [fixture.student.student.id, otherStudent.student.id] });
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
    it("rejects corrupted reversal source provenance before preview", async () => {
      const fixture = await coverageFixture(); const coverage = await closeCoverage(fixture);
      await prisma.$transaction(async (tx) => { await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica"); await tx.receipt.update({ where: { id: coverage.sourceReceiptId }, data: { outcome: "SHORTFALL" } }); });
      await expect(finance.previewCoverageReversal(fixture.current.identity.id, fixture.current.school.id, { coverageId: coverage.id, effectiveOn: "2026-10-10" })).rejects.toMatchObject({ status: 409, response: { code: "COVERAGE_SOURCE_INVALID" } });
    });
    it("rejects direct reversal request bypass, aggregate cap, and request deletion without adding facts", async () => {
      const direct = await coverageFixture(); const coverage = await closeCoverage(direct);
      await expect(prisma.coverageReversalRequest.create({ data: { schoolId: direct.current.school.id, coverageId: coverage.id, amount: 1n, calculatedAmount: 1n, effectiveOn: date("2026-10-01"), reason: "Bypass", policyMode: "SCHOOL_ADMIN_APPROVAL", requestedByMembershipId: direct.current.membership.id } })).rejects.toThrow(/positive exact paid source snapshot/);
      await expect(prisma.coverageReversal.create({ data: { schoolId: direct.current.school.id, coverageId: coverage.id, amount: 91n, calculatedAmount: 91n, effectiveOn: date("2026-10-01"), reason: "Over cap" } })).rejects.toThrow(/exceeds/);
      expect(await prisma.coverageReversal.count({ where: { schoolId: direct.current.school.id } })).toBe(0);
      const approval = await coverageFixture("SCHOOL_ADMIN_APPROVAL"); const approvalCoverage = await closeCoverage(approval); const requested = await finance.createCoverageReversal(approval.current.identity.id, approval.current.school.id, uuid(), uuid(), { coverageId: approvalCoverage.id, effectiveOn: "2026-10-01", reason: "Chờ duyệt", amount: "1" });
      await expect(prisma.coverageReversalRequest.delete({ where: { id: (requested.outcome as any).id } })).rejects.toThrow(/append-only/);
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
      await expect(finance.report(fixture.current.identity.id, fixture.current.school.id, "overview", { asOf: beforeReceipt.toISOString(), schoolYearId: fixture.current.year.id })).resolves.toMatchObject({ reportDefinitionVersion: "FINANCE_LEDGER_V3", summary: { netBilled: "100", actualReceipt: "0" } });
      for (const workspace of ["overview", "collection-runs", "outstanding", "cash-adjustments"]) await expect(finance.report(fixture.current.identity.id, fixture.current.school.id, workspace, { billingMonth: "2026-09", className: fixture.current.activeClass.name })).resolves.toMatchObject({ workspace, timezone: "Asia/Ho_Chi_Minh" });
      const key = uuid(); const operationId = uuid(); const exported = await finance.requestReportExport(fixture.current.identity.id, fixture.current.school.id, "cash-adjustments", key, operationId, { billingMonth: "2026-09" });
      await expect(finance.requestReportExport(fixture.current.identity.id, fixture.current.school.id, "cash-adjustments", key, uuid(), { billingMonth: "2026-09" })).resolves.toEqual(exported);
      const exportOutcome = exported.outcome as { exportId: string };
      expect(await finance.operation(fixture.current.identity.id, fixture.current.school.id, operationId)).toMatchObject({ id: operationId, status: "COMPLETED", outcome: { exportId: exportOutcome.exportId } });
      expect(await prisma.financeReportExport.count({ where: { schoolId: fixture.current.school.id, operationId } })).toBe(1);
      const downloaded = await finance.downloadReportExport(fixture.current.identity.id, fixture.current.school.id, exportOutcome.exportId);
      expect(downloaded).toMatchObject({ workspace: "cash-adjustments" }); expect(Buffer.from(downloaded.csv).toString()).toContain("FINANCE_LEDGER_V3");
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
      const secondaryGroupId = outcomeId(await group(fixture.current, "Nhóm phụ"));
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
