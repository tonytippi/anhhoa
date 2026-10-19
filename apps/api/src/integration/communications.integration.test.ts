import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../modules/identity/prisma.service.js";
import { AttendanceService } from "../modules/attendance/attendance.service.js";
import { CommunicationsService } from "../modules/communications/communications.service.js";
import { PushService, type PushMessage } from "../modules/push/push.service.js";

const prisma = new PrismaService();
const communications = new CommunicationsService(prisma);
const attendance = new AttendanceService(prisma, communications);
const push = new PushService(prisma);
const schools: string[] = [];
const parentProfiles: string[] = [];
const uuid = () => crypto.randomUUID();
const date = (value: string) => new Date(`${value}T00:00:00.000Z`);
const today = "2026-02-09";
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function graph(capabilities = ["DAILY_JOURNAL_WRITE", "PARENT_MESSAGE_WRITE"]) {
  const school = await prisma.school.create({
    data: { name: "Communications", slug: `communications-${uuid()}`, studentCodePrefix: "CM" },
  });
  schools.push(school.id);
  const identity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const membership = await prisma.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: identity.id } });
  const year = await prisma.schoolYear.create({
    data: { schoolId: school.id, name: "Năm 2026", startsOn: date("2026-01-01"), endsOn: date("2027-01-01") },
  });
  const classroom = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Mầm" } });
  const otherClass = await prisma.class.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Chồi" } });
  const position = await prisma.schoolPosition.create({
    data: { schoolId: school.id, code: `GV-${uuid()}`, name: `Giáo viên ${uuid()}` },
  });
  await prisma.positionCapabilityGrant.createMany({
    data: capabilities.map((capability) => ({ schoolId: school.id, positionId: position.id, capability })),
  });
  const staff = await prisma.staffProfile.create({
    data: {
      schoolId: school.id,
      primaryPositionId: position.id,
      schoolMembershipId: membership.id,
      boundAt: new Date(),
      boundByMembershipId: membership.id,
      fullName: "Cô Lan",
      email: `${uuid()}@example.com`,
      phone: "0900000020",
      dateOfBirth: date("1990-01-01"),
    },
  });
  await prisma.staffClassAssignment.create({
    data: {
      schoolId: school.id,
      staffProfileId: staff.id,
      schoolYearId: year.id,
      classId: classroom.id,
      effectiveFrom: date("2026-01-01"),
      reason: "Dạy lớp",
      schoolYearName: year.name,
      schoolYearStartsOn: year.startsOn,
      schoolYearEndsOn: year.endsOn,
      className: classroom.name,
    },
  });
  const student = await prisma.student.create({
    data: { schoolId: school.id, studentCode: `CM-${uuid()}`, fullName: "Bé An", dateOfBirth: date("2022-01-01") },
  });
  const enrollment = await prisma.studentEnrollment.create({
    data: {
      schoolId: school.id,
      studentId: student.id,
      schoolYearId: year.id,
      classId: classroom.id,
      lifecycle: "ENROLLED",
      effectiveFrom: date("2026-01-01"),
      schoolYearName: year.name,
      schoolYearStartsOn: year.startsOn,
      schoolYearEndsOn: year.endsOn,
      className: classroom.name,
    },
  });
  await prisma.enrollmentClassAssignment.create({
    data: {
      schoolId: school.id,
      enrollmentId: enrollment.id,
      schoolYearId: year.id,
      classId: classroom.id,
      effectiveFrom: date("2026-01-01"),
      reason: "Xếp lớp đầu năm",
    },
  });
  const parentIdentity = await prisma.userIdentity.create({ data: { emailNormalized: `${uuid()}@example.com` } });
  const parent = await prisma.parentProfile.create({
    data: { emailNormalized: `${uuid()}@example.com`, fullName: "Mẹ An", phone: "0900000000", userIdentityId: parentIdentity.id },
  });
  parentProfiles.push(parent.id);
  await prisma.studentParent.create({
    data: { schoolId: school.id, studentId: student.id, parentProfileId: parent.id, relationshipLabel: "Mẹ" },
  });
  await prisma.schoolCalendarVersion.create({
    data: { schoolId: school.id, effectiveFrom: date("2026-01-01"), actorIdentityId: identity.id, membershipId: membership.id },
  });
  await prisma.dailyJournalPolicy.create({
    data: {
      schoolId: school.id,
      effectiveFrom: date("2026-01-01"),
      reason: "Nhận xét hằng ngày",
      parentRetentionDaysAfterEnrollmentEnded: 30,
      acceptedImageMimeTypes: ["JPEG", "PNG", "WEBP"],
      maxImageSizeBytes: 10485760,
      actorIdentityId: identity.id,
      membershipId: membership.id,
    },
  });
  return { school, identity, membership, classroom, otherClass, staff, student, parent, parentIdentity };
}

afterEach(async () => {
  vi.restoreAllMocks();
  const ids = schools.splice(0);
  if (ids.length)
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('passionedu.allow_daily_journal_history_cleanup', 'on', true)`;
      const where = { where: { schoolId: { in: ids } } };
      await tx.auditRecord.deleteMany(where);
      await tx.operation.deleteMany(where);
      await tx.parentInboxEventRead.deleteMany(where);
      await tx.notificationSourceEvent.deleteMany(where);
      await tx.studentMessageRead.deleteMany(where);
      await tx.studentMessage.deleteMany(where);
      await tx.classDailyNoteMedia.deleteMany(where);
      await tx.classDailyNote.deleteMany(where);
      await tx.dailyJournalPolicy.deleteMany(where);
      await tx.schoolCalendarVersion.deleteMany(where);
      await tx.studentParent.deleteMany(where);
      await tx.staffClassAssignment.deleteMany(where);
      await tx.enrollmentClassAssignment.deleteMany(where);
      await tx.studentEnrollment.deleteMany(where);
      await tx.student.deleteMany(where);
      await tx.class.deleteMany(where);
      await tx.schoolYear.deleteMany(where);
      await tx.staffProfile.deleteMany(where);
      await tx.positionCapabilityGrant.deleteMany(where);
      await tx.schoolPosition.deleteMany(where);
      await tx.schoolMembership.deleteMany(where);
      await tx.school.deleteMany({ where: { id: { in: ids } } });
    });
  await prisma.parentProfile.deleteMany({ where: { id: { in: parentProfiles.splice(0) } } });
  await prisma.pushSubscription.deleteMany({ where: { endpoint: { startsWith: "https://fcm.googleapis.com/fcm/send/test-" } } });
});
afterAll(() => prisma.$disconnect());

describe.skipIf(!process.env.TARGET_INTEGRATION_DATABASE_URL)("class notes and student messages", () => {
  it("lists only the Classes assigned to the teacher", async () => {
    const current = await graph();
    const result = await communications.teacherClasses(current.identity.id, current.school.id, today);
    expect(result).toMatchObject({ teacherName: "Cô Lan", classes: [{ classId: current.classroom.id, className: "Mầm" }] });
    const foreign = await graph();
    await expect(communications.teacherClasses(foreign.identity.id, current.school.id, today)).rejects.toMatchObject({ status: 403 });
  });

  it("saves a Class note once per day and projects it to every Parent of the Class", async () => {
    const current = await graph();
    vi.spyOn(communications as any, "today").mockReturnValue(today);
    const uploaded = (await communications.uploadClassNoteMedia(
      current.identity.id, current.school.id, uuid(), uuid(), current.classroom.id, today, "image/png", png,
    )) as unknown as { outcome: { id: string } };
    const key = uuid();
    const operationId = uuid();
    const body = { classId: current.classroom.id, noteDate: today, text: "Hôm nay cả lớp đi dã ngoại.", mediaIds: [uploaded.outcome.id] };
    const first = await communications.saveClassNote(current.identity.id, current.school.id, key, operationId, body);
    expect(first).toMatchObject({ id: operationId, status: "COMPLETED", outcome: { version: 1 } });
    await expect(communications.saveClassNote(current.identity.id, current.school.id, key, operationId, body)).resolves.toMatchObject({ id: operationId });
    await expect(
      communications.saveClassNote(current.identity.id, current.school.id, key, uuid(), { ...body, text: "Khác" }),
    ).rejects.toMatchObject({ status: 409 });
    const second = await communications.saveClassNote(current.identity.id, current.school.id, uuid(), uuid(), { ...body, text: "Cập nhật" });
    expect(second).toMatchObject({ outcome: { version: 2, text: "Cập nhật", media: [{ id: uploaded.outcome.id }] } });
    expect(await prisma.classDailyNote.count({ where: { schoolId: current.school.id } })).toBe(1);

    await expect(communications.parentClassNote(current.parentIdentity.id, current.school.id, current.student.id, today)).resolves.toMatchObject({
      className: "Mầm", text: "Cập nhật", media: [{ id: uploaded.outcome.id }],
    });
    await expect(communications.readParentClassNoteMedia(current.parentIdentity.id, current.school.id, uploaded.outcome.id)).resolves.toMatchObject({ contentType: "image/png" });
    await expect(communications.parentClassNote(current.parentIdentity.id, current.school.id, current.student.id, "2026-02-08")).resolves.toBeNull();

    const foreign = await graph();
    await expect(communications.parentClassNote(foreign.parentIdentity.id, current.school.id, current.student.id, today)).rejects.toMatchObject({ status: 404 });
    await expect(communications.readParentClassNoteMedia(foreign.parentIdentity.id, current.school.id, uploaded.outcome.id)).rejects.toMatchObject({ status: 404 });
    await expect(communications.teacherClassNote(current.identity.id, current.school.id, current.otherClass.id, today)).rejects.toMatchObject({ status: 403 });
    await expect(communications.saveClassNote(current.identity.id, current.school.id, uuid(), uuid(), { ...body, noteDate: "2026-02-08" })).rejects.toMatchObject({ status: 409 });

    const reconciled = await attendance.teacherOperation(current.identity.id, current.school.id, operationId);
    expect(reconciled).toMatchObject({ id: operationId, status: "COMPLETED" });
  });

  it("keeps one conversation per Student with unread counts on both sides", async () => {
    const current = await graph();
    vi.spyOn(communications as any, "today").mockReturnValue(today);
    const operationId = uuid();
    await communications.teacherSendMessage(current.identity.id, current.school.id, current.student.id, uuid(), operationId, {
      classId: current.classroom.id, body: "Chào chị, bé hôm nay hơi sốt nhẹ.",
    });
    await expect(communications.parentMessageSummary(current.parentIdentity.id, current.school.id)).resolves.toEqual([
      { studentId: current.student.id, unreadCount: 1 },
    ]);
    const parentView = await communications.parentMessages(current.parentIdentity.id, current.school.id, current.student.id);
    expect(parentView).toMatchObject({ canSend: true, className: "Mầm", messages: [{ senderType: "TEACHER", senderLabel: "Giáo viên lớp Mầm", mine: false }] });
    expect(parentView.messages[0]).not.toHaveProperty("senderName");
    await communications.parentReadMessages(current.parentIdentity.id, current.school.id, current.student.id);
    await expect(communications.parentMessageSummary(current.parentIdentity.id, current.school.id)).resolves.toEqual([
      { studentId: current.student.id, unreadCount: 0 },
    ]);

    const reply = uuid();
    await communications.parentSendMessage(current.parentIdentity.id, current.school.id, current.student.id, uuid(), reply, { body: "Cảm ơn cô." });
    const threads = await communications.teacherThreads(current.identity.id, current.school.id, current.classroom.id);
    expect(threads.students).toMatchObject([
      { studentId: current.student.id, unreadCount: 1, parents: [{ fullName: "Mẹ An", relationshipLabel: "Mẹ", hasAccount: true }], lastMessage: { senderType: "PARENT", body: "Cảm ơn cô." } },
    ]);
    const teacherView = await communications.teacherMessages(current.identity.id, current.school.id, current.classroom.id, current.student.id);
    expect(teacherView.messages.map((message) => [message.senderName, message.mine])).toEqual([["Cô Lan", true], ["Mẹ An", false]]);
    await communications.teacherReadMessages(current.identity.id, current.school.id, current.classroom.id, current.student.id);
    expect((await communications.teacherThreads(current.identity.id, current.school.id, current.classroom.id)).students[0]!.unreadCount).toBe(0);

    await expect(communications.teacherMessages(current.identity.id, current.school.id, current.otherClass.id, current.student.id)).rejects.toMatchObject({ status: 403 });
    const foreign = await graph();
    await expect(communications.parentMessages(foreign.parentIdentity.id, current.school.id, current.student.id)).rejects.toMatchObject({ status: 404 });
    await expect(
      communications.parentSendMessage(foreign.parentIdentity.id, current.school.id, current.student.id, uuid(), uuid(), { body: "x" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      communications.teacherSendMessage(current.identity.id, current.school.id, current.student.id, uuid(), uuid(), { classId: current.classroom.id, body: " " }),
    ).rejects.toMatchObject({ status: 400 });

    await expect(attendance.teacherOperation(current.identity.id, current.school.id, operationId)).resolves.toMatchObject({ id: operationId });
    await expect(attendance.parentOperation(current.parentIdentity.id, current.school.id, reply)).resolves.toMatchObject({ id: reply });
    await expect(attendance.teacherOperation(foreign.identity.id, current.school.id, operationId)).rejects.toBeDefined();
  });

  it("refuses messaging without the capability", async () => {
    const current = await graph(["DAILY_JOURNAL_WRITE"]);
    await expect(communications.teacherThreads(current.identity.id, current.school.id, current.classroom.id)).rejects.toMatchObject({ status: 403 });
  });

  it("puts class notes and teacher messages in the Parent inbox and clears message events on read", async () => {
    const current = await graph();
    vi.spyOn(communications as any, "today").mockReturnValue(today);
    vi.spyOn(attendance as any, "now").mockReturnValue({ day: today, time: "09:00" });
    const body = { classId: current.classroom.id, noteDate: today, text: "Cả lớp đi dã ngoại.", mediaIds: [] as string[] };
    await communications.saveClassNote(current.identity.id, current.school.id, uuid(), uuid(), body);
    await communications.saveClassNote(current.identity.id, current.school.id, uuid(), uuid(), { ...body, text: "Sửa lại" });
    await communications.teacherSendMessage(current.identity.id, current.school.id, current.student.id, uuid(), uuid(), { classId: current.classroom.id, body: "Chào chị" });
    const inbox = await attendance.parentInbox(current.parentIdentity.id, current.school.id);
    expect(inbox.data.map((event) => [event.eventType, event.text, event.unread]).sort()).toEqual([
      ["CLASS_NOTE", "Lớp Mầm có bản tin mới", true],
      ["MESSAGE", "Giáo viên lớp Mầm gửi tin nhắn mới", true],
    ]);
    const note = inbox.data.find((event) => event.eventType === "CLASS_NOTE")!;
    await expect(attendance.openParentInbox(current.parentIdentity.id, current.school.id, note.id)).resolves.toEqual({ studentId: current.student.id, date: today, eventType: "CLASS_NOTE" });
    await communications.parentReadMessages(current.parentIdentity.id, current.school.id, current.student.id);
    expect((await attendance.parentInbox(current.parentIdentity.id, current.school.id)).unreadCount).toBe(0);
  });

  it("pushes inbox events to linked Parents and parent messages to the Class teachers, once, only to authorized devices", async () => {
    process.env.VAPID_PUBLIC_KEY = "BPublicKeyForTestsOnly";
    process.env.VAPID_PRIVATE_KEY = "privateKeyForTestsOnly";
    try {
      const current = await graph();
      vi.spyOn(communications as any, "today").mockReturnValue(today);
      const keys = { p256dh: "B".repeat(87), auth: "a".repeat(22) };
      const parentEndpoint = `https://fcm.googleapis.com/fcm/send/test-${uuid()}`;
      const teacherEndpoint = `https://fcm.googleapis.com/fcm/send/test-${uuid()}`;
      await expect(push.subscribe("PARENT", current.parentIdentity.id, current.school.id, { endpoint: "https://evil.example.com/x", keys })).rejects.toMatchObject({ status: 400 });
      await expect(push.subscribe("PARENT", current.identity.id, current.school.id, { endpoint: parentEndpoint, keys })).rejects.toMatchObject({ status: 404 });
      await push.subscribe("PARENT", current.parentIdentity.id, current.school.id, { endpoint: parentEndpoint, keys });
      await push.subscribe("TEACHER", current.identity.id, current.school.id, { endpoint: teacherEndpoint, keys });
      const delivered: Array<[string, PushMessage]> = [];
      push.transport = async (subscription, message) => { delivered.push([subscription.endpoint, message]); };
      await push.dispatch();
      delivered.length = 0;

      await communications.teacherSendMessage(current.identity.id, current.school.id, current.student.id, uuid(), uuid(), { classId: current.classroom.id, body: "Chào chị" });
      await communications.parentSendMessage(current.parentIdentity.id, current.school.id, current.student.id, uuid(), uuid(), { body: "Dạ cô" });
      await push.dispatch();
      expect(delivered).toEqual([
        [parentEndpoint, { title: "Bé An", body: "Giáo viên lớp Mầm gửi tin nhắn mới", url: "/messages", tag: `message-${current.student.id}` }],
        [teacherEndpoint, { title: "Tin nhắn phụ huynh", body: "Mẹ của Bé An gửi tin nhắn mới", url: `/schools/${current.school.slug}/messages?student=${current.student.id}`, tag: `message-${current.student.id}` }],
      ]);
      delivered.length = 0;
      await push.dispatch();
      expect(delivered).toEqual([]);

      await prisma.studentParent.updateMany({ where: { schoolId: current.school.id }, data: { status: "REVOKED", revokedAt: new Date() } });
      await communications.teacherSendMessage(current.identity.id, current.school.id, current.student.id, uuid(), uuid(), { classId: current.classroom.id, body: "Còn đó không?" });
      push.transport = async () => { throw Object.assign(new Error("gone"), { statusCode: 410 }); };
      await push.dispatch();
      expect(await prisma.pushSubscription.count({ where: { endpoint: parentEndpoint } })).toBe(1);
      await push.unsubscribe("TEACHER", current.identity.id, { endpoint: teacherEndpoint });
      expect(await prisma.pushSubscription.count({ where: { endpoint: teacherEndpoint } })).toBe(0);
    } finally {
      delete process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;
    }
  });
});
