import { afterAll, afterEach, describe, expect, it } from "vitest";
import { AuthorizationService } from "../modules/authorization/authorization.service.js";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { FinanceService } from "../modules/finance/finance.service.js";

// Story 5.34: finance-owned extracurricular classes and effective-dated memberships (decision 2026-10-02 §3.3).
const prisma = new PrismaService();
const finance = new FinanceService(prisma, new AuthorizationService(prisma));
const schools: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const id = (value: { outcome: unknown }) => (value.outcome as { id: string }).id;
type Setup = Awaited<ReturnType<typeof setup>>;

async function setup(label = "Ngoại khóa") {
  const school = await prisma.school.create({ data: { name: label, slug: `xc-${uuid()}`, studentCodePrefix: "XC" } });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const position = await prisma.schoolPosition.create({ data: { schoolId: school.id, code: `FIN_${uuid().slice(0, 8)}`, name: `Finance ${uuid()}` } });
  await prisma.positionCapabilityGrant.createMany({ data: ["SCHOOL_CONTEXT_READ", "FINANCE_MANAGE"].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })) });
  await prisma.staffProfile.create({ data: { schoolId: school.id, fullName: "Finance", email: identity.emailNormalized, phone: "0900000000", dateOfBirth: date("1990-01-01"), gender: "Khác", address: "Test", primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
  const year = await prisma.schoolYear.create({ data: { schoolId: school.id, name: "2026-2027", startsOn: date("2026-08-01"), endsOn: date("2027-08-01") } });
  const nextYear = await prisma.schoolYear.create({ data: { schoolId: school.id, name: "2027-2028", startsOn: date("2027-08-01"), endsOn: date("2028-08-01") } });
  const official = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Lá 5A" } });
  await prisma.receivableGroup.createMany({ data: [{ schoolId: school.id, kind: "FIXED", name: "Khoản thu cố định" }, { schoolId: school.id, kind: "FLEXIBLE", name: "Khoản thu linh hoạt" }, { schoolId: school.id, kind: "EXTRACURRICULAR", name: "Ngoại khóa" }] });
  const receivable = async (kind: "FIXED" | "EXTRACURRICULAR", displayName: string) => id(await finance.createReceivable(identity.id, school.id, uuid(), uuid(), { kind, displayName, unitLabel: "tháng", defaultUnitPrice: "600000" }));
  const english = await receivable("EXTRACURRICULAR", "Tiếng Anh bản ngữ");
  const drawing = await receivable("EXTRACURRICULAR", "Năng khiếu vẽ");
  const tuition = await receivable("FIXED", "Học phí");
  const retired = await receivable("EXTRACURRICULAR", "Võ cũ");
  await finance.transitionReceivable(identity.id, school.id, retired, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng" });
  const enroll = async (index: number, options: { yearId?: string; effectiveFrom?: string; lifecycle?: "ENROLLED" | "WITHDRAWN" | "SCHEDULED_TO_START" | "ON_LEAVE" } = {}) => {
    const student = await prisma.student.create({ data: { schoolId: school.id, studentCode: `XC-${String(index).padStart(3, "0")}-${uuid().slice(0, 4)}`, fullName: `Bé ${index}`, dateOfBirth: date("2022-01-01") } });
    const target = options.yearId ?? year.id;
    const row = await prisma.studentEnrollment.create({ data: { schoolId: school.id, studentId: student.id, schoolYearId: target, classId: target === year.id ? official.id : null, className: target === year.id ? official.name : null, lifecycle: options.lifecycle ?? "ENROLLED", effectiveFrom: date(options.effectiveFrom ?? "2026-09-01"), ...(options.lifecycle === "WITHDRAWN" || options.lifecycle === "ON_LEAVE" ? { endedOn: date("2026-09-30") } : {}), schoolYearName: "n", schoolYearStartsOn: date("2026-08-01"), schoolYearEndsOn: date("2027-08-01") } });
    return row.id;
  };
  const students = [] as string[];
  for (let index = 1; index <= 4; index += 1) students.push(await enroll(index));
  return { school, identity, membership, year, nextYear, official, english, drawing, tuition, retired, students, enroll };
}
const createClass = (s: Setup, name: string, receivableId = s.english, schoolYearId = s.year.id) => finance.createExtracurricularClass(s.identity.id, s.school.id, uuid(), uuid(), { name, schoolYearId, receivableId });
const add = (s: Setup, classId: string, enrollmentIds: string[], extra: object = {}) => finance.addExtracurricularMemberships(s.identity.id, s.school.id, classId, uuid(), uuid(), { enrollmentIds, effectiveFrom: "2026-10-01", reason: "Đăng ký học kỳ 1", ...extra });
const counts = (s: Setup) => Promise.all([prisma.extracurricularMembership.count({ where: { schoolId: s.school.id } }), prisma.auditRecord.count({ where: { schoolId: s.school.id, action: { startsWith: "EXTRACURRICULAR_MEMBERSHIP" } } })]);

afterEach(async () => {
  const ids = schools.splice(0);
  if (!ids.length) return;
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    for (const model of ["auditRecord", "extracurricularMembership", "extracurricularClassLifecycleTransition", "extracurricularClass", "operation", "receivableLifecycleTransition", "receivable", "receivableGroup", "studentEnrollment", "student", "class", "schoolYear", "staffProfile", "positionCapabilityGrant", "schoolPosition", "schoolMembership"])
      await (tx as any)[model].deleteMany({ where: { schoolId: { in: ids } } });
    await tx.school.deleteMany({ where: { id: { in: ids } } });
  });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("extracurricular classes and memberships", () => {
  it("creates classes for ACTIVE EXTRACURRICULAR Receivables only, shares a Receivable and locks its kind", async () => {
    const s = await setup();
    const foreign = await setup("Foreign");
    const a1 = await createClass(s, "Tiếng Anh A1");
    expect(a1.outcome).toMatchObject({ name: "Tiếng Anh A1", receivableId: s.english, schoolYearId: s.year.id, status: "ACTIVE" });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_CLASS_CREATED" } })).toMatchObject({ membershipId: s.membership.id, provenance: { operationId: a1.id } });
    // A Receivable may serve several classes in parallel.
    const a2 = await createClass(s, "Tiếng Anh A2");
    expect(id(a2)).not.toBe(id(a1));
    await createClass(s, "Vẽ", s.drawing);
    await expect(createClass(s, "Tiếng Anh A1")).rejects.toMatchObject({ status: 400, response: { fieldErrors: { name: expect.any(String) } } });
    await expect(createClass(s, "Học phí lớp", s.tuition)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    await expect(createClass(s, "Võ", s.retired)).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    // Foreign Receivable / SchoolYear look exactly like missing ones.
    const missing = uuid();
    const foreignReceivable = (await prisma.receivable.findFirstOrThrow({ where: { schoolId: foreign.school.id } })).id;
    await expect(createClass(s, "X", foreignReceivable)).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_NOT_FOUND" } });
    await expect(createClass(s, "X", missing)).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_NOT_FOUND" } });
    await expect(createClass(s, "X", s.english, foreign.year.id)).rejects.toMatchObject({ status: 404, response: { code: "SCHOOL_YEAR_NOT_FOUND" } });
    // The database also refuses a non-EXTRACURRICULAR Receivable and cross-School graphs.
    await expect(prisma.extracurricularClass.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, name: "Direct", receivableId: s.tuition } })).rejects.toThrow(/EXTRACURRICULAR/);
    await expect(prisma.extracurricularClass.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, name: "Direct", receivableId: foreignReceivable } })).rejects.toThrow();
    await expect(prisma.extracurricularClass.update({ where: { id: id(a1) }, data: { createdAt: new Date() } })).rejects.toThrow(/append-only/);
    await expect(prisma.extracurricularClass.delete({ where: { id: id(a1) } })).rejects.toThrow(/append-only/);
    // List: shared names and receivable options.
    const list = await finance.extracurricularClasses(s.identity.id, s.school.id, { schoolYearId: s.year.id });
    expect(list.classes.find((item) => item.name === "Tiếng Anh A1")).toMatchObject({ sharedWith: ["Tiếng Anh A2"], currentMembers: 0, receivableName: "Tiếng Anh bản ngữ", defaultUnitPrice: "600000" });
    expect((await finance.extracurricularClasses(s.identity.id, s.school.id, { q: "vẽ" })).classes.map((item) => item.name)).toEqual(["Vẽ"]);
    expect((await finance.extracurricularClasses(foreign.identity.id, foreign.school.id, {})).classes).toEqual([]);
    // Kind lock through class attachment (API and database).
    await expect(finance.updateReceivable(s.identity.id, s.school.id, s.english, uuid(), uuid(), { kind: "FLEXIBLE", reason: "Điều chỉnh khoản thu" })).rejects.toMatchObject({ status: 409, response: { code: "RECEIVABLE_KIND_LOCKED" } });
    const catalog = await finance.read(s.identity.id, s.school.id);
    expect(catalog.receivables.find((item) => item.id === s.english)).toMatchObject({ kindLocked: true, extracurricularClassCount: 2, extracurricularClassNames: ["Tiếng Anh A1", "Tiếng Anh A2"] });
    const flexible = await prisma.receivableGroup.findFirstOrThrow({ where: { schoolId: s.school.id, kind: "FLEXIBLE" } });
    await expect(prisma.receivable.update({ where: { id: s.english }, data: { groupId: flexible.id } })).rejects.toThrow(/kind cannot change/);
    // Idempotent replay.
    const key = uuid();
    const body = { name: "Replay", schoolYearId: s.year.id, receivableId: s.drawing };
    const first = await finance.createExtracurricularClass(s.identity.id, s.school.id, key, uuid(), body);
    expect(await finance.createExtracurricularClass(s.identity.id, s.school.id, key, uuid(), body)).toEqual(first);
    await expect(finance.createExtracurricularClass(s.identity.id, s.school.id, key, uuid(), { ...body, name: "Khác" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(await prisma.extracurricularClass.count({ where: { schoolId: s.school.id, name: "Replay" } })).toBe(1);
  });

  it("deactivates and reactivates a class with reason and audit, and an inactive class takes no membership changes", async () => {
    const s = await setup();
    const classId = id(await createClass(s, "Tiếng Anh A1"));
    const member = await add(s, classId, [s.students[0]!]);
    const membershipId = (member.outcome as any).memberships[0].id;
    await expect(finance.transitionExtracurricularClass(s.identity.id, s.school.id, classId, uuid(), uuid(), { status: "INACTIVE", reason: "" })).rejects.toMatchObject({ status: 400 });
    const off = await finance.transitionExtracurricularClass(s.identity.id, s.school.id, classId, uuid(), uuid(), { status: "INACTIVE", reason: "Hết khóa" });
    expect(off.outcome).toMatchObject({ id: classId, status: "INACTIVE" });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_CLASS_LIFECYCLE_CHANGED" } })).toMatchObject({ reason: "Hết khóa" });
    await expect(finance.transitionExtracurricularClass(s.identity.id, s.school.id, classId, uuid(), uuid(), { status: "INACTIVE", reason: "Lại" })).rejects.toMatchObject({ status: 400 });
    await expect(add(s, classId, [s.students[1]!])).rejects.toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_CLASS_INACTIVE" } });
    await expect(finance.endExtracurricularMemberships(s.identity.id, s.school.id, classId, uuid(), uuid(), { membershipIds: [membershipId], effectiveTo: "2026-10-31", reason: "Nghỉ" })).rejects.toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_CLASS_INACTIVE" } });
    await expect(prisma.extracurricularMembership.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, extracurricularClassId: classId, enrollmentId: s.students[2]!, effectiveFrom: date("2026-10-01"), reason: "x", actorIdentityId: s.identity.id, createdByMembershipId: s.membership.id, createOperationId: (await prisma.operation.findFirstOrThrow({ where: { schoolId: s.school.id } })).id } })).rejects.toThrow(/ACTIVE/);
    // Reactivation is refused while the Receivable is inactive.
    await finance.transitionReceivable(s.identity.id, s.school.id, s.english, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng khoản" });
    await expect(finance.transitionExtracurricularClass(s.identity.id, s.school.id, classId, uuid(), uuid(), { status: "ACTIVE", reason: "Mở lại" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { status: expect.any(String) } } });
    await finance.transitionReceivable(s.identity.id, s.school.id, s.english, uuid(), uuid(), { status: "ACTIVE", reason: "Áp dụng lại" });
    expect((await finance.transitionExtracurricularClass(s.identity.id, s.school.id, classId, uuid(), uuid(), { status: "ACTIVE", reason: "Mở lại" })).outcome).toMatchObject({ status: "ACTIVE" });
    await expect(add(s, classId, [s.students[1]!])).resolves.toMatchObject({ status: "COMPLETED" });
  });

  it("adds and ends memberships singly and in bulk with one audit per membership, refusing overlap and committing all-or-nothing", async () => {
    const s = await setup();
    const a1 = id(await createClass(s, "Tiếng Anh A1"));
    const a2 = id(await createClass(s, "Tiếng Anh A2"));
    const [x, y, z, w] = s.students as [string, string, string, string];
    const bulk = await add(s, a1, [x, y, z]);
    expect((bulk.outcome as any).memberships).toHaveLength(3);
    expect(await prisma.auditRecord.count({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_MEMBERSHIP_ADDED" } })).toBe(3);
    const rows = await prisma.extracurricularMembership.findMany({ where: { schoolId: s.school.id } });
    expect(rows.every((row) => row.createOperationId === bulk.id && row.reason === "Đăng ký học kỳ 1" && row.createdByMembershipId === s.membership.id && row.effectiveTo === null)).toBe(true);
    // A Student may be in several classes; the same class refuses an overlap.
    await expect(add(s, a2, [x])).resolves.toMatchObject({ status: "COMPLETED" });
    await expect(add(s, a1, [x], { effectiveFrom: "2026-11-01" })).rejects.toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_MEMBERSHIP_OVERLAP" } });
    // All-or-nothing: one overlapping Student blocks the whole bulk, including its new Student and audits.
    const before = await counts(s);
    await expect(add(s, a1, [w, y])).rejects.toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_MEMBERSHIP_OVERLAP" } });
    expect(await counts(s)).toEqual(before);
    // Invalid Students (other year, withdrawn) and out-of-year dates also write nothing.
    const otherYear = await s.enroll(9, { yearId: s.nextYear.id });
    const withdrawn = await s.enroll(10, { lifecycle: "WITHDRAWN" });
    await expect(add(s, a2, [w, otherYear])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { enrollmentIds: expect.any(String) } } });
    await expect(add(s, a2, [w, withdrawn])).rejects.toMatchObject({ status: 400 });
    await expect(add(s, a2, [w], { effectiveFrom: "2025-01-01" })).rejects.toMatchObject({ status: 400 });
    await expect(add(s, a2, [w], { effectiveTo: "2026-09-30" })).rejects.toMatchObject({ status: 400 });
    await expect(add(s, a2, [w, w])).rejects.toMatchObject({ status: 400 });
    // Pre-registered Students may join; ON_LEAVE ones may not (billing eligibility is decided by the run later).
    const onLeave = await s.enroll(11, { lifecycle: "ON_LEAVE" });
    await expect(add(s, a2, [w, onLeave])).rejects.toMatchObject({ status: 400, response: { fieldErrors: { enrollmentIds: expect.any(String) } } });
    const scheduled = await s.enroll(12, { lifecycle: "SCHEDULED_TO_START" });
    expect((await finance.extracurricularCandidates(s.identity.id, s.school.id, a2, {})).candidates.map((row) => row.enrollmentId)).toEqual(expect.arrayContaining([scheduled]));
    expect((await finance.extracurricularCandidates(s.identity.id, s.school.id, a2, {})).candidates.map((row) => row.enrollmentId)).not.toContain(onLeave);
    await expect(add(s, a2, [scheduled], { effectiveFrom: "2026-11-01" })).resolves.toMatchObject({ status: "COMPLETED" });
    before[0] += 1; before[1] += 1; // the pre-registered Student above is a valid new membership
    expect(await counts(s)).toEqual(before);
    // End singly: one open membership gets its end date, reason and audit.
    const [xA1] = rows.filter((row) => row.enrollmentId === x);
    const ended = await finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [xA1!.id], effectiveTo: "2026-10-15", reason: "Chuyển lớp" });
    expect((ended.outcome as any).memberships[0]).toMatchObject({ id: xA1!.id, effectiveTo: "2026-10-15" });
    expect(await prisma.extracurricularMembership.findUniqueOrThrow({ where: { id: xA1!.id } })).toMatchObject({ effectiveTo: date("2026-10-16"), endReason: "Chuyển lớp", endOperationId: ended.id, endedByMembershipId: s.membership.id });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_MEMBERSHIP_ENDED" } })).toMatchObject({ reason: "Chuyển lớp", provenance: { oldValue: { effectiveTo: null }, newValue: { effectiveTo: "2026-10-15" } } });
    // The day after the end date is free again; a membership ending before it started or an already-ended one is refused.
    await expect(add(s, a1, [x], { effectiveFrom: "2026-10-16" })).resolves.toMatchObject({ status: "COMPLETED" });
    await expect(add(s, a1, [x], { effectiveFrom: "2026-10-10", effectiveTo: "2026-10-12" })).rejects.toMatchObject({ status: 409 });
    await expect(finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [xA1!.id], effectiveTo: "2026-10-20", reason: "Lại" })).rejects.toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_MEMBERSHIP_NOT_OPEN" } });
    // Bulk end is all-or-nothing too.
    const [yA1, zA1] = [rows.find((row) => row.enrollmentId === y)!, rows.find((row) => row.enrollmentId === z)!];
    const beforeEnd = await counts(s);
    await expect(finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [yA1.id, xA1!.id], effectiveTo: "2026-10-31", reason: "Nghỉ" })).rejects.toMatchObject({ status: 409 });
    await expect(finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [yA1.id, zA1.id], effectiveTo: "2026-09-30", reason: "Nghỉ" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveTo: expect.any(String) } } });
    expect(await prisma.extracurricularMembership.count({ where: { schoolId: s.school.id, effectiveTo: null, extracurricularClassId: a1 } })).toBe(3);
    expect(await counts(s)).toEqual(beforeEnd);
    const bulkEnd = await finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [yA1.id, zA1.id], effectiveTo: "2026-10-31", reason: "Hết khóa" });
    expect((bulkEnd.outcome as any).memberships).toHaveLength(2);
    expect(await prisma.auditRecord.count({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_MEMBERSHIP_ENDED" } })).toBe(3);
    // Database backstops: overlap, direct rewrite and delete.
    await expect(prisma.extracurricularMembership.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, extracurricularClassId: a2, enrollmentId: x, effectiveFrom: date("2026-12-01"), reason: "x", actorIdentityId: s.identity.id, createdByMembershipId: s.membership.id, createOperationId: ended.id } })).rejects.toThrow();
    await expect(prisma.extracurricularMembership.update({ where: { id: yA1.id }, data: { reason: "Sửa" } })).rejects.toThrow(/append-only/);
    await expect(prisma.extracurricularMembership.delete({ where: { id: yA1.id } })).rejects.toThrow(/append-only/);
    // Class, EnrollmentClassAssignment and staff assignments are never touched.
    expect(await prisma.enrollmentClassAssignment.count({ where: { schoolId: s.school.id } })).toBe(0);
    expect(await prisma.staffClassAssignment.count({ where: { schoolId: s.school.id } })).toBe(0);
  });

  it("keeps memberships inside the enrollment interval on add and end, in the API and the database", async () => {
    const s = await setup();
    const classId = id(await createClass(s, "Tiếng Anh A1"));
    const scheduled = await s.enroll(20, { lifecycle: "SCHEDULED_TO_START", effectiveFrom: "2026-11-01" });
    await expect(add(s, classId, [scheduled], { effectiveFrom: "2026-10-15" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveFrom: expect.any(String) } } });
    expect(await prisma.extracurricularMembership.count({ where: { schoolId: s.school.id } })).toBe(0);
    const opId = (await prisma.operation.create({ data: { schoolId: s.school.id, membershipId: s.membership.id, actorIdentityId: s.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: s.membership.id, route: "direct", fingerprint: "direct", idempotencyKey: uuid(), status: "COMPLETED" } })).id;
    await expect(prisma.extracurricularMembership.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, extracurricularClassId: classId, enrollmentId: scheduled, effectiveFrom: date("2026-10-15"), reason: "x", actorIdentityId: s.identity.id, createdByMembershipId: s.membership.id, createOperationId: opId } })).rejects.toThrow(/enrollment interval/);
    await expect(add(s, classId, [scheduled], { effectiveFrom: "2026-11-01" })).resolves.toMatchObject({ status: "COMPLETED" });

    // A Student withdrawn later (roster module, not blocked here): the end date may not run past the enrollment end.
    const [stayer] = s.students as [string];
    const open = (await add(s, classId, [stayer])).outcome as any;
    await prisma.studentEnrollment.update({ where: { id: stayer }, data: { lifecycle: "WITHDRAWN", endedOn: date("2026-11-01") } });
    const end = (effectiveTo: string) => finance.endExtracurricularMemberships(s.identity.id, s.school.id, classId, uuid(), uuid(), { membershipIds: [open.memberships[0].id], effectiveTo, reason: "Nghỉ học" });
    await expect(end("2026-11-15")).rejects.toMatchObject({ status: 400, response: { fieldErrors: { effectiveTo: expect.any(String) } } });
    await expect(end("2026-11-01")).rejects.toMatchObject({ status: 400 });
    await expect(prisma.$executeRaw`UPDATE "ExtracurricularMembership" SET "effectiveTo" = '2026-11-15', "endReason" = 'x', "endedByMembershipId" = ${s.membership.id}::uuid, "endOperationId" = ${opId}::uuid, "endedAt" = now() WHERE "id" = ${open.memberships[0].id}::uuid`).rejects.toThrow(/enrollment interval/);
    expect((await end("2026-10-31")).outcome).toMatchObject({ memberships: [{ effectiveTo: "2026-10-31" }] });
    // An open membership on an ended enrollment cannot be created either.
    await expect(prisma.$executeRaw`INSERT INTO "ExtracurricularMembership" ("schoolId","schoolYearId","extracurricularClassId","enrollmentId","effectiveFrom","reason","actorIdentityId","createdByMembershipId","createOperationId") VALUES (${s.school.id}::uuid, ${s.year.id}::uuid, ${classId}::uuid, ${stayer}::uuid, '2026-12-01', 'x', ${s.identity.id}::uuid, ${s.membership.id}::uuid, ${opId}::uuid)`).rejects.toThrow(/enrollment interval/);
  });

  it("requires complete end provenance, rejecting partial or direct end updates", async () => {
    const s = await setup();
    const classId = id(await createClass(s, "Tiếng Anh A1"));
    const created = (await add(s, classId, [s.students[0]!])).outcome as any;
    const membershipId = created.memberships[0].id;
    const opId = (await prisma.operation.findFirstOrThrow({ where: { schoolId: s.school.id } })).id;
    await expect(prisma.extracurricularMembership.update({ where: { id: membershipId }, data: { effectiveTo: date("2026-10-31"), endReason: "x", endOperationId: opId } })).rejects.toThrow(/complete end provenance/);
    await expect(prisma.extracurricularMembership.update({ where: { id: membershipId }, data: { effectiveTo: date("2026-10-31"), endReason: "x", endOperationId: opId, endedByMembershipId: s.membership.id } })).rejects.toThrow(/complete end provenance/);
    // Even history-cleanup mode (which skips the guard trigger) cannot persist a half-set end.
    await expect(prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
      await tx.$executeRaw`UPDATE "ExtracurricularMembership" SET "effectiveTo" = '2026-10-31', "endReason" = 'x' WHERE "id" = ${membershipId}::uuid`;
    })).rejects.toThrow(/end_provenance_complete/);
    expect(await prisma.extracurricularMembership.findUniqueOrThrow({ where: { id: membershipId } })).toMatchObject({ effectiveTo: null, endReason: null, endedAt: null });
    const ended = await finance.endExtracurricularMemberships(s.identity.id, s.school.id, classId, uuid(), uuid(), { membershipIds: [membershipId], effectiveTo: "2026-10-31", reason: "Hết khóa" });
    expect(await prisma.extracurricularMembership.findUniqueOrThrow({ where: { id: membershipId } })).toMatchObject({ endReason: "Hết khóa", endOperationId: ended.id, endedByMembershipId: s.membership.id, endedAt: expect.any(Date) });
  });

  it("serializes class creation against receivable deactivation and the database requires an ACTIVE Receivable", async () => {
    const s = await setup();
    // Deactivation in flight (row locked, INACTIVE transition uncommitted): class creation waits, then is refused.
    const operation = await prisma.operation.create({ data: { schoolId: s.school.id, membershipId: s.membership.id, actorIdentityId: s.identity.id, actorType: "SCHOOL_MEMBERSHIP", actorReference: s.membership.id, route: "direct", fingerprint: "direct", idempotencyKey: uuid(), status: "COMPLETED" } });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let ready!: () => void;
    const started = new Promise<void>((resolve) => { ready = resolve; });
    const deactivating = prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT 1 FROM "Receivable" WHERE "id" = ${s.drawing}::uuid AND "schoolId" = ${s.school.id}::uuid FOR UPDATE`;
      await tx.receivableLifecycleTransition.create({ data: { schoolId: s.school.id, receivableId: s.drawing, previousStatus: "ACTIVE", status: "INACTIVE", reason: "Ngừng", actorIdentityId: s.identity.id, membershipId: s.membership.id, operationId: operation.id, sequence: 2 } });
      ready();
      await gate;
    }, { timeout: 30000, maxWait: 30000 });
    deactivating.catch(() => ready());
    await started;
    let settled = false;
    const creating = createClass(s, "Vẽ", s.drawing).then((value) => { settled = true; return value; }, (error) => { settled = true; throw error; });
    creating.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(settled).toBe(false);
    release();
    await deactivating;
    await expect(creating).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    expect(await prisma.extracurricularClass.count({ where: { schoolId: s.school.id, receivableId: s.drawing } })).toBe(0);
    // Defense in depth: the database refuses a class on a receivable whose latest lifecycle is INACTIVE.
    await expect(prisma.extracurricularClass.create({ data: { schoolId: s.school.id, schoolYearId: s.year.id, name: "Direct", receivableId: s.drawing } })).rejects.toThrow(/ACTIVE Receivable/);
    // A class created first keeps working: deactivating the receivable afterwards is allowed and leaves the class (and its history) intact.
    const kept = id(await createClass(s, "Tiếng Anh A1"));
    await finance.transitionReceivable(s.identity.id, s.school.id, s.english, uuid(), uuid(), { status: "INACTIVE", reason: "Ngừng khoản" });
    expect(await prisma.extracurricularClass.count({ where: { id: kept } })).toBe(1);
  });

  it("renames a class with reason and audit for ACTIVE and INACTIVE classes, refusing blank, duplicate and foreign requests", async () => {
    const s = await setup();
    const foreign = await setup("Foreign");
    const a1 = id(await createClass(s, "Tiếng Anh A1"));
    await createClass(s, "Tiếng Anh A2");
    const foreignClass = id(await createClass(foreign, "Foreign lớp"));
    const rename = (classId: string, body: object, key = uuid(), actor: Setup = s) => finance.editExtracurricularClass(actor.identity.id, actor.school.id, classId, key, uuid(), body);
    const key = uuid();
    const renamed = await rename(a1, { name: "  Tiếng Anh nâng cao  ", reason: "Đổi tên theo chương trình" }, key);
    expect(renamed.outcome).toMatchObject({ id: a1, name: "Tiếng Anh nâng cao", status: "ACTIVE" });
    expect(await prisma.extracurricularClass.findUniqueOrThrow({ where: { id: a1 } })).toMatchObject({ name: "Tiếng Anh nâng cao", receivableId: s.english });
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_CLASS_EDITED" } })).toMatchObject({ reason: "Đổi tên theo chương trình", membershipId: s.membership.id, provenance: { operationId: renamed.id, oldValue: { name: "Tiếng Anh A1" }, newValue: { name: "Tiếng Anh nâng cao" } } });
    // Replay by key returns the stored outcome without a second audit; a changed body conflicts.
    expect(await rename(a1, { name: "Tiếng Anh nâng cao", reason: "Đổi tên theo chương trình" }, key)).toEqual({ ...renamed, outcome: renamed.outcome });
    await expect(rename(a1, { name: "Khác", reason: "x" }, key)).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(await prisma.auditRecord.count({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_CLASS_EDITED" } })).toBe(1);
    // Validation: blank name, missing reason, same name, name already used in the school year.
    await expect(rename(a1, { name: "   ", reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { name: expect.any(String) } } });
    await expect(rename(a1, { name: "Mới", reason: " " })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { reason: expect.any(String) } } });
    await expect(rename(a1, { name: "Tiếng Anh nâng cao", reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { name: expect.any(String) } } });
    await expect(rename(a1, { name: "Tiếng Anh A2", reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { name: expect.any(String) } } });
    // Allowed while INACTIVE too.
    await finance.transitionExtracurricularClass(s.identity.id, s.school.id, a1, uuid(), uuid(), { status: "INACTIVE", reason: "Hết khóa" });
    expect((await rename(a1, { name: "Tiếng Anh cũ", reason: "Lưu trữ" })).outcome).toMatchObject({ name: "Tiếng Anh cũ", status: "INACTIVE" });
    // Cross-School and missing look identical, and nothing changes.
    const missing = async (call: () => Promise<unknown>) => call().then(() => null, (error) => ({ status: error.status, code: error.response?.code }));
    expect(await missing(() => rename(foreignClass, { name: "Hack", reason: "x" }))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect(await missing(() => rename(uuid(), { name: "Hack", reason: "x" }))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect((await prisma.extracurricularClass.findUniqueOrThrow({ where: { id: foreignClass } })).name).toBe("Foreign lớp");
    // Capability.
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: s.school.id, capability: "FINANCE_MANAGE" } });
    await expect(rename(a1, { name: "Không quyền", reason: "x" })).rejects.toMatchObject({ status: 403 });
  });

  it("switches a class to another ACTIVE EXTRACURRICULAR Receivable with reason and audit, keeping memberships (decision 2026-10-06)", async () => {
    const s = await setup();
    const foreign = await setup("Foreign");
    const a1 = id(await createClass(s, "Tiếng Anh A1"));
    await add(s, a1, s.students.slice(0, 2));
    const edit = (body: object, key = uuid()) => finance.editExtracurricularClass(s.identity.id, s.school.id, a1, key, uuid(), body);
    const key = uuid();
    const edited = await edit({ receivableId: s.drawing, reason: "Đổi chương trình" }, key);
    expect(edited.outcome).toMatchObject({ id: a1, name: "Tiếng Anh A1", receivableId: s.drawing, status: "ACTIVE" });
    expect(await prisma.extracurricularMembership.count({ where: { extracurricularClassId: a1 } })).toBe(2);
    expect(await prisma.auditRecord.findFirstOrThrow({ where: { schoolId: s.school.id, action: "EXTRACURRICULAR_CLASS_EDITED" } })).toMatchObject({ reason: "Đổi chương trình", provenance: { operationId: edited.id, oldValue: { receivableId: s.english, receivableName: "Tiếng Anh bản ngữ" }, newValue: { receivableId: s.drawing, receivableName: "Năng khiếu vẽ" } } });
    expect(await edit({ receivableId: s.drawing, reason: "Đổi chương trình" }, key)).toEqual(edited);
    // Name and Receivable together in one command.
    expect((await edit({ name: "Vẽ A1", receivableId: s.english, reason: "Quay lại" })).outcome).toMatchObject({ name: "Vẽ A1", receivableId: s.english });
    // Refusals save nothing, including the name sent alongside.
    const foreignReceivable = (await prisma.receivable.findFirstOrThrow({ where: { schoolId: foreign.school.id } })).id;
    await expect(edit({ name: "Không lưu", receivableId: s.tuition, reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    await expect(edit({ name: "Không lưu", receivableId: s.retired, reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    await expect(edit({ name: "Không lưu", receivableId: foreignReceivable, reason: "x" })).rejects.toMatchObject({ status: 404, response: { code: "RECEIVABLE_NOT_FOUND" } });
    await expect(edit({ receivableId: s.english, reason: "x" })).rejects.toMatchObject({ status: 400, response: { fieldErrors: { receivableId: expect.any(String) } } });
    expect(await prisma.extracurricularClass.findUniqueOrThrow({ where: { id: a1 } })).toMatchObject({ name: "Vẽ A1", receivableId: s.english });
    // Database defense: a direct update to a non-EXTRACURRICULAR Receivable or another column is refused.
    await expect(prisma.extracurricularClass.update({ where: { id: a1 }, data: { receivableId: s.tuition } })).rejects.toThrow(/EXTRACURRICULAR Receivable/);
    await expect(prisma.extracurricularClass.update({ where: { id: a1 }, data: { schoolYearId: s.nextYear.id } })).rejects.toThrow(/append-only/);
  });

  it("serializes competing commands: one concurrent membership add, class creation and rename wins, the rest get controlled 4xx", async () => {
    const s = await setup();
    const classId = id(await createClass(s, "Tiếng Anh A1"));
    const [x] = s.students as [string];
    // Two Finance sessions add the same Student to the same class at once.
    const adds = await Promise.allSettled([add(s, classId, [x]), add(s, classId, [x], { reason: "Đăng ký khác" })]);
    expect(adds.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const lost = adds.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(lost.reason).toMatchObject({ status: 409, response: { code: "EXTRACURRICULAR_MEMBERSHIP_OVERLAP" } });
    expect(await prisma.extracurricularMembership.count({ where: { schoolId: s.school.id, enrollmentId: x } })).toBe(1);
    // Two classes with the same name in one SchoolYear: one is created.
    const creates = await Promise.allSettled([createClass(s, "Vẽ chung", s.drawing), createClass(s, "Vẽ chung", s.drawing)]);
    expect(creates.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((creates.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 400, response: { fieldErrors: { name: expect.any(String) } } });
    expect(await prisma.extracurricularClass.count({ where: { schoolId: s.school.id, name: "Vẽ chung" } })).toBe(1);
    // Two renames to the same free name at once.
    const second = id(await createClass(s, "Tiếng Anh A2"));
    const renames = await Promise.allSettled([classId, second].map((target) => finance.editExtracurricularClass(s.identity.id, s.school.id, target, uuid(), uuid(), { name: "Tiếng Anh nâng cao", reason: "Đổi tên" })));
    expect(renames.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((renames.find((result) => result.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ status: 400 });
    expect(await prisma.extracurricularClass.count({ where: { schoolId: s.school.id, name: "Tiếng Anh nâng cao" } })).toBe(1);
  });

  it("replays a bulk add by key, rejects a changed body and re-authorizes, and refuses foreign Schools without leaking facts", async () => {
    const s = await setup();
    const foreign = await setup("Foreign");
    const classId = id(await createClass(s, "Tiếng Anh A1"));
    const foreignClassId = id(await createClass(foreign, "Foreign lớp"));
    const key = uuid();
    const body = { enrollmentIds: [s.students[0]!, s.students[1]!], effectiveFrom: "2026-10-01", reason: "Đăng ký" };
    const first = await finance.addExtracurricularMemberships(s.identity.id, s.school.id, classId, key, uuid(), body);
    expect(await finance.addExtracurricularMemberships(s.identity.id, s.school.id, classId, key, uuid(), body)).toEqual(first);
    await expect(finance.addExtracurricularMemberships(s.identity.id, s.school.id, classId, key, uuid(), { ...body, reason: "Khác" })).rejects.toMatchObject({ status: 409, response: { code: "IDEMPOTENCY_CONFLICT" } });
    expect(await prisma.extracurricularMembership.count({ where: { schoolId: s.school.id } })).toBe(2);
    // Foreign Student, foreign class and a missing id answer identically.
    const foreignEnrollment = foreign.students[0]!;
    const sameShape = async (call: () => Promise<unknown>) => call().then(() => null, (error) => ({ status: error.status, code: error.response?.code }));
    expect(await sameShape(() => add(s, classId, [s.students[2]!, foreignEnrollment]))).toEqual({ status: 404, code: "ENROLLMENT_NOT_FOUND" });
    expect(await sameShape(() => add(s, classId, [s.students[2]!, uuid()]))).toEqual({ status: 404, code: "ENROLLMENT_NOT_FOUND" });
    expect(await sameShape(() => add(s, foreignClassId, [s.students[2]!]))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect(await sameShape(() => add(s, uuid(), [s.students[2]!]))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    const foreignMembership = (await add(foreign, foreignClassId, [foreign.students[0]!])).outcome as any;
    expect(await sameShape(() => finance.endExtracurricularMemberships(s.identity.id, s.school.id, classId, uuid(), uuid(), { membershipIds: [foreignMembership.memberships[0].id], effectiveTo: "2026-10-31", reason: "x" }))).toEqual({ status: 404, code: "EXTRACURRICULAR_MEMBERSHIP_NOT_FOUND" });
    expect(await sameShape(() => finance.extracurricularClass(s.identity.id, s.school.id, foreignClassId, {}))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect(await sameShape(() => finance.extracurricularCandidates(s.identity.id, s.school.id, foreignClassId, {}))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect(await sameShape(() => finance.transitionExtracurricularClass(s.identity.id, s.school.id, foreignClassId, uuid(), uuid(), { status: "INACTIVE", reason: "x" }))).toEqual({ status: 404, code: "EXTRACURRICULAR_CLASS_NOT_FOUND" });
    expect(await prisma.extracurricularMembership.count({ where: { schoolId: foreign.school.id } })).toBe(1);
    // Capability: without FINANCE_MANAGE nothing is readable or writable.
    await prisma.positionCapabilityGrant.deleteMany({ where: { schoolId: s.school.id, capability: "FINANCE_MANAGE" } });
    await expect(finance.extracurricularClasses(s.identity.id, s.school.id, {})).rejects.toMatchObject({ status: 403 });
    await expect(add(s, classId, [s.students[2]!])).rejects.toMatchObject({ status: 403 });
    await expect(finance.addExtracurricularMemberships(s.identity.id, s.school.id, classId, key, uuid(), body)).rejects.toMatchObject({ status: 403 });
  });

  it("reports current and month-counted members with mid-month flags, transfers and picker candidates", async () => {
    const s = await setup();
    const a1 = id(await createClass(s, "Tiếng Anh A1"));
    const a2 = id(await createClass(s, "Tiếng Anh A2"));
    const [full, leaver, joiner, earlier] = s.students as [string, string, string, string];
    await add(s, a1, [full], { effectiveFrom: "2026-09-01" });
    await add(s, a1, [leaver], { effectiveFrom: "2026-09-01" });
    await add(s, a1, [joiner], { effectiveFrom: "2026-10-14" });
    await add(s, a1, [earlier], { effectiveFrom: "2026-09-01", effectiveTo: "2026-09-30" });
    const leaverRow = await prisma.extracurricularMembership.findFirstOrThrow({ where: { schoolId: s.school.id, enrollmentId: leaver } });
    await finance.endExtracurricularMemberships(s.identity.id, s.school.id, a1, uuid(), uuid(), { membershipIds: [leaverRow.id], effectiveTo: "2026-10-15", reason: "Chuyển lớp" });
    await add(s, a2, [leaver], { effectiveFrom: "2026-10-16" });
    const detail = await finance.extracurricularClass(s.identity.id, s.school.id, a1, { month: "2026-10" });
    expect(detail.month).toMatchObject({ month: "2026-10", counted: 3, midMonth: 2 });
    expect(detail.class).toMatchObject({ name: "Tiếng Anh A1", sharedWith: ["Tiếng Anh A2"], receivableName: "Tiếng Anh bản ngữ", schoolYearName: "2026-2027" });
    const byName = Object.fromEntries(detail.members.map((row) => [row.fullName, row]));
    expect(detail.members).toHaveLength(3);
    expect(byName["Bé 1"]).toMatchObject({ flags: [], effectiveTo: null, open: true });
    expect(byName["Bé 2"]).toMatchObject({ flags: ["LEFT_IN_MONTH"], effectiveTo: "2026-10-15", open: false, transferNote: "Chuyển sang Tiếng Anh A2 từ 16/10/2026" });
    expect(byName["Bé 3"]).toMatchObject({ flags: ["JOINED_IN_MONTH"], effectiveFrom: "2026-10-14" });
    const all = await finance.extracurricularClass(s.identity.id, s.school.id, a1, { month: "2026-10", status: "ALL" });
    expect(all.total).toBe(4);
    expect((await finance.extracurricularClass(s.identity.id, s.school.id, a1, { month: "2026-09" })).month.counted).toBe(3);
    expect((await finance.extracurricularClass(s.identity.id, s.school.id, a1, { month: "2026-10", q: "bé 3" })).members.map((row) => row.fullName)).toEqual(["Bé 3"]);
    await expect(finance.extracurricularClass(s.identity.id, s.school.id, a1, { month: "2026-13" })).rejects.toMatchObject({ status: 400 });
    const picker = await finance.extracurricularCandidates(s.identity.id, s.school.id, a1, { officialClassId: s.official.id });
    expect(picker.officialClasses).toEqual([{ id: s.official.id, name: "Lá 5A" }]);
    expect(picker.candidates).toHaveLength(4);
    expect(picker.candidates.find((row) => row.fullName === "Bé 3")).toMatchObject({ member: true });
    expect(picker.candidates.find((row) => row.fullName === "Bé 4")).toMatchObject({ member: false });
    expect((await finance.extracurricularCandidates(s.identity.id, s.school.id, a1, { q: "bé 4" })).candidates).toHaveLength(1);
  });
});
