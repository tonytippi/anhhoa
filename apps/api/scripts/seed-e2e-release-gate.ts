import { PrismaService } from '../src/modules/identity/prisma.service.js';

const prisma = new PrismaService();
const emails = ['release-gate-operator@example.com', 'release-gate-admin@example.com', 'release-gate-teacher@example.com', 'release-gate-parent@example.com'];
const slugs = ['release-gate-a', 'release-gate-b'];

try {
  await prisma.$transaction(async (tx) => {
    // Lock fixture setup so parallel E2E invocations cannot interleave a partial graph.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(9162027)`;
    // This transaction rebuilds deterministic test data; production history remains append-only.
    await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
    await tx.$executeRaw`SELECT set_config('passionedu.allow_daily_journal_history_cleanup', 'on', true)`;
    await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
    const fixtureSchools = await tx.school.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
    const schoolIds = fixtureSchools.map((school) => school.id);
    const fixtureIdentities = await tx.userIdentity.findMany({ where: { emailNormalized: { in: emails } }, select: { id: true } });
    const identityIds = fixtureIdentities.map((identity) => identity.id);
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.notificationSourceEvent.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.leaveDaySourceExclusion.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.leaveDaySource.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.leaveRequestDay.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.leaveRequest.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.attendanceRecord.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.handoverRecord.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.evidenceReference.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.dailyJournalVersionMedia.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.dailyJournalVersion.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.dailyJournalMedia.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.dailyJournal.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.attendancePolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.handoverPolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.dailyJournalPolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.leavePolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.schoolCalendarVersion.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.issuedPromotionApplication.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.invoiceLine.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.invoice.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.collectionRunGenerationItem.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.collectionRunGeneration.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.collectionRunSelection.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.collectionRunLifecycleTransition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.$executeRawUnsafe("SET LOCAL passionedu.allow_collection_run_template_cleanup = 'on'");
    await tx.collectionRunTemplateLine.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.collectionRun.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.studentPromotionAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.promotionPolicyTarget.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.promotionPolicyVersion.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.promotionPolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.receivableLifecycleTransition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.receivable.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.receivableGroupLifecycleTransition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.receivableGroup.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.bankAccountLifecycleTransition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.bankAccount.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.financePolicy.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.staffClassAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.enrollmentClassAssignment.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.studentEnrollmentLifecycleTransition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.studentEnrollment.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.class.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.schoolYear.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.operation.deleteMany({ where: { OR: [{ schoolId: { in: schoolIds } }, { actorIdentityId: { in: identityIds } }] } });
    await tx.studentParent.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.student.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.parentProfile.deleteMany({ where: { emailNormalized: emails[3] } });
    await tx.staffProfile.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.positionCapabilityGrant.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.schoolPosition.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.schoolMembership.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.school.deleteMany({ where: { id: { in: schoolIds } } });
    await tx.platformOperatorGrant.deleteMany({ where: { userIdentityId: { in: identityIds } } });
    await tx.userIdentity.deleteMany({ where: { id: { in: identityIds } } });

    const operator = await tx.userIdentity.create({ data: { emailNormalized: emails[0], googleSubject: 'release-gate-operator' } });
    const admin = await tx.userIdentity.create({ data: { emailNormalized: emails[1], googleSubject: 'release-gate-admin' } });
    const teacher = await tx.userIdentity.create({ data: { emailNormalized: emails[2], googleSubject: 'release-gate-teacher' } });
    const parent = await tx.userIdentity.create({ data: { emailNormalized: emails[3], googleSubject: 'release-gate-parent' } });
    const parentProfile = await tx.parentProfile.upsert({ where: { emailNormalized: emails[3] }, create: { emailNormalized: emails[3], fullName: 'Phụ huynh Release', phone: '0900000000', userIdentityId: parent.id, boundAt: new Date() }, update: { fullName: 'Phụ huynh Release', phone: '0900000000', userIdentityId: parent.id, boundAt: new Date() } });
    await tx.platformOperatorGrant.create({ data: { userIdentityId: operator.id } });
    for (const [index, [name, slug]] of [['Release Gate A', slugs[0]], ['Release Gate B', slugs[1]] as const].entries()) {
      const school = await tx.school.create({ data: { name, slug, studentCodePrefix: `RG${index + 1}` } });
      let adminMembershipId = '';
      for (const [userIdentityId, code, capability] of [[admin.id, 'ADMIN', 'ROSTER_MANAGE'], [teacher.id, 'GIAO_VIEN', 'ATTENDANCE_WRITE']] as const) {
        const membership = await tx.schoolMembership.create({ data: { schoolId: school.id, userIdentityId } });
        const position = await tx.schoolPosition.create({ data: { schoolId: school.id, code, name: code === 'ADMIN' ? 'Quản lý trường' : 'Giáo viên' } });
        await tx.positionCapabilityGrant.createMany({ data: ['SCHOOL_CONTEXT_READ', capability, ...(userIdentityId === teacher.id ? ['HANDOVER_WRITE', 'DAILY_JOURNAL_WRITE', 'OPERATIONAL_QUEUE_READ'] : []), ...(userIdentityId === admin.id ? ['FINANCE_MANAGE'] : [])].map((value) => ({ schoolId: school.id, positionId: position.id, capability: value })) });
        const identity = userIdentityId === admin.id ? admin : teacher;
        await tx.staffProfile.create({ data: { schoolId: school.id, fullName: identity.emailNormalized, email: identity.emailNormalized, phone: '0900000000', dateOfBirth: new Date('1990-01-01T00:00:00.000Z'), gender: 'Khác', address: 'Release fixture', primaryPositionId: position.id, schoolMembershipId: membership.id, boundAt: new Date(), boundByMembershipId: membership.id } });
        if (userIdentityId === admin.id) adminMembershipId = membership.id;
      }
      const student = await tx.student.create({ data: { schoolId: school.id, studentCode: `RG${index + 1}-1`, fullName: index ? 'Bé Bình' : 'Bé An', dateOfBirth: new Date('2022-01-01T00:00:00.000Z') } });
      await tx.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parentProfile.id } });
      const year = await tx.schoolYear.create({ data: { schoolId: school.id, name: 'Năm học Release 2026', startsOn: new Date('2026-01-01T00:00:00.000Z'), endsOn: new Date('2027-01-01T00:00:00.000Z') } });
      const classroom = await tx.class.create({ data: { id: index ? '00000000-0000-4000-8000-000000000002' : '00000000-0000-4000-8000-000000000001', schoolId: school.id, schoolYearId: year.id, name: `Mầm Release ${index + 1}` } });
      const enrollment = await tx.studentEnrollment.create({ data: { schoolId: school.id, studentId: student.id, schoolYearId: year.id, classId: classroom.id, lifecycle: 'ENROLLED', effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className: classroom.name } });
      await tx.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Release Finance fixture' } });
      if (index === 0) {
        const secondStudent = await tx.student.create({ data: { schoolId: school.id, studentCode: 'RG1-2', fullName: 'Bé Bình', dateOfBirth: new Date('2022-02-01T00:00:00.000Z') } });
        const secondEnrollment = await tx.studentEnrollment.create({ data: { schoolId: school.id, studentId: secondStudent.id, schoolYearId: year.id, classId: classroom.id, lifecycle: 'ENROLLED', effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className: classroom.name } });
        await tx.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: secondEnrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Release Finance fixture second Student' } });
      }
      const teacherMembership = await tx.schoolMembership.findFirstOrThrow({ where: { schoolId: school.id, userIdentityId: teacher.id } });
      const teacherStaff = await tx.staffProfile.findFirstOrThrow({ where: { schoolId: school.id, schoolMembershipId: teacherMembership.id } });
      await tx.staffClassAssignment.create({ data: { schoolId: school.id, staffProfileId: teacherStaff.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Release attendance fixture', schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className: classroom.name } });
      await tx.schoolCalendarVersion.create({ data: { schoolId: school.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), actorIdentityId: admin.id, membershipId: adminMembershipId } });
      await tx.attendancePolicy.create({ data: { schoolId: school.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), photoEvidenceMode: 'OPTIONAL', reason: 'Release attendance fixture', actorIdentityId: admin.id, membershipId: adminMembershipId } });
      await tx.handoverPolicy.create({ data: { schoolId: school.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), photoEvidenceMode: 'OPTIONAL', reason: 'Release handover fixture', actorIdentityId: admin.id, membershipId: adminMembershipId } });
      await tx.dailyJournalPolicy.create({ data: { schoolId: school.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), reason: 'Release daily journal fixture', parentRetentionDaysAfterEnrollmentEnded: 30, acceptedImageMimeTypes: ['JPEG', 'PNG', 'WEBP'], maxImageSizeBytes: 10 * 1024 * 1024, imageCountLimit: null, actorIdentityId: admin.id, membershipId: adminMembershipId } });
      await tx.leaveRequest.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parentProfile.id, status: 'PENDING', policyEffectiveFrom: new Date('2026-01-01T00:00:00.000Z'), policyDeadlineLocalTime: '15:00' } }).then((leave) => tx.leaveRequestDay.create({ data: { schoolId: school.id, leaveRequestId: leave.id, operatingOn: new Date('2026-09-24T00:00:00.000Z'), calendarEffectiveFrom: new Date('2026-01-01T00:00:00.000Z') } }));
      const operation = await tx.operation.create({ data: { schoolId: school.id, membershipId: adminMembershipId, actorIdentityId: admin.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: adminMembershipId, route: 'release-gate-fixture', fingerprint: `release-gate-fixture-${index}`, idempotencyKey: crypto.randomUUID(), status: 'COMPLETED' } });
      await tx.financePolicy.create({ data: { schoolId: school.id, effectiveFrom: new Date('2026-01-01T00:00:00.000Z'), dueDaysAfterIssue: 7, taxTreatment: 'NOT_APPLICABLE', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'DIRECT', reason: 'Release Finance fixture', actorIdentityId: admin.id, membershipId: adminMembershipId } });
      const bankAccount = await tx.bankAccount.create({ data: { schoolId: school.id, receivingBank: `Ngân hàng Release ${index + 1}`, accountNumber: `10000000${index + 1}`, accountHolderName: `Release Gate ${index + 1}`, transferTemplate: '{{studentName}} {{className}}', actorIdentityId: admin.id, membershipId: adminMembershipId } });
      await tx.bankAccountLifecycleTransition.create({ data: { schoolId: school.id, bankAccountId: bankAccount.id, status: 'ACTIVE', actorIdentityId: admin.id, membershipId: adminMembershipId, operationId: operation.id, sequence: 1 } });
      const group = await tx.receivableGroup.create({ data: { schoolId: school.id, name: `Nhóm Release ${index + 1}` } });
      await tx.receivableGroupLifecycleTransition.create({ data: { schoolId: school.id, receivableGroupId: group.id, status: 'ACTIVE', actorIdentityId: admin.id, membershipId: adminMembershipId, operationId: operation.id, sequence: 1 } });
       const receivable = await tx.receivable.create({ data: { schoolId: school.id, groupId: group.id, code: `RG${index + 1}-TUITION`, displayName: `Học phí Release ${index + 1}`, unitLabel: 'tháng', defaultUnitPrice: 150000n } });
       await tx.receivableLifecycleTransition.create({ data: { schoolId: school.id, receivableId: receivable.id, status: 'ACTIVE', actorIdentityId: admin.id, membershipId: adminMembershipId, operationId: operation.id, sequence: 1 } });
      if (index === 0) {
        const policy = await tx.promotionPolicy.create({ data: { schoolId: school.id, name: 'Ưu đãi Release Gate' } });
        const version = await tx.promotionPolicyVersion.create({ data: { schoolId: school.id, policyId: policy.id, version: 1, status: 'DRAFT', discountType: 'PERCENTAGE', discountValue: 10n, priority: 1, stackingMode: 'STACKABLE', effectiveFrom: new Date('2026-09-01T00:00:00.000Z') } });
        await tx.promotionPolicyTarget.create({ data: { schoolId: school.id, versionId: version.id, receivableId: receivable.id } });
        await tx.promotionPolicyVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE' } });
        await tx.studentPromotionAssignment.create({ data: { schoolId: school.id, studentId: student.id, policyId: policy.id, versionId: version.id, effectiveFrom: new Date('2026-09-01T00:00:00.000Z'), reason: 'Ưu đãi Release Gate' } });
      }
    }
  }, { timeout: 30000 });
} finally {
  await prisma.$disconnect();
}
