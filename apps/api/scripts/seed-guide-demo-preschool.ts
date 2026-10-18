import { PrismaService } from "../src/modules/identity/prisma.service.js";

// Synthetic preschool for the Hướng dẫn screenshots ("Trường Mầm non Hoa Mai"); every name and account is invented.
// Runs against the E2E database only: apps/web/guide-screenshots/preschool.spec.ts points DATABASE_URL there.
// Collection runs, receipts, promotions and extracurricular changes are made by the screenshot script through the Admin portal.
const prisma = new PrismaService();
const slug = "guide-demo-preschool";
const adminEmail = "guide-demo-preschool@example.com";
const parentEmail = "guide-demo-preschool-parent@example.com";
const day = (value: string) => new Date(`${value}T00:00:00.000Z`);

const classes = {
  "Mầm 1": ["Lê Bảo Ngọc", "Nguyễn Minh An", "Trần Gia Bình", "Phạm Đức Huy"],
  "Chồi 1": ["Hoàng Khánh Linh", "Vũ Minh Khang", "Đỗ Thảo Vy"],
  "Lá 1": ["Bùi Gia Hân", "Ngô Tuấn Kiệt", "Đặng Quỳnh Anh"],
} as const;
// Attends only the evening English class, without an official class.
const extracurricularOnly = "Mai Anh Thư";

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
      for (const email of [adminEmail, parentEmail]) {
        const identity = await tx.userIdentity.findUnique({ where: { emailNormalized: email }, select: { id: true } });
        if (identity) {
          await tx.operation.deleteMany({ where: { actorIdentityId: identity.id } });
          await tx.parentProfile.deleteMany({ where: { userIdentityId: identity.id } });
          await tx.userIdentity.delete({ where: { id: identity.id } });
        }
      }
      await tx.parentProfile.deleteMany({ where: { emailNormalized: parentEmail } });
      await tx.$executeRawUnsafe("SET LOCAL session_replication_role = origin");

      const admin = await tx.userIdentity.create({ data: { emailNormalized: adminEmail, googleSubject: "guide-demo-preschool" } });
      const studentCount = Object.values(classes).flat().length + 1;
      const school = await tx.school.create({ data: { name: "Trường Mầm non Hoa Mai", slug, kind: "PRESCHOOL", studentCodePrefix: "HM", studentCodeSequence: studentCount } });
      const membership = await tx.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: admin.id } });
      const position = await tx.schoolPosition.create({ data: { schoolId: school.id, code: "KE_TOAN", name: "Kế toán" } });
      await tx.positionCapabilityGrant.createMany({
        data: ["SCHOOL_CONTEXT_READ", "ROSTER_MANAGE", "SETTINGS_MANAGE", "FINANCE_MANAGE", "COLLECTION_RUN_APPROVE", "LEAVE_REQUEST_DECIDE", "ACCESS_MANAGE"].map((capability) => ({ schoolId: school.id, positionId: position.id, capability })),
      });
      await tx.staffProfile.create({
        data: {
          schoolId: school.id,
          fullName: "Kế toán Demo",
          email: adminEmail,
          phone: "0901234567",
          dateOfBirth: day("1990-03-08"),
          gender: "Nữ",
          address: "25 Đường Hoa Mai, Quận 3",
          primaryPositionId: position.id,
          schoolMembershipId: membership.id,
          boundAt: new Date(),
          boundByMembershipId: membership.id,
        },
      });
      const year = await tx.schoolYear.create({ data: { schoolId: school.id, name: "Năm học 2026-2027", startsOn: day("2026-08-01"), endsOn: day("2027-05-31") } });
      const calendar = await tx.schoolCalendarVersion.create({ data: { schoolId: school.id, effectiveFrom: day("2026-01-01"), actorIdentityId: admin.id, membershipId: membership.id } });
      const operation = await tx.operation.create({
        data: {
          schoolId: school.id,
          membershipId: membership.id,
          actorIdentityId: admin.id,
          actorType: "SCHOOL_MEMBERSHIP",
          actorReference: membership.id,
          route: "guide-demo-fixture",
          fingerprint: "guide-demo-fixture-preschool",
          idempotencyKey: crypto.randomUUID(),
          status: "COMPLETED",
        },
      });
      await tx.financePolicy.create({
        data: {
          schoolId: school.id,
          effectiveFrom: day("2026-08-01"),
          dueDaysAfterIssue: 7,
          schoolWeekdays: [1, 2, 3, 4, 5],
          taxTreatment: "NOT_APPLICABLE",
          debtScope: "CURRENT_SCHOOL_YEAR_ONLY",
          reversalMode: "DIRECT",
          reason: "Thiết lập đầu năm học",
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
      const schoolAccount = await account("SCHOOL", "BIDV", "970418", "2150001234567", "TRUONG MAM NON HOA MAI");
      const personalAccount = await account("PERSONAL", "Vietcombank", "970436", "0011000123456", "NGUYEN THI MAU");

      const classIds: Record<string, string> = {};
      const students: Record<string, { studentId: string; enrollmentId: string }> = {};
      let code = 0;
      const student = async (fullName: string) => {
        code += 1;
        return tx.student.create({ data: { schoolId: school.id, studentCode: `HM${code}`, fullName, dateOfBirth: day(`202${1 + (code % 3)}-0${1 + (code % 9)}-1${code % 9}`) } });
      };
      for (const [className, names] of Object.entries(classes)) {
        // "Mầm 1" has no default receiving accounts yet; the script picks them on the Class screen.
        const classroom = await tx.class.create({
          data: { schoolId: school.id, schoolYearId: year.id, name: className, ...(className === "Mầm 1" ? {} : { defaultSchoolBankAccountId: schoolAccount.id, defaultBankAccountId: personalAccount.id }) },
        });
        classIds[className] = classroom.id;
        for (const fullName of names) {
          const created = await student(fullName);
          const enrollment = await tx.studentEnrollment.create({
            data: { schoolId: school.id, studentId: created.id, schoolYearId: year.id, classId: classroom.id, lifecycle: "ENROLLED", effectiveFrom: day("2026-08-01"), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn, className },
          });
          await tx.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: year.id, classId: classroom.id, effectiveFrom: day("2026-08-01"), reason: "Xếp lớp đầu năm" } });
          students[fullName] = { studentId: created.id, enrollmentId: enrollment.id };
        }
      }
      const onlyExtra = await student(extracurricularOnly);
      const onlyExtraEnrollment = await tx.studentEnrollment.create({
        data: { schoolId: school.id, studentId: onlyExtra.id, schoolYearId: year.id, lifecycle: "EXTRACURRICULAR_ONLY", effectiveFrom: day("2026-08-01"), schoolYearName: year.name, schoolYearStartsOn: year.startsOn, schoolYearEndsOn: year.endsOn },
      });
      students[extracurricularOnly] = { studentId: onlyExtra.id, enrollmentId: onlyExtraEnrollment.id };

      const groups: Record<string, string> = {};
      for (const [kind, name] of [["FIXED", "Khoản thu cố định"], ["FLEXIBLE", "Khoản thu linh hoạt"], ["EXTRACURRICULAR", "Ngoại khóa"]] as const) {
        groups[kind] = (await tx.receivableGroup.create({ data: { schoolId: school.id, kind, name } })).id;
      }
      type Tax = "NOT_DECLARED" | "EXEMPT" | "VAT_8" | "VAT_10";
      const receivable = async (kind: "FIXED" | "FLEXIBLE" | "EXTRACURRICULAR", item: { code: string; displayName: string; unitLabel: string; defaultUnitPrice: bigint; taxCategory: Tax; refundUnitPrice?: bigint; autoLeaveDeduction?: boolean }, classNames: string[] = []) => {
        const created = await tx.receivable.create({ data: { schoolId: school.id, groupId: groups[kind]!, classScoped: classNames.length > 0, ...item } });
        await tx.receivableLifecycleTransition.create({
          data: { schoolId: school.id, receivableId: created.id, status: "ACTIVE", actorIdentityId: admin.id, membershipId: membership.id, operationId: operation.id, sequence: 1 },
        });
        for (const className of classNames) await tx.receivableClass.create({ data: { schoolId: school.id, receivableId: created.id, classId: classIds[className]! } });
        return created;
      };
      await receivable("FIXED", { code: "HP-MAM", displayName: "Học phí Mầm", unitLabel: "tháng", defaultUnitPrice: 3_500_000n, taxCategory: "NOT_DECLARED", refundUnitPrice: 3_500_000n }, ["Mầm 1"]);
      await receivable("FIXED", { code: "HP-CHOI", displayName: "Học phí Chồi", unitLabel: "tháng", defaultUnitPrice: 3_400_000n, taxCategory: "NOT_DECLARED", refundUnitPrice: 3_400_000n }, ["Chồi 1"]);
      await receivable("FIXED", { code: "HP-LA", displayName: "Học phí Lá", unitLabel: "tháng", defaultUnitPrice: 3_300_000n, taxCategory: "NOT_DECLARED", refundUnitPrice: 3_300_000n }, ["Lá 1"]);
      await receivable("FIXED", { code: "TA", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: 40_000n, taxCategory: "VAT_8", refundUnitPrice: 35_000n, autoLeaveDeduction: true });
      await receivable("FLEXIBLE", { code: "DN", displayName: "Phí dã ngoại", unitLabel: "lần", defaultUnitPrice: 250_000n, taxCategory: "EXEMPT" });
      await receivable("FLEXIBLE", { code: "DP", displayName: "Đồng phục", unitLabel: "bộ", defaultUnitPrice: 300_000n, taxCategory: "VAT_10" });
      const english = await receivable("EXTRACURRICULAR", { code: "NK-TA", displayName: "Tiếng Anh ngoại khóa", unitLabel: "tháng", defaultUnitPrice: 600_000n, taxCategory: "NOT_DECLARED" });
      await receivable("EXTRACURRICULAR", { code: "NK-VE", displayName: "Năng khiếu vẽ", unitLabel: "tháng", defaultUnitPrice: 400_000n, taxCategory: "NOT_DECLARED" });

      const englishClass = await tx.extracurricularClass.create({ data: { schoolId: school.id, schoolYearId: year.id, name: "Tiếng Anh A1 (T3-T5)", receivableId: english.id, separateAttendance: true } });
      await tx.extracurricularClassLifecycleTransition.create({
        data: { schoolId: school.id, extracurricularClassId: englishClass.id, status: "ACTIVE", actorIdentityId: admin.id, membershipId: membership.id, operationId: operation.id, sequence: 1 },
      });
      for (const fullName of ["Bùi Gia Hân", "Ngô Tuấn Kiệt", extracurricularOnly])
        await tx.extracurricularMembership.create({
          data: { schoolId: school.id, schoolYearId: year.id, extracurricularClassId: englishClass.id, enrollmentId: students[fullName]!.enrollmentId, effectiveFrom: day("2026-09-01"), reason: "Đăng ký đầu năm", actorIdentityId: admin.id, createdByMembershipId: membership.id, createOperationId: operation.id },
        });

      // Two approved sick days in September give "Nguyễn Minh An" a suggested meal deduction on the October invoice.
      const parentIdentity = await tx.userIdentity.create({ data: { emailNormalized: parentEmail, googleSubject: "guide-demo-preschool-parent" } });
      const parent = await tx.parentProfile.create({ data: { emailNormalized: parentEmail, fullName: "Nguyễn Thị Lan", phone: "0912345678", userIdentityId: parentIdentity.id, boundAt: new Date() } });
      const an = students["Nguyễn Minh An"]!.studentId;
      await tx.studentParent.create({ data: { schoolId: school.id, studentId: an, parentProfileId: parent.id } });
      const leave = await tx.leaveRequest.create({
        data: { schoolId: school.id, studentId: an, parentProfileId: parent.id, status: "APPROVED", policyEffectiveFrom: day("2026-01-01"), policyDeadlineLocalTime: "20:00", decidedAt: new Date(), decidedByMembershipId: membership.id },
      });
      const sickDays = ["2026-09-21", "2026-09-22"];
      await tx.leaveRequestDay.createMany({ data: sickDays.map((value) => ({ schoolId: school.id, leaveRequestId: leave.id, operatingOn: day(value), calendarEffectiveFrom: calendar.effectiveFrom })) });
      await tx.leaveDaySource.createMany({ data: sickDays.map((value) => ({ schoolId: school.id, studentId: an, operatingOn: day(value), leaveRequestId: leave.id, leaveStatus: "APPROVED" })) });
    },
    { timeout: 60000 },
  );
} finally {
  await prisma.$disconnect();
}
