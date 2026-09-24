import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";
import { RosterService } from "../modules/roster/roster.service.js";

const prisma = new PrismaService();
const authorization = new AuthorizationService(prisma);
const finance = new FinanceService(prisma, authorization);
const rosterService = new RosterService(prisma, authorization);
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);

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

async function issueFixture() {
  const current = await roster(await graph());
  const student = await enrolled(current);
  const groupId = outcomeId(await group(current));
  const receivableId = outcomeId(await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "9007199254740991" }));
  const runId = outcomeId(await open(current));
  const template = await finance.run(current.identity.id, current.school.id, runId);
  await finance.removeTemplateLine(current.identity.id, current.school.id, runId, template.templateLines[0]!.id, uuid(), uuid(), { expectedVersion: template.version });
  await finance.saveTemplateLine(current.identity.id, current.school.id, runId, uuid(), uuid(), { receivableId, quantity: "1", expectedVersion: template.version + 1 });
  await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
  const preview = await finance.preview(current.identity.id, current.school.id, runId);
  await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
  await generate(current, runId);
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

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunGenerationItem.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunGeneration.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.invoiceLine.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.invoice.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.collectionRunTemplateLine.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.bankAccountLifecycleTransition.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.bankAccount.deleteMany({ where: { schoolId: { in: ids } } });
    await tx.financePolicy.deleteMany({ where: { schoolId: { in: ids } } });
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

    it("uses the generate-time roster once, skips a Student changed after READY, and persists no stale snapshot", async () => {
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

      const generated = await generate(current, runId);
      expect(generated.outcome).toMatchObject({
        created: [],
        skipped: [{ studentId: student.student.id, studentCode: student.student.studentCode, fullName: student.student.fullName, reason: "ENROLLMENT_NOT_EFFECTIVE" }],
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

    it("generates 1,000 empty DRAFT invoices within sixty seconds without duplicates", async () => {
      const current = await roster(await graph());
      const students = Array.from({ length: 1000 }, () => ({
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
      expect(queued).toMatchObject({ status: "PENDING", outcome: null, progress: { total: 1000, processed: 0, eligible: 0, skipped: 0 } });
      await finance.processNextGeneration();
      const progress = await finance.operation(current.identity.id, current.school.id, queued.id);
      expect(progress).toMatchObject({ status: "PENDING", progress: { status: "RUNNING", processed: 50, eligible: 50, skipped: 0 } });
      while ((await finance.operation(current.identity.id, current.school.id, queued.id)).status === "PENDING") await finance.processNextGeneration();
      const generated = await finance.operation(current.identity.id, current.school.id, queued.id);
      expect(performance.now() - started).toBeLessThanOrEqual(60000);
      expect(
        (generated.outcome as { created: unknown[] }).created,
      ).toHaveLength(1000);
      expect(
        await prisma.invoice.count({
          where: { schoolId: current.school.id, collectionRunId: runId },
        }),
      ).toBe(1000);
    }, 70000);

    it("persists, audits, replays, edits and removes authoritative DRAFT lines without leaking tenants", async () => {
      const current = await roster(await graph());
      const foreign = await roster(await graph());
      await prisma.schoolCalendarVersion.create({ data: { schoolId: current.school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: current.identity.id, membershipId: current.membership.id } });
      const student = await enrolled(current);
      const groupId = outcomeId(await group(current));
      const receivable = await finance.createReceivable(current.identity.id, current.school.id, uuid(), uuid(), { groupId, code: "TUITION", displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100000" });
      const receivableId = outcomeId(receivable);
      const runId = outcomeId(await open(current));
      await finance.replaceSelection(current.identity.id, current.school.id, runId, uuid(), uuid(), { studentIds: [student.student.id] });
      const preview = await finance.preview(current.identity.id, current.school.id, runId);
      await finance.readyRun(current.identity.id, current.school.id, runId, uuid(), uuid(), { previewFingerprint: preview.fingerprint });
      await generate(current, runId);
      const invoice = await prisma.invoice.findFirstOrThrow({ where: { schoolId: current.school.id, collectionRunId: runId } });
      const key = uuid(); const operationId = uuid();
      const body = { receivableId, quantity: "2", unitPrice: "120000", overrideReason: "Điều chỉnh học phí", source: { serviceDate: "2026-09-01", attendanceState: "PRESENT", pickedUpAt: "17:30", lateCareMinutes: 30 }, sourceReason: "Nhập tay từ bảng theo dõi" };
      const added = await finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, operationId, body);
      expect(added).toMatchObject({ id: operationId, outcome: { total: "240001", lines: expect.arrayContaining([expect.objectContaining({ quantity: "2", unitPrice: "120000", amount: "240000", sourceReason: body.sourceReason })]) } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, uuid(), body)).resolves.toEqual(added);
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, key, uuid(), { ...body, quantity: "3" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "2147483647", unitPrice: "9007199254740991", overrideReason: "Vượt giới hạn" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { quantity: expect.any(String) } } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1", source: { attendanceState: "ABSENT", pickedUpAt: "17:30" }, sourceReason: "Mâu thuẫn" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { source: expect.any(String) } } });
      await expect(finance.addInvoiceLine(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { receivableId, quantity: "1", source: { attendanceState: "PRESENT", pickedUpAt: "25:99" }, sourceReason: "Giờ sai" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { "source.pickedUpAt": expect.any(String) } } });
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { total: 1n } })).rejects.toThrow(/derived/);
      const line = await prisma.invoiceLine.findFirstOrThrow({ where: { schoolId: current.school.id, invoiceId: invoice.id, amount: 240000n } });
      expect(line).toMatchObject({ amount: 240000n, sourceActorIdentityId: current.identity.id, sourceMembershipId: current.membership.id, sourceProvenance: { enrollmentId: student.enrollment.id } });
      expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: current.school.id, action: "INVOICE_LINE_ADDED" } })).toMatchObject({ provenance: { operationId } });
      const editKey = uuid(); const editOperation = uuid();
      const edited = await finance.editInvoiceLine(current.identity.id, current.school.id, invoice.id, line.id, editKey, editOperation, { quantity: "3", unitPrice: "100000", overrideReason: "Dùng giá catalog" });
       expect(edited.outcome).toMatchObject({ total: "300001", lines: expect.arrayContaining([expect.objectContaining({ amount: "300000" })]) });
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
         expect(lineGuard).toMatchObject({ labels: ["DRAFT", "ISSUED", "CANCELLED"] });
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
      const issued = await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, key, operationId, { bankAccountId: bank.id });
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

    it("closes only a fully issued generated run atomically, replays the outcome, and database guards preserve the lock", async () => {
      const { current, invoice, bank } = await issueFixture();
      const runId = invoice.collectionRunId;
      const key = uuid(); const operationId = uuid();
      await expect(finance.closeRun(current.identity.id, current.school.id, runId, key, operationId, { reason: "Đã rà soát" })).rejects.toMatchObject({ status: 409, response: { code: "COLLECTION_RUN_INVOICES_NOT_TERMINAL" } });
      expect(await prisma.collectionRunLifecycleTransition.count({ where: { schoolId: current.school.id, collectionRunId: runId, status: "CLOSED" } })).toBe(0);
      await finance.issueInvoice(current.identity.id, current.school.id, invoice.id, uuid(), uuid(), { bankAccountId: bank.id });
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
       await expect(prisma.$queryRaw<Array<{ labels: string[] }>>`SELECT ARRAY(SELECT enumlabel::text FROM pg_enum WHERE enumtypid = '"InvoiceStatus"'::regtype ORDER BY enumsortorder)::text[] AS labels`).resolves.toEqual([{ labels: ["DRAFT", "ISSUED", "CANCELLED"] }]);
    });

    it("rejects direct DRAFT snapshot injection and incomplete or incoherent DRAFT-to-ISSUED mutation", async () => {
      const { invoice, bank } = await issueFixture();
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { bankAccountIdSnapshot: bank.id } })).rejects.toThrow(/Draft invoice cannot contain issue snapshots/);
      await expect(prisma.invoice.update({ where: { id: invoice.id }, data: { status: "ISSUED", issuedAt: new Date(), bankAccountIdSnapshot: bank.id, receivingBankSnapshot: "Bank", accountNumberSnapshot: "1", accountHolderNameSnapshot: "Holder", transferContentSnapshot: "Content", obligationLinesSnapshot: [], obligationTotalSnapshot: 1n, financePolicyEffectiveFrom: date("2026-01-01"), dueDaysAfterIssueSnapshot: 1, taxTreatmentSnapshot: "NOT_APPLICABLE", debtScopeSnapshot: "CURRENT_SCHOOL_YEAR_ONLY", reversalModeSnapshot: "DIRECT", dueOn: date("2026-01-02") } })).rejects.toThrow(/internally inconsistent/);
    });
  },
);
