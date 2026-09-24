import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertDevelopmentEnvironment as assertDevelopment } from '../scripts/development-environment.js';

const peakLand = {
  name: 'Mầm Non Giáo dục Đỉnh Cao - PeakLand Preschool',
  slug: 'pl',
  studentCodePrefix: 'PL',
  ownerEmail: 'sonnh273@gmail.com',
} as const;

const positions = [
  ['HIEU_TRUONG', 'Hiệu trưởng'],
  ['QUAN_LY_TRUONG', 'Quản lý trường'],
  ['KE_TOAN', 'Kế toán'],
  ['GIAO_VIEN', 'Giáo viên'],
  ['TUYEN_SINH', 'Nhân viên tuyển sinh'],
  ['BEP', 'Bếp'],
  ['Y_TE', 'Y tế'],
] as const;

const ownerCapabilities = ['SCHOOL_CONTEXT_READ', 'ACCESS_MANAGE', 'ROSTER_MANAGE', 'SETTINGS_MANAGE', 'FINANCE_MANAGE', 'CLASS_LEAVE_READ', 'LEAVE_REQUEST_DECIDE'];
const peakLandClassNames = ['Marie Curie', 'Einstein', 'Newton', 'Archimedes', 'Picasso', 'Mozart', 'Elizabeth'] as const;
const rosterCsvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/hocsinh-peakland.csv', import.meta.url)));
const rosterEffectiveFrom = new Date('2026-08-01T00:00:00.000Z');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PeakLandRosterRecord = {
  studentCode: string;
  fullName: string;
  preferredName: string | null;
  className: (typeof peakLandClassNames)[number] | null;
  lifecycle: 'ENROLLED' | 'WAITING_FOR_CLASS';
  dateOfBirth: Date;
  gender: 'NAM' | 'NU';
  address: string | null;
  mother: PeakLandParentContact | null;
  father: PeakLandParentContact | null;
};

type PeakLandParentContact = {
  fullName: string;
  phone: string;
  emailNormalized: string | null;
  address: string | null;
};

const rosterHeaders = ['STT', 'Học sinh', 'Tên thường gọi', 'Lớp', 'Trạng thái', 'Ngày sinh', 'Giới tính', 'Địa chỉ', 'Họ và tên mẹ', 'SĐT mẹ', 'Email mẹ', 'Địa chỉ mẹ', 'Họ và tên bố', 'SĐT bố', 'Email bố', 'Địa chỉ bố'] as const;

function normalizePhone(phone: string): string {
  return phone.replace(/[^0-9]/g, '');
}

function contact(values: { name: string; phone: string; email: string; address: string }): PeakLandParentContact | null {
  const fullName = values.name.trim();
  const phone = values.phone.trim();
  if (!fullName || !phone) return null;
  const emailNormalized = values.email.trim().toLowerCase() || null;
  if (emailNormalized && !emailPattern.test(emailNormalized)) throw new Error(`Email phụ huynh ${emailNormalized} không hợp lệ.`);
  return {
    fullName,
    phone,
    emailNormalized,
    address: values.address.trim() || null,
  };
}

function stableParentId(contact: PeakLandParentContact): string {
  const hash = createHash('sha256')
    .update(`peakland-parent:${normalizePhone(contact.phone)}`)
    .digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${((Number.parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16)}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

function parseCsv(csv: string): { line: number; values: string[] }[] {
  const rows: { line: number; values: string[] }[] = [];
  let values: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  let line = 1;
  let rowLine = 1;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]!;
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
        closedQuote = true;
      }
      else {
        value += character;
        if (character === '\n') line += 1;
      }
      continue;
    }
    if (closedQuote && character !== ',' && character !== '\n' && character !== '\r') {
      throw new Error(`CSV dòng ${line}, trường không hợp lệ sau dấu nháy đóng.`);
    }
    if (character === '"') {
      if (value !== '') throw new Error(`CSV dòng ${line}, trường không hợp lệ: dấu nháy phải ở đầu giá trị.`);
      quoted = true;
    } else if (character === ',') {
      values.push(value);
      value = '';
      closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      values.push(value);
      rows.push({ line: rowLine, values });
      values = [];
      value = '';
      closedQuote = false;
      line += 1;
      rowLine = line;
    } else value += character;
  }
  if (quoted) throw new Error(`CSV dòng ${rowLine}, trường không hợp lệ: thiếu dấu nháy đóng.`);
  if (value !== '' || values.length > 0) rows.push({ line: rowLine, values: [...values, value] });
  return rows.filter((row) => row.values.some((value) => value !== ''));
}

function parseDate(value: string, line: number): Date {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match) throw new Error(`CSV dòng ${line}, trường Ngày sinh không hợp lệ.`);
  const [, day, month, year] = match;
  const date = new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error(`CSV dòng ${line}, trường Ngày sinh không hợp lệ.`);
  }
  return date;
}

export function parsePeakLandRosterCsv(csv: string): PeakLandRosterRecord[] {
  const rows = parseCsv(csv);
  const header = rows.shift();
  if (!header) throw new Error('CSV thiếu hàng tiêu đề.');
  const normalizedHeaders = header.values.map((value) => value.trim());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) {
    throw new Error('CSV cấu trúc cột không hợp lệ.');
  }
  const indexes = new Map(normalizedHeaders.map((value, index) => [value, index]));
  for (const name of rosterHeaders) if (!indexes.has(name)) throw new Error(`CSV thiếu cột bắt buộc ${name}.`);
  const records = rows.map(({ line, values }, index) => {
    if (values.length !== header.values.length) throw new Error(`CSV dòng ${line}, cấu trúc cột không hợp lệ.`);
    const field = (name: (typeof rosterHeaders)[number]) => values[indexes.get(name)!]!.trim();
    const stt = field('STT');
    if (stt !== String(index + 1)) throw new Error(`CSV dòng ${line}, trường STT phải tuần tự từ 1 đến 127.`);
    const fullName = field('Học sinh');
    if (!fullName) throw new Error(`CSV dòng ${line}, trường Học sinh là bắt buộc.`);
    const gender: PeakLandRosterRecord['gender'] | null = field('Giới tính') === 'Nam' ? 'NAM' : field('Giới tính') === 'Nữ' ? 'NU' : null;
    if (!gender) throw new Error(`CSV dòng ${line}, trường Giới tính không được hỗ trợ.`);
    const status = field('Trạng thái');
    const className = field('Lớp');
    if (status === 'Trong lớp') {
      if (!peakLandClassNames.includes(className as (typeof peakLandClassNames)[number])) throw new Error(`CSV dòng ${line}, trường Lớp không được hỗ trợ.`);
      return { studentCode: `PL${stt}`, fullName, preferredName: field('Tên thường gọi') || null, className: className as (typeof peakLandClassNames)[number], lifecycle: 'ENROLLED' as const, dateOfBirth: parseDate(field('Ngày sinh'), line), gender, address: field('Địa chỉ') || null, mother: contact({ name: field('Họ và tên mẹ'), phone: field('SĐT mẹ'), email: field('Email mẹ'), address: field('Địa chỉ mẹ') }), father: contact({ name: field('Họ và tên bố'), phone: field('SĐT bố'), email: field('Email bố'), address: field('Địa chỉ bố') }) };
    }
    if (status === 'Chờ phân lớp') {
      if (className) throw new Error(`CSV dòng ${line}, trường Lớp phải để trống khi Chờ phân lớp.`);
      return { studentCode: `PL${stt}`, fullName, preferredName: field('Tên thường gọi') || null, className: null, lifecycle: 'WAITING_FOR_CLASS' as const, dateOfBirth: parseDate(field('Ngày sinh'), line), gender, address: field('Địa chỉ') || null, mother: contact({ name: field('Họ và tên mẹ'), phone: field('SĐT mẹ'), email: field('Email mẹ'), address: field('Địa chỉ mẹ') }), father: contact({ name: field('Họ và tên bố'), phone: field('SĐT bố'), email: field('Email bố'), address: field('Địa chỉ bố') }) };
    }
    throw new Error(`CSV dòng ${line}, trường Trạng thái không được hỗ trợ.`);
  });
  if (records.length !== 127) throw new Error(`CSV phải có đúng 127 học sinh, nhận được ${records.length}.`);
  for (const className of peakLandClassNames) if (!records.some((record) => record.className === className)) throw new Error(`CSV thiếu lớp ${className}.`);
  if (records.filter((record) => record.lifecycle === 'WAITING_FOR_CLASS').length !== 1) throw new Error('CSV phải có đúng một học sinh Chờ phân lớp.');
  const contacts = records.flatMap((record) => [record.mother, record.father]).filter((item): item is PeakLandParentContact => item !== null);
  const contactsByEmail = new Map<string, PeakLandParentContact>();
  const contactsByPhone = new Map<string, PeakLandParentContact>();
  for (const item of contacts) {
    const normalizedPhone = normalizePhone(item.phone);
    const samePhone = contactsByPhone.get(normalizedPhone);
    if (samePhone && samePhone.fullName !== item.fullName) {
      throw new Error(`CSV có số điện thoại phụ huynh ${item.phone} mâu thuẫn họ tên.`);
    }
    contactsByPhone.set(normalizedPhone, item);
    if (!item.emailNormalized) continue;
    const previous = contactsByEmail.get(item.emailNormalized);
    if (previous && (previous.fullName !== item.fullName || normalizePhone(previous.phone) !== normalizePhone(item.phone))) {
      throw new Error(`CSV có email phụ huynh ${item.emailNormalized} mâu thuẫn họ tên hoặc số điện thoại.`);
    }
    contactsByEmail.set(item.emailNormalized, item);
  }
  return records;
}

export function assertDevelopmentEnvironment(): void {
  assertDevelopment('Development seed');
}

export async function seed(): Promise<void> {
  assertDevelopmentEnvironment();
  const roster = parsePeakLandRosterCsv(await readFile(rosterCsvPath, 'utf8'));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  try {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(9162026)`;
      const owner = await tx.userIdentity.upsert({
        where: { emailNormalized: peakLand.ownerEmail },
        create: { emailNormalized: peakLand.ownerEmail },
        update: {},
      });
      const school = await tx.school.upsert({
        where: { slug: peakLand.slug },
        create: {
          name: peakLand.name,
          slug: peakLand.slug,
          studentCodePrefix: peakLand.studentCodePrefix,
          initialOwnerIdentityId: owner.id,
        },
        update: { name: peakLand.name, studentCodePrefix: peakLand.studentCodePrefix, initialOwnerIdentityId: owner.id },
      });
      const schoolYearData = {
        schoolId: school.id,
        name: '2026-2027',
        startsOn: new Date('2026-08-01T00:00:00.000Z'),
        endsOn: new Date('2027-07-31T00:00:00.000Z'),
      };
      let schoolYear = await tx.schoolYear.findFirst({
        where: { schoolId: school.id, name: schoolYearData.name },
      });
      if (schoolYear?.closedAt) throw new Error('SchoolYear 2026-2027 đã đóng; hãy reset development database trước khi seed lại.');
      if (schoolYear) schoolYear = await tx.schoolYear.update({ where: { id: schoolYear.id }, data: schoolYearData });
      else schoolYear = await tx.schoolYear.create({ data: schoolYearData });
      const membership = await tx.schoolMembership.upsert({
        where: { schoolId_userIdentityId: { schoolId: school.id, userIdentityId: owner.id } },
        create: { schoolId: school.id, userIdentityId: owner.id },
        update: { status: 'ACTIVE' },
      });
      const seededPositions = await Promise.all(positions.map(async ([code, name]) => [code, await tx.schoolPosition.upsert({
        where: { schoolId_code: { schoolId: school.id, code } },
        create: { schoolId: school.id, code, name, status: 'ACTIVE' },
        update: { name, status: 'ACTIVE' },
      })] as const));
      const positionByCode = new Map(seededPositions);
      const ownerPosition = positionByCode.get('HIEU_TRUONG')!;
      const financePosition = positionByCode.get('KE_TOAN')!;
      await tx.positionCapabilityGrant.createMany({
        data: ownerCapabilities.map((capability) => ({ schoolId: school.id, positionId: ownerPosition.id, capability })),
        skipDuplicates: true,
      });
      await tx.positionCapabilityGrant.createMany({
        data: [{ schoolId: school.id, positionId: financePosition.id, capability: 'FINANCE_MANAGE' }],
        skipDuplicates: true,
      });
      const staffData = {
        schoolId: school.id,
        fullName: peakLand.ownerEmail,
        email: peakLand.ownerEmail,
        employmentStatus: 'ACTIVE' as const,
        primaryPositionId: ownerPosition.id,
        schoolMembershipId: membership.id,
        boundAt: new Date(),
        boundByMembershipId: membership.id,
      };
      const existingStaff = await tx.staffProfile.findFirst({ where: { schoolId: school.id, schoolMembershipId: membership.id } });
      if (existingStaff) await tx.staffProfile.update({ where: { id: existingStaff.id }, data: staffData });
      else await tx.staffProfile.create({
        data: {
          ...staffData,
          phone: 'Chưa cập nhật',
          dateOfBirth: new Date('1900-01-01T00:00:00.000Z'),
          gender: 'Chưa cập nhật',
          address: 'Chưa cập nhật',
        },
      });
      if (school.studentCodeSequence < roster.length) {
        await tx.school.update({ where: { id: school.id }, data: { studentCodeSequence: roster.length } });
      }
      const classrooms = new Map(await Promise.all(peakLandClassNames.map(async (name) => {
        const existingClasses = await tx.class.findMany({ where: { schoolId: school.id, schoolYearId: schoolYear.id, name } });
        if (existingClasses.length > 1) throw new Error(`Lớp ${name} có nhiều bản ghi trong SchoolYear 2026-2027.`);
        const existing = existingClasses[0];
        const classroom = existing
          ? await tx.class.update({ where: { id: existing.id }, data: { status: 'ACTIVE' } })
          : await tx.class.create({ data: { schoolId: school.id, schoolYearId: schoolYear.id, name, status: 'ACTIVE' } });
        return [name, classroom] as const;
      })));
      for (const record of roster) {
        const studentData = { fullName: record.fullName, preferredName: record.preferredName, dateOfBirth: record.dateOfBirth, gender: record.gender, address: record.address };
        const students = await tx.student.findMany({ where: { schoolId: school.id, studentCode: record.studentCode } });
        if (students.length > 1) throw new Error(`Fixture ${record.studentCode} có nhiều Student trong School pl.`);
        const student = students[0]
          ? await tx.student.update({ where: { id: students[0].id }, data: studentData })
          : await tx.student.create({ data: { schoolId: school.id, studentCode: record.studentCode, ...studentData } });
        const classroom = record.className ? classrooms.get(record.className)! : null;
        const enrollmentData = { schoolId: school.id, studentId: student.id, schoolYearId: schoolYear.id, classId: classroom?.id ?? null, lifecycle: record.lifecycle, effectiveFrom: rosterEffectiveFrom, endedOn: null, schoolYearName: schoolYear.name, schoolYearStartsOn: schoolYear.startsOn, schoolYearEndsOn: schoolYear.endsOn, className: classroom?.name ?? null };
        const existingEnrollment = await tx.studentEnrollment.findUnique({
          where: { schoolId_studentId_schoolYearId: { schoolId: school.id, studentId: student.id, schoolYearId: schoolYear.id } },
          include: { classAssignments: true },
        });
        if (existingEnrollment) {
          const expectedAssignment = classroom ? { classId: classroom.id, effectiveFrom: rosterEffectiveFrom, effectiveTo: null, reason: 'Khởi tạo enrollment' } : null;
          const enrollmentMatches = existingEnrollment.classId === enrollmentData.classId && existingEnrollment.lifecycle === enrollmentData.lifecycle && existingEnrollment.effectiveFrom.getTime() === rosterEffectiveFrom.getTime() && existingEnrollment.endedOn === null && existingEnrollment.className === enrollmentData.className;
          const assignmentMatches = expectedAssignment
            ? existingEnrollment.classAssignments.length === 1 && existingEnrollment.classAssignments[0]?.classId === expectedAssignment.classId && existingEnrollment.classAssignments[0]?.effectiveFrom.getTime() === expectedAssignment.effectiveFrom.getTime() && existingEnrollment.classAssignments[0]?.effectiveTo === expectedAssignment.effectiveTo && existingEnrollment.classAssignments[0]?.reason === expectedAssignment.reason
            : existingEnrollment.classAssignments.length === 0;
          if (!enrollmentMatches || !assignmentMatches) throw new Error(`Fixture ${record.studentCode} đã có enrollment hoặc lịch sử phân lớp khác snapshot; hãy reset development database trước khi seed lại.`);
        } else {
          const enrollment = await tx.studentEnrollment.create({ data: enrollmentData });
          if (classroom) await tx.enrollmentClassAssignment.create({ data: { schoolId: school.id, enrollmentId: enrollment.id, schoolYearId: schoolYear.id, classId: classroom.id, effectiveFrom: rosterEffectiveFrom, reason: 'Khởi tạo enrollment' } });
        }
        for (const [relationshipLabel, parent] of [['Mẹ', record.mother], ['Bố', record.father]] as const) {
          if (!parent) continue;
          const profile = parent.emailNormalized
            ? await tx.parentProfile.findUnique({ where: { emailNormalized: parent.emailNormalized } })
            : await tx.parentProfile.findFirst({
                where: { emailNormalized: null, fullName: parent.fullName, phone: parent.phone },
              }) ?? await tx.parentProfile.findUnique({ where: { id: stableParentId(parent) } });
          if (profile && (profile.fullName !== parent.fullName || normalizePhone(profile.phone) !== normalizePhone(parent.phone))) {
            throw new Error(`Phụ huynh ${parent.emailNormalized ?? `${parent.fullName}/${parent.phone}`} đã tồn tại với họ tên hoặc số điện thoại khác.`);
          }
          const parentProfile = profile ?? await tx.parentProfile.create({
            data: parent.emailNormalized
              ? { emailNormalized: parent.emailNormalized, fullName: parent.fullName, phone: parent.phone }
              : { id: stableParentId(parent), fullName: parent.fullName, phone: parent.phone },
          });
          const existingLink = await tx.studentParent.findUnique({
            where: { schoolId_studentId_parentProfileId: { schoolId: school.id, studentId: student.id, parentProfileId: parentProfile.id } },
          });
          if (existingLink?.status === 'REVOKED') throw new Error(`Liên kết ${relationshipLabel} của ${record.studentCode} đã bị revoke; seed không thể kích hoạt lại.`);
          if (existingLink) {
            if (existingLink.relationshipLabel !== relationshipLabel) await tx.studentParent.update({ where: { id: existingLink.id }, data: { relationshipLabel } });
          } else {
            await tx.studentParent.create({ data: { schoolId: school.id, studentId: student.id, parentProfileId: parentProfile.id, relationshipLabel } });
          }
        }
      }
    });
  } finally {
    await prisma.$disconnect();
  }
}

if (process.env.PRISMA_SEED === 'true') {
  void seed().catch((error: unknown) => {
    console.error('Failed to seed the database.', error);
    process.exitCode = 1;
  });
}
