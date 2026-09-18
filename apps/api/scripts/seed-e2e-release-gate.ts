import { PrismaService } from '../src/modules/identity/prisma.service.js';

const prisma = new PrismaService();
const emails = ['release-gate-operator@example.com', 'release-gate-admin@example.com', 'release-gate-teacher@example.com', 'release-gate-parent@example.com'];
const slugs = ['release-gate-a', 'release-gate-b'];

try {
  await prisma.$transaction(async (tx) => {
    // Lock fixture setup so parallel E2E invocations cannot interleave a partial graph.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(9162027)`;
    const fixtureSchools = await tx.school.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
    const schoolIds = fixtureSchools.map((school) => school.id);
    const fixtureIdentities = await tx.userIdentity.findMany({ where: { emailNormalized: { in: emails } }, select: { id: true } });
    const identityIds = fixtureIdentities.map((identity) => identity.id);
    await tx.auditRecord.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.operation.deleteMany({ where: { OR: [{ schoolId: { in: schoolIds } }, { actorIdentityId: { in: identityIds } }] } });
    await tx.studentParent.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.student.deleteMany({ where: { schoolId: { in: schoolIds } } });
    await tx.parentProfile.deleteMany({ where: { emailNormalized: emails[3] } });
    await tx.schoolRoleGrant.deleteMany({ where: { schoolId: { in: schoolIds } } });
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
      for (const [userIdentityId, role] of [[admin.id, 'SCHOOL_ADMIN'], [teacher.id, 'CLASS_TEACHER']] as const) {
        const membership = await tx.schoolMembership.create({ data: { schoolId: school.id, userIdentityId } });
        await tx.schoolRoleGrant.create({ data: { schoolId: school.id, membershipId: membership.id, role } });
      }
      const student = await tx.student.create({ data: { schoolId: school.id, studentCode: `RG${index + 1}-1`, fullName: index ? 'Bé Bình' : 'Bé An', dateOfBirth: new Date('2022-01-01T00:00:00.000Z') } });
      await tx.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parentProfile.id } });
    }
  });
} finally {
  await prisma.$disconnect();
}
