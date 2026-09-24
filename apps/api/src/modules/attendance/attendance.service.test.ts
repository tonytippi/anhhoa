import { describe, expect, it, vi } from 'vitest';
import { AttendanceService } from './attendance.service.js';

const school = '11111111-1111-4111-8111-111111111111';
const student = '22222222-2222-4222-8222-222222222222';
const operation = '33333333-3333-4333-8333-333333333333';
const key = '44444444-4444-4444-8444-444444444444';
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

function service(overrides: Record<string, unknown> = {}) {
  const transaction = {
    $queryRaw: vi.fn(),
    parentProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'parent' }) },
    school: { findFirst: vi.fn().mockResolvedValue({ id: school }) },
    studentParent: { findFirst: vi.fn().mockResolvedValue({ id: 'link' }) },
    studentEnrollment: { findFirst: vi.fn().mockResolvedValue({ id: 'enrollment' }) },
    leavePolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), nextDayDeadlineLocalTime: '15:00' }) },
    schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [] }) },
    operation: { create: vi.fn().mockResolvedValue({ id: operation }), update: vi.fn().mockResolvedValue({ id: operation, status: 'COMPLETED', outcome: {} }) },
    leaveRequest: { create: vi.fn() }, leaveDaySource: { createMany: vi.fn(), findMany: vi.fn().mockResolvedValue([]) }, leaveDaySourceExclusion: { createMany: vi.fn() },
    auditRecord: { create: vi.fn() },
    evidenceReference: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    class: { findMany: vi.fn().mockResolvedValue([]) },
    enrollmentClassAssignment: { findMany: vi.fn().mockResolvedValue([]) },
    attendanceRecord: { findMany: vi.fn().mockResolvedValue([]) },
    dailyJournalPolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01') }) },
    dailyJournal: { findMany: vi.fn().mockResolvedValue([]), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    dailyJournalMedia: { findMany: vi.fn(), create: vi.fn() },
    dailyJournalVersion: { create: vi.fn() },
  };
  const prisma = {
    parentProfile: { findFirst: vi.fn().mockResolvedValue({ id: 'parent' }) }, school: { findFirst: vi.fn().mockResolvedValue({ id: school }) }, studentParent: { findFirst: vi.fn().mockResolvedValue({ id: 'link' }), findMany: vi.fn().mockResolvedValue([{ studentId: student }]) }, operation: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: operation }), update: vi.fn().mockResolvedValue({ id: operation, status: 'COMPLETED', outcome: {} }) }, leaveRequest: { findFirst: vi.fn(), findMany: vi.fn().mockResolvedValue([]), create: vi.fn(), update: vi.fn() }, leaveDaySource: { findMany: vi.fn().mockResolvedValue([]), createMany: vi.fn() }, leaveDaySourceExclusion: { createMany: vi.fn() }, schoolMembership: { findFirst: vi.fn().mockResolvedValue({ id: 'member', boundStaffProfile: { id: 'staff-profile' } }) }, staffClassAssignment: { findMany: vi.fn().mockResolvedValue([]) }, evidenceReference: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn().mockResolvedValue({ count: 0 }) }, $transaction: vi.fn(async (work) => work({ ...transaction, ...overrides })), ...overrides,
  };
  return { prisma, attendance: new AttendanceService(prisma as never) };
}

describe('AttendanceService leave matrix', () => {
  it('accepts only byte-verified journal images and rejects spoofed media before authorization or persistence', async () => {
    const { attendance, prisma } = service();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((attendance as any).journalMime('image/png', png)).toBe(true);
    expect((attendance as any).journalMime('image/png', Buffer.from('not-a-png'))).toBe(false);
    await expect(attendance.uploadDailyJournalMedia('teacher', school, key, operation, student, student, '2026-02-09', 'image/png', Buffer.from('spoofed'))).rejects.toMatchObject({ response: { fieldErrors: { media: expect.any(String) } } });
    expect((prisma as any).schoolMembership.findFirst).not.toHaveBeenCalled();
  });
  it('requires the current operating day, effective policy, and placed enrollment before journal persistence', async () => {
    const { attendance } = service();
    vi.spyOn(attendance as any, 'now').mockReturnValue({ day: '2026-02-09', time: '09:00' });
    const facts = { schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ holidays: [] }) }, dailyJournalPolicy: { findFirst: vi.fn().mockResolvedValue(null) }, studentEnrollment: { findFirst: vi.fn() } };
    await expect((attendance as any).journalFacts(facts, school, 'class', student, '2026-02-08')).rejects.toMatchObject({ response: { code: 'JOURNAL_DATE_NOT_CURRENT' } });
    await expect((attendance as any).journalFacts(facts, school, 'class', student, '2026-02-09')).rejects.toMatchObject({ response: { code: 'DAILY_JOURNAL_POLICY_NOT_CONFIGURED' } });
    facts.dailyJournalPolicy.findFirst.mockResolvedValue({ effectiveFrom: day('2026-01-01') });
    facts.studentEnrollment.findFirst.mockResolvedValue(null);
    await expect((attendance as any).journalFacts(facts, school, 'class', student, '2026-02-09')).rejects.toMatchObject({ response: { code: 'ROSTER_CONFLICT' } });
  });
  it('enforces the effective journal MIME and byte-size policy instead of fixed upload limits', async () => {
    const { attendance } = service();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(() => (attendance as any).assertJournalMediaPolicy('image/png', png, { acceptedImageMimeTypes: ['PNG'], maxImageSizeBytes: 7 })).toThrow();
    expect(() => (attendance as any).assertJournalMediaPolicy('image/png', png, { acceptedImageMimeTypes: ['JPEG'], maxImageSizeBytes: 10 })).toThrow();
    expect(() => (attendance as any).assertJournalMediaPolicy('image/png', png, { acceptedImageMimeTypes: ['PNG'], maxImageSizeBytes: 10 })).not.toThrow();
  });
  it('expires each eligible evidence once at the two-calendar-month boundary', async () => {
    const { attendance, prisma } = service({ evidenceReference: { findMany: vi.fn().mockResolvedValue([{ id: operation, schoolId: school, confirmedAt: day('2026-01-31') }]), updateMany: vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 }) }, auditRecord: { create: vi.fn() } });
    await expect(attendance.cleanupExpiredEvidence(day('2026-03-31'))).resolves.toEqual({ deleted: 1 });
    expect((prisma as any).$transaction).toHaveBeenCalled();
    await expect(attendance.cleanupExpiredEvidence(day('2026-03-30'))).resolves.toEqual({ deleted: 0 });
  });
  it('requires policy evidence for PRESENT, validates opaque School evidence, and permits ABSENT without it', async () => {
    const { attendance } = service();
    const tx = { schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [] }) }, attendancePolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), photoEvidenceMode: 'REQUIRED' }) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue({ id: 'enrollment' }) }, evidenceReference: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect((attendance as any).attendanceFacts(tx, school, 'class', student, '2026-02-09', 'PRESENT', null)).rejects.toMatchObject({ response: { fieldErrors: { evidenceId: expect.any(String) } } });
    await expect((attendance as any).attendanceFacts(tx, school, 'class', student, '2026-02-09', 'PRESENT', operation)).rejects.toMatchObject({ response: { fieldErrors: { evidenceId: expect.any(String) } } });
    await expect((attendance as any).attendanceFacts(tx, school, 'class', student, '2026-02-09', 'ABSENT', null)).resolves.toMatchObject({ policy: expect.anything() });
  });
  it('requires valid handover evidence without reading a Class assignment and emits a minimal source payload', async () => {
    const { attendance } = service();
    const tx = { schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [] }) }, handoverPolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), photoEvidenceMode: 'REQUIRED' }) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue({ id: 'enrollment' }) }, evidenceReference: { findFirst: vi.fn().mockResolvedValue(null) }, notificationSourceEvent: { create: vi.fn() } };
    await expect((attendance as any).handoverFacts(tx, school, student, '2026-02-09', null, { id: 'member', staffProfileId: 'staff' })).rejects.toMatchObject({ response: { fieldErrors: { evidenceId: expect.any(String) } } });
    tx.handoverPolicy.findFirst.mockResolvedValueOnce({ effectiveFrom: day('2026-01-01'), photoEvidenceMode: 'OPTIONAL' });
    await expect((attendance as any).handoverFacts(tx, school, student, '2026-02-09', null, { id: 'member', staffProfileId: 'staff' })).resolves.toMatchObject({ policy: expect.anything() });
    const pickedUpAt = new Date('2026-02-09T10:00:00.000Z');
    await (attendance as any).writeHandoverNotificationSource(tx, school, operation, student, '2026-02-09', pickedUpAt);
    expect(tx.notificationSourceEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sourceType: 'HANDOVER', payload: { schoolId: school, studentId: student, handoverOn: '2026-02-09', pickedUpAt: pickedUpAt.toISOString() } }) });
  });

  it('rejects non-operating attendance before a record or operation can be written', async () => {
    const { attendance } = service();
    const tx = { schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [] }) }, attendancePolicy: { findFirst: vi.fn() }, studentEnrollment: { findFirst: vi.fn() }, evidenceReference: { findFirst: vi.fn() } };
    await expect((attendance as any).attendanceFacts(tx, school, 'class', student, '2026-02-08', 'ABSENT', null)).rejects.toMatchObject({ response: { code: 'NON_OPERATING_DAY' } });
    expect(tx.attendancePolicy.findFirst).not.toHaveBeenCalled();
  });

  it('projects actual attendance ahead of confirmed leave and only uses ON_LEAVE without a record', async () => {
    const record = { studentId: student, state: 'PRESENT', evidenceId: null, updatedAt: day('2026-02-09') };
    const { attendance } = service({
      schoolMembership: { findFirst: vi.fn().mockResolvedValue({ id: 'member', boundStaffProfile: { id: 'staff-profile' } }) },
      staffClassAssignment: { findFirst: vi.fn().mockResolvedValue({ id: 'assignment' }) },
    schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ holidays: [] }) },
      attendancePolicy: { findFirst: vi.fn().mockResolvedValue({ photoEvidenceMode: 'OPTIONAL' }) },
      studentEnrollment: { findMany: vi.fn().mockResolvedValue([{ studentId: student, student: { id: student, fullName: 'Bé An' } }]) },
      attendanceRecord: { findMany: vi.fn().mockResolvedValue([record]) },
      leaveRequestDay: { findMany: vi.fn().mockResolvedValue([{ leaveRequest: { studentId: student } }]) },
    });
    await expect(attendance.teacherRoster('teacher', school, 'class', '2026-02-09')).resolves.toMatchObject({ students: [{ studentId: student, state: 'PRESENT' }] });
  });
  it('uses the roster precedence for the operational queue and returns a successful empty non-operating queue', async () => {
    const classroom = { id: 'class-a', name: 'Mầm A' };
    const placement = { classId: classroom.id, enrollment: { student: { id: student, fullName: 'Bé An', studentCode: 'AT-1' } } };
    const { attendance, prisma } = service({
      schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ holidays: [] }) },
      class: { findMany: vi.fn().mockResolvedValue([classroom]) },
      enrollmentClassAssignment: { findMany: vi.fn().mockResolvedValue([placement]) },
    attendanceRecord: { findMany: vi.fn().mockResolvedValue([{ studentId: student }]) },
      leaveRequest: { findMany: vi.fn().mockResolvedValue([{ studentId: student, status: 'PENDING' }]) },
    });
    await expect((attendance as any).queueRows(school, '2026-02-09')).resolves.toMatchObject({ operating: true, classes: [{ attendanceGapCount: 0, pendingLeaveCount: 1 }] });
    expect((prisma as any).$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'RepeatableRead' });
    await expect((attendance as any).queueRows(school, '2026-02-08')).resolves.toMatchObject({ operating: false, classes: [] });
  });
  it('keeps a pending leave out of attendance gaps while returning it as its own queue item', async () => {
    const classroom = { id: 'class-a', name: 'Mầm A' };
    const placement = { classId: classroom.id, enrollment: { student: { id: student, fullName: 'Bé An', studentCode: 'AT-1' } } };
    const { attendance } = service({ schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ holidays: [] }) }, class: { findMany: vi.fn().mockResolvedValue([classroom]) }, enrollmentClassAssignment: { findMany: vi.fn().mockResolvedValue([placement]) }, attendanceRecord: { findMany: vi.fn().mockResolvedValue([]) }, leaveRequest: { findMany: vi.fn().mockResolvedValue([{ studentId: student, status: 'PENDING' }]) } });
    await expect((attendance as any).queueRows(school, '2026-02-09')).resolves.toMatchObject({ classes: [{ attendanceGapCount: 0, pendingLeaveCount: 1 }] });
  });
  it('uses the HCM submission day policy, not the requested range start', async () => {
    const { attendance } = service(); vi.spyOn(attendance as any, 'now').mockReturnValue({ day: '2026-02-10', time: '15:00' });
    const tx = { leavePolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-02-01'), nextDayDeadlineLocalTime: '15:00' }) }, studentParent: { findFirst: vi.fn().mockResolvedValue({}) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue({}) }, schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [] }) } };
    await (attendance as any).leaveCreateFacts(tx, school, 'parent', student, '2026-01-01', '2026-01-02');
    expect(tx.leavePolicy.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ effectiveFrom: { lte: day('2026-02-10') } }) }));
  });

  it('excludes Sunday and holiday facts and rejects a range with no operating date before an operation', async () => {
    const { attendance } = service(); vi.spyOn(attendance as any, 'now').mockReturnValue({ day: '2026-02-06', time: '12:00' });
    const tx = { leavePolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), nextDayDeadlineLocalTime: '15:00' }) }, studentParent: { findFirst: vi.fn().mockResolvedValue({}) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue({}) }, schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), holidays: [{ startsOn: day('2026-02-09'), endsOn: day('2026-02-09') }] }) } };
    await expect((attendance as any).leaveCreateFacts(tx, school, 'parent', student, '2026-02-08', '2026-02-09')).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });

  it('denies missing policy and revoked or ineligible parent/student links before writes', async () => {
    const { attendance } = service(); const tx = { studentParent: { findFirst: vi.fn().mockResolvedValue(null) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect((attendance as any).leaveCreateFacts(tx, school, 'parent', student, '2026-02-09', '2026-02-09')).rejects.toMatchObject({ response: { code: 'CAPABILITY_DENIED' } });
    const noPolicy = { ...tx, studentParent: { findFirst: vi.fn().mockResolvedValue({}) }, studentEnrollment: { findFirst: vi.fn().mockResolvedValue({}) }, leavePolicy: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect((attendance as any).leaveCreateFacts(noPolicy, school, 'parent', student, '2026-02-09', '2026-02-09')).rejects.toMatchObject({ response: { code: 'LEAVE_POLICY_NOT_CONFIGURED' } });
  });

  it('returns only requests whose leave day overlaps both teacher assignment and student placement', async () => {
    const visible = { id: 'visible', studentId: student, status: 'PENDING', createdAt: new Date(), rejectedReason: null, decidedAt: null, days: [{ operatingOn: day('2026-02-09') }], student: { enrollments: [{ effectiveFrom: day('2026-02-01'), endedOn: null, classAssignments: [{ classId: 'class-a', effectiveFrom: day('2026-02-01'), effectiveTo: null }] }] } };
    const hidden = { ...visible, id: 'hidden', student: { enrollments: [{ classAssignments: [{ classId: 'class-b', effectiveFrom: day('2026-02-01'), effectiveTo: null }] }] } };
    const { attendance } = service({ staffClassAssignment: { findMany: vi.fn().mockResolvedValue([{ classId: 'class-a', effectiveFrom: day('2026-02-01'), effectiveTo: null }]) }, leaveRequest: { findMany: vi.fn().mockResolvedValue([visible, hidden]) } });
    await expect(attendance.teacherList('teacher', school)).resolves.toMatchObject([{ id: 'visible' }]);
  });

  it('reconciles only the parent actor operation while its StudentParent link remains active', async () => {
    const { attendance, prisma } = service({ operation: { findFirst: vi.fn().mockResolvedValue({ id: operation, status: 'COMPLETED', outcome: { studentId: student } }) } });
    await expect(attendance.parentOperation('parent-identity', school, operation)).resolves.toMatchObject({ id: operation, status: 'COMPLETED' });
    expect(prisma.operation.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ actorType: 'PARENT_PROFILE', actorReference: 'parent' }) }));
    (prisma.studentParent.findFirst as any).mockResolvedValueOnce(null);
    await expect(attendance.parentOperation('parent-identity', school, operation)).rejects.toMatchObject({ response: { code: 'OPERATION_NOT_FOUND' } });
  });

  it('requires an active bound teacher profile, fails missing calendars, and bounds ranges', async () => {
    const denied = service({ schoolMembership: { findFirst: vi.fn().mockResolvedValue({ id: 'member', boundStaffProfile: null }) } }).attendance;
    await expect(denied.teacherList('teacher', school)).rejects.toMatchObject({ response: { code: 'CAPABILITY_DENIED' } });
    const { attendance } = service(); const tx = { studentParent: { findFirst: vi.fn().mockResolvedValue({}) }, leavePolicy: { findFirst: vi.fn().mockResolvedValue({ effectiveFrom: day('2026-01-01'), nextDayDeadlineLocalTime: '15:00' }) }, schoolCalendarVersion: { findFirst: vi.fn().mockResolvedValue(null) } };
    await expect((attendance as any).leaveCreateFacts(tx, school, 'parent', student, '2026-02-09', '2026-02-09')).rejects.toMatchObject({ response: { code: 'SCHOOL_CALENDAR_NOT_CONFIGURED' } });
    await expect(attendance.create('parent-identity', school, key, operation, { studentId: student, startsOn: '2026-01-01', endsOn: '2026-04-15' })).rejects.toMatchObject({ response: { fieldErrors: { endsOn: expect.any(String) } } });
  });

  it('rejects idempotency fingerprint changes and terminal decisions, requiring reject reasons', async () => {
    const { attendance, prisma } = service({ operation: { findFirst: vi.fn().mockResolvedValue({ id: operation, fingerprint: 'other', status: 'COMPLETED', outcome: {} }) } });
    await expect(attendance.create('parent-identity', school, key, operation, { studentId: student, startsOn: '2026-02-09', endsOn: '2026-02-09' })).rejects.toMatchObject({ response: { code: 'IDEMPOTENCY_CONFLICT' } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(attendance.decide('admin', school, operation, 'REJECTED', key, operation, {})).rejects.toMatchObject({ response: { code: 'VALIDATION_ERROR' } });
  });
  it('requires the active audited leave-decision capability before a decision lookup or write', async () => {
    const { attendance, prisma } = service({ schoolMembership: { findFirst: vi.fn().mockResolvedValue(null) } });
    await expect(attendance.decide('admin', school, operation, 'APPROVED', key, operation, {})).rejects.toMatchObject({ response: { code: 'CAPABILITY_DENIED' } });
    expect(prisma.leaveRequest.findFirst).not.toHaveBeenCalled();
  });
  it('exports every durable, unexcluded leave-day fact through a stable cursor without Finance fields', async () => {
    const source = { id: operation, studentId: student, operatingOn: day('2026-02-09'), leaveRequestId: operation, leaveStatus: 'APPROVED' };
    const { attendance, prisma } = service({ leaveDaySource: { findMany: vi.fn().mockResolvedValue([source]) } });
    await expect(attendance.leaveDaySources('admin', school)).resolves.toEqual({ data: [{ schoolId: school, studentId: student, operatingOn: '2026-02-09', leaveRequestId: operation, leaveStatus: 'APPROVED', eligible: true }], nextCursor: null });
    expect((prisma.leaveDaySource.findMany as any)).toHaveBeenCalledWith(expect.objectContaining({ where: { schoolId: school, exclusions: { none: {} } }, take: 101 }));
    const excluded = service({ leaveDaySource: { findMany: vi.fn().mockResolvedValue([]) } }).attendance;
    await expect(excluded.leaveDaySources('admin', school)).resolves.toEqual({ data: [], nextCursor: null });
  });
  it('issues at most one approved fact per student operating day and appends PRESENT exclusions', async () => {
    const source = { id: operation };
    const { attendance } = service();
    const tx = { leaveDaySource: { createMany: vi.fn(), findUnique: vi.fn().mockResolvedValue(source) }, leaveDaySourceExclusion: { createMany: vi.fn() }, attendanceRecord: { findMany: vi.fn().mockResolvedValue([]) } };
    await (attendance as any).issueLeaveDaySources(tx, { schoolId: school, id: operation, studentId: student, status: 'APPROVED', days: [{ operatingOn: day('2026-02-09') }] });
    await (attendance as any).excludeLeaveDaySources(tx, school, student, '2026-02-09', key);
    expect(tx.leaveDaySource.createMany).toHaveBeenCalledWith(expect.objectContaining({ data: [expect.objectContaining({ schoolId: school, studentId: student, operatingOn: day('2026-02-09') })], skipDuplicates: true }));
    expect(tx.leaveDaySource.findUnique).toHaveBeenCalledWith({ where: { schoolId_studentId_operatingOn: { schoolId: school, studentId: student, operatingOn: day('2026-02-09') } }, select: { id: true } });
    expect(tx.leaveDaySourceExclusion.createMany).toHaveBeenCalledWith({ data: [{ schoolId: school, leaveDaySourceId: operation, attendanceRecordId: key }], skipDuplicates: true });
  });
});
