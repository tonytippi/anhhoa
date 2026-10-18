import { PrismaService } from "../src/modules/identity/prisma.service.js";

// Synthetic language center for the Hướng dẫn screenshots ("Trung tâm Anh ngữ Hoa Mai"); every name and account is invented.
// Runs against the E2E database only: the screenshot config in apps/web/playwright.guides.config.ts points DATABASE_URL there.
// Collection runs, receipts and promotions are made by the screenshot script through the Admin portal.
const prisma = new PrismaService();
const slug = "guide-demo-center";
const adminEmail = "guide-demo-admin@example.com";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const classes = {
  "Starters 1": ["Nguyễn Minh Anh", "Trần Gia Bảo", "Lê Khánh Chi", "Phạm Đức Duy", "Hoàng Bảo Ngọc", "Vũ Hải Đăng"],
  "Starters 2": ["Đặng Thu Hà", "Bùi Quang Huy", "Đỗ Ngọc Khuê", "Ngô Tuấn Kiệt", "Dương Mai Linh"],
  "Movers 1": ["Lý Hoàng Long", "Phan Thảo My", "Trịnh Gia Nam", "Hồ Minh Phúc", "Mai Thanh Tâm"],
  "Flyers 1": ["Cao Quỳnh Trang", "Lưu Đức Trí", "Tạ Phương Uyên", "Kiều Anh Vũ"],
  // A small class that the screenshot script merges into Starters 1 mid-unit, which yields the "Trùng kỳ" lines.
  "Starters 3": ["Võ Nhật Hào", "Châu Bảo Trâm"],
} as const;

try {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT set_config('passionedu.allow_history_cleanup', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('passionedu.allow_daily_journal_history_cleanup', 'on', true)`;
      await tx.$executeRaw`SELECT set_config('passionedu.allow_collection_run_template_cleanup', 'on', true)`;
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = replica");
      // Rebuild from scratch: with triggers off, every School-scoped row of the previous demo can go in one sweep.
      const previous = await tx.school.findUnique({ where: { slug }, select: { id: true } });
      if (previous) {
        const tables = await tx.$queryRaw<{ table_name: string }[]>`SELECT table_name FROM information_schema.columns WHERE table_schema = current_schema() AND column_name = 'schoolId' AND table_name <> 'School'`;
        for (const { table_name } of tables) await tx.$executeRawUnsafe(`DELETE FROM "${table_name}" WHERE "schoolId" = $1::uuid`, previous.id);
        await tx.school.delete({ where: { id: previous.id } });
      }
      const identity = await tx.userIdentity.findUnique({ where: { emailNormalized: adminEmail }, select: { id: true } });
      if (identity) {
        await tx.operation.deleteMany({ where: { actorIdentityId: identity.id } });
        await tx.userIdentity.delete({ where: { id: identity.id } });
      }
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");

      const admin = await tx.userIdentity.create({ data: { emailNormalized: adminEmail, googleSubject: "guide-demo-admin" } });
      const studentCount = Object.values(classes).flat().length;
      const school = await tx.school.create({
        data: { name: "Trung tâm Anh ngữ Hoa Mai", slug, kind: "LANGUAGE_CENTER", studentCodePrefix: "HM", studentCodeSequence: studentCount },
      });
      const membership = await tx.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: admin.id } });
      const position = await tx.schoolPosition.create({ data: { schoolId: school.id, code: "QUAN_LY", name: "Quản lý trung tâm" } });
      await tx.positionCapabilityGrant.createMany({
        data: ["SCHOOL_CONTEXT_READ", "ROSTER_MANAGE", "SETTINGS_MANAGE", "FINANCE_MANAGE", "COLLECTION_RUN_APPROVE", "LEAVE_REQUEST_DECIDE", "ACCESS_MANAGE"].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })),
        skipDuplicates: true,
      });
      await tx.staffProfile.create({
        data: {
          schoolId: school.id,
          fullName: "Nguyễn Thị Hoa",
          email: adminEmail,
          phone: "0901234567",
          dateOfBirth: day("1988-05-12"),
          gender: "Nữ",
          address: "12 Đường Hoa Mai, Quận 3",
          primaryPositionId: position.id,
          schoolMembershipId: membership.id,
          boundAt: new Date(),
          boundByMembershipId: membership.id,
        },
      });
      const year = await tx.schoolYear.create({ data: { schoolId: school.id, name: "Toàn thời gian", startsOn: day("2000-01-01"), endsOn: null } });
      await tx.schoolCalendarVersion.create({ data: { schoolId: school.id, effectiveFrom: day("2026-01-01"), actorIdentityId: admin.id, membershipId: membership.id } });
      const operation = await tx.operation.create({
        data: {
          schoolId: school.id,
          membershipId: membership.id,
          actorIdentityId: admin.id,
          actorType: "SCHOOL_MEMBERSHIP",
          actorReference: membership.id,
          route: "guide-demo-fixture",
          fingerprint: "guide-demo-fixture-center",
          idempotencyKey: crypto.randomUUID(),
          status: "COMPLETED",
        },
      });
      await tx.financePolicy.create({
        data: {
          schoolId: school.id,
          effectiveFrom: day("2026-01-01"),
          dueDaysAfterIssue: 7,
          taxTreatment: "NOT_APPLICABLE",
          debtScope: "CURRENT_SCHOOL_YEAR_ONLY",
          reversalMode: "DIRECT",
          reason: "Thiết lập ban đầu",
          actorIdentityId: admin.id,
          membershipId: membership.id,
        },
      });
      const account = async (kind: "SCHOOL" | "PERSONAL", receivingBank: string, bankBin: string, accountNumber: string, accountHolderName: string) => {
        const created = await tx.bankAccount.create({
          data: { schoolId: school.id, kind, receivingBank, bankBin, accountNumber, accountHolderName, transferTemplate: "{{studentName}} {{className}}", actorIdentityId: admin.id, membershipId: membership.id },
        });
        await tx.bankAccountLifecycleTransition.create({
          data: { schoolId: school.id, bankAccountId: created.id, status: "ACTIVE", actorIdentityId: admin.id, membershipId: membership.id, operationId: operation.id, sequence: 1 },
        });
        return created;
      };
      const schoolAccount = await account("SCHOOL", "Vietcombank", "970436", "0071000123456", "CONG TY TNHH ANH NGU HOA MAI");
      const personalAccount = await account("PERSONAL", "Techcombank", "970407", "19034567891234", "NGUYEN THI HOA");

      const classIds: Record<string, string> = {};
      const enrollments: Record<string, string> = {};
      let code = 0;
      for (const [className, students] of Object.entries(classes)) {
        const classroom = await tx.class.create({
          data: { schoolId: school.id, schoolYearId: year.id, name: className, defaultSchoolBankAccountId: schoolAccount.id, defaultBankAccountId: personalAccount.id },
        });
        classIds[className] = classroom.id;
        for (const fullName of students) {
          code += 1;
          const student = await tx.student.create({ data: { schoolId: school.id, studentCode: `HM${code}`, fullName, dateOfBirth: day(`${2014 + (code % 5)}-0${1 + (code % 9)}-1${code % 9}`) } });
          const enrollment = await tx.studentEnrollment.create({
            data: {
              schoolId: school.id,
              studentId: student.id,
              schoolYearId: year.id,
              classId: classroom.id,
              lifecycle: "ENROLLED",
              effectiveFrom: day("2026-08-01"),
              schoolYearName: year.name,
              schoolYearStartsOn: year.startsOn,
              schoolYearEndsOn: year.endsOn,
              className,
            },
          });
          await tx.enrollmentClassAssignment.create({
            data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: day("2026-08-01"), reason: "Ghi danh" },
          });
          enrollments[fullName] = enrollment.id;
        }
      }

      const groups: Record<string, string> = {};
      for (const [kind, name] of [["FIXED", "Khoản thu cố định"], ["FLEXIBLE", "Khoản thu linh hoạt"], ["EXTRACURRICULAR", "Ngoại khóa"]] as const) {
        groups[kind] = (await tx.receivableGroup.create({ data: { schoolId: school.id, kind, name } })).id;
      }
      const receivable = async (kind: "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR", item: { code: string; displayName: string; unitLabel: string; defaultUnitPrice: bigint; taxCategory: "NOT_DECLARED" | "EXEMPT" | "VAT_5" | "VAT_8" }, classNames: string[] = []) => {
        const created = await tx.receivable.create({ data: { schoolId: school.id, groupId: groups[kind]!, classScoped: classNames.length > 0, ...item } });
        await tx.receivableLifecycleTransition.create({
          data: { schoolId: school.id, receivableId: created.id, status: "ACTIVE", actorIdentityId: admin.id, membershipId: membership.id, operationId: operation.id, sequence: 1 },
        });
        for (const className of classNames) await tx.receivableClass.create({ data: { schoolId: school.id, receivableId: created.id, classId: classIds[className]! } });
        return created;
      };
      await receivable("FIXED", { code: "HP-ST", displayName: "Học phí Starters", unitLabel: "unit", defaultUnitPrice: 3_600_000n, taxCategory: "NOT_DECLARED" }, ["Starters 1", "Starters 2", "Starters 3"]);
      await receivable("FIXED", { code: "HP-MV", displayName: "Học phí Movers", unitLabel: "unit", defaultUnitPrice: 4_200_000n, taxCategory: "NOT_DECLARED" }, ["Movers 1"]);
      await receivable("FIXED", { code: "HP-FL", displayName: "Học phí Flyers", unitLabel: "unit", defaultUnitPrice: 4_800_000n, taxCategory: "NOT_DECLARED" }, ["Flyers 1"]);
      await receivable("FLEXIBLE", { code: "GT", displayName: "Giáo trình", unitLabel: "bộ", defaultUnitPrice: 650_000n, taxCategory: "VAT_5" });
      await receivable("FLEXIBLE", { code: "THI", displayName: "Phí thi thử Cambridge", unitLabel: "lần", defaultUnitPrice: 500_000n, taxCategory: "EXEMPT" });
      const transport = await receivable("EXTRACURRICULAR", { code: "DD", displayName: "Đưa đón", unitLabel: "kỳ", defaultUnitPrice: 800_000n, taxCategory: "VAT_8" });

      const service = await tx.extracurricularClass.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Đưa đón tuyến 1", receivableId: transport.id } });
      await tx.extracurricularClassLifecycleTransition.create({
        data: { schoolId: school.id, extracurricularClassId: service.id, status: "ACTIVE", actorIdentityId: admin.id, membershipId: membership.id, operationId: operation.id, sequence: 1 },
      });
      for (const fullName of ["Nguyễn Minh Anh", "Trần Gia Bảo", "Phan Thảo My"])
        await tx.extracurricularMembership.create({
          data: {
            schoolId: school.id,
            schoolYearId: year.id,
            extracurricularClassId: service.id,
            enrollmentId: enrollments[fullName]!,
            effectiveFrom: day("2026-08-01"),
            reason: "Đăng ký đưa đón",
            actorIdentityId: admin.id,
            createdByMembershipId: membership.id,
            createOperationId: operation.id,
          },
        });
    },
    { timeout: 60000 },
  );
} finally {
  await prisma.$disconnect();
}
