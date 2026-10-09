import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertDevelopmentEnvironment as assertDevelopment } from '../scripts/development-environment.js';
import { defaultReceivableGroupNames, defaultReceivableGroups, developmentSeedDefaultReceivableGroupsFingerprint, developmentSeedDefaultReceivableGroupsKey, developmentSeedDefaultReceivableGroupsRoute } from '../src/modules/finance/default-receivable-groups.js';

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
const staffCsvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/nhanvien-peakland.csv', import.meta.url)));
const rosterEffectiveFrom = new Date('2026-08-01T00:00:00.000Z');
const staffAssignmentReason = 'PeakLand development seed';
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
const staffHeaders = ['STT', 'Mã nhân viên', 'Họ tên', 'Ngày sinh', 'Email', 'Số điện thoại', 'Lớp', 'Chức vụ'] as const;

type PeakLandStaffRecord = {
  staffCode: string;
  fullName: string;
  dateOfBirth: Date;
  email: string | null;
  phone: string | null;
  classNames: (typeof peakLandClassNames)[number][];
  primaryPositionCode: (typeof positions)[number][0];
};

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

function primaryPositionCode(role: string, line: number): PeakLandStaffRecord['primaryPositionCode'] {
  if (!role) throw new Error(`CSV dòng ${line}, trường Chức vụ là bắt buộc.`);
  if (role.includes('Giáo viên')) return 'GIAO_VIEN';
  if (role.includes('Hiệu trưởng')) return 'HIEU_TRUONG';
  if (role.includes('Kế toán')) return 'KE_TOAN';
  return 'QUAN_LY_TRUONG';
}

export function parsePeakLandStaffCsv(csv: string): PeakLandStaffRecord[] {
  const rows = parseCsv(csv);
  const header = rows.shift();
  if (!header) throw new Error('CSV thiếu hàng tiêu đề.');
  const normalizedHeaders = header.values.map((value) => value.trim());
  if (new Set(normalizedHeaders).size !== normalizedHeaders.length) throw new Error('CSV cấu trúc cột không hợp lệ.');
  const indexes = new Map(normalizedHeaders.map((value, index) => [value, index]));
  for (const name of staffHeaders) if (!indexes.has(name)) throw new Error(`CSV thiếu cột bắt buộc ${name}.`);
  const records = rows.map(({ line, values }, index) => {
    if (values.length !== header.values.length) throw new Error(`CSV dòng ${line}, cấu trúc cột không hợp lệ.`);
    const field = (name: (typeof staffHeaders)[number]) => values[indexes.get(name)!]!.trim();
    const stt = field('STT');
    if (stt !== String(index + 1)) throw new Error(`CSV dòng ${line}, trường STT phải tuần tự từ 1 đến 31.`);
    const staffCode = field('Mã nhân viên');
    const fullName = field('Họ tên');
    if (!staffCode) throw new Error(`CSV dòng ${line}, trường Mã nhân viên là bắt buộc.`);
    if (!fullName) throw new Error(`CSV dòng ${line}, trường Họ tên là bắt buộc.`);
    const email = field('Email').toLowerCase() || null;
    if (email && !emailPattern.test(email)) throw new Error(`CSV dòng ${line}, trường Email không hợp lệ.`);
    const classNames = field('Lớp').split('\n').map((name) => name.trim()).filter(Boolean);
    if (new Set(classNames).size !== classNames.length) throw new Error(`CSV dòng ${line}, trường Lớp có lớp trùng lặp.`);
    for (const className of classNames) {
      if (!peakLandClassNames.includes(className as (typeof peakLandClassNames)[number])) throw new Error(`CSV dòng ${line}, trường Lớp không được hỗ trợ.`);
    }
    const primaryPosition = primaryPositionCode(field('Chức vụ'), line);
    return { staffCode, fullName, dateOfBirth: parseDate(field('Ngày sinh'), line), email, phone: field('Số điện thoại') || null, classNames: classNames as PeakLandStaffRecord['classNames'], primaryPositionCode: primaryPosition };
  });
  if (records.length !== 31) throw new Error(`CSV phải có đúng 31 nhân viên, nhận được ${records.length}.`);
  if (new Set(records.map((record) => record.staffCode)).size !== records.length) throw new Error('CSV có Mã nhân viên trùng lặp.');
  return records;
}

export function assertDevelopmentEnvironment(): void {
  assertDevelopment('Development seed');
}

export async function seed(): Promise<void> {
  assertDevelopmentEnvironment();
  const roster = parsePeakLandRosterCsv(await readFile(rosterCsvPath, 'utf8'));
  const staff = parsePeakLandStaffCsv(await readFile(staffCsvPath, 'utf8'));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required to seed the database.');
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString, options: '-c TimeZone=UTC' }) });
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
        data: ['SCHOOL_CONTEXT_READ', 'FINANCE_MANAGE'].map((capability) => ({ schoolId: school.id, positionId: financePosition.id, capability })),
        skipDuplicates: true,
      });
      await tx.positionCapabilityGrant.createMany({
        data: ownerCapabilities.map((capability) => ({ schoolId: school.id, positionId: positionByCode.get('QUAN_LY_TRUONG')!.id, capability })),
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
      const defaultGroupOperations = await tx.operation.findMany({ where: { schoolId: school.id, route: developmentSeedDefaultReceivableGroupsRoute, idempotencyKey: developmentSeedDefaultReceivableGroupsKey } });
      const defaultGroups = await tx.receivableGroup.findMany({ where: { schoolId: school.id } });
      if (defaultGroupOperations.length === 0 && defaultGroups.length === 0) {
        await tx.operation.create({ data: { schoolId: school.id, membershipId: membership.id, actorIdentityId: owner.id, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membership.id, route: developmentSeedDefaultReceivableGroupsRoute, fingerprint: developmentSeedDefaultReceivableGroupsFingerprint, idempotencyKey: developmentSeedDefaultReceivableGroupsKey, status: 'COMPLETED', outcome: { schoolId: school.id, defaultReceivableGroupNames } } });
        await tx.receivableGroup.createMany({ data: defaultReceivableGroups.map(({ kind, name }) => ({ schoolId: school.id, kind, name })) });
      } else {
        const [defaultGroupOperation] = defaultGroupOperations;
        const validOperation = defaultGroupOperations.length === 1 && defaultGroupOperation?.actorType === 'SCHOOL_MEMBERSHIP' && defaultGroupOperation.actorReference === membership.id && defaultGroupOperation.membershipId === membership.id && defaultGroupOperation.actorIdentityId === owner.id && defaultGroupOperation.fingerprint === developmentSeedDefaultReceivableGroupsFingerprint;
        const validGroups = defaultGroups.length === defaultReceivableGroups.length && defaultReceivableGroups.every(({ kind, name }) => defaultGroups.some((group) => group.kind === kind && group.name === name));
        if (!validOperation || !validGroups || !defaultGroupOperation) throw new Error('Nhóm khoản thu mặc định PeakLand không đúng provenance; hãy reset development database trước khi seed lại.');
        if (defaultGroupOperation.status === 'PENDING') {
          await tx.operation.update({ where: { id: defaultGroupOperation.id }, data: { status: 'COMPLETED', outcome: { schoolId: school.id, defaultReceivableGroupNames } } });
        } else if (defaultGroupOperation.status !== 'COMPLETED') {
          throw new Error('Nhóm khoản thu mặc định PeakLand có Operation không thể hoàn tất an toàn; hãy reset development database trước khi seed lại.');
        }
      }
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
      await seedFinanceFixtures(tx, { schoolId: school.id, schoolYearId: schoolYear.id, membershipId: membership.id, ownerId: owner.id, classrooms: [...classrooms.values()] });
      for (const record of staff) {
        const primaryPosition = positionByCode.get(record.primaryPositionCode)!;
        const registries = await tx.staffCodeRegistry.findMany({ where: { schoolId: school.id, staffCode: record.staffCode } });
        if (registries.length > 1) throw new Error(`Mã nhân viên ${record.staffCode} có nhiều registry trong School pl.`);
        const profiles = await tx.staffProfile.findMany({
          where: { schoolId: school.id, OR: [{ staffCode: record.staffCode }, ...(registries[0] ? [{ id: registries[0].staffId }] : [])] },
          include: { issuedCodes: true, assignments: true },
        });
        if (profiles.length > 1) throw new Error(`Fixture ${record.staffCode} có nhiều StaffProfile trong School pl.`);
        // Staff with an email get a login: identity + membership, bound to their profile by the owner.
        let staffMembership = null;
        if (record.email && record.email !== peakLand.ownerEmail) {
          const identity = await tx.userIdentity.upsert({ where: { emailNormalized: record.email }, create: { emailNormalized: record.email }, update: {} });
          staffMembership = await tx.schoolMembership.upsert({
            where: { schoolId_userIdentityId: { schoolId: school.id, userIdentityId: identity.id } },
            create: { schoolId: school.id, userIdentityId: identity.id },
            update: { status: 'ACTIVE' },
          });
        }
        const profileData = { fullName: record.fullName, email: record.email, phone: record.phone, dateOfBirth: record.dateOfBirth, gender: null, address: null, staffCode: record.staffCode, employmentStatus: 'ACTIVE' as const, primaryPositionId: primaryPosition.id };
        const bindData = staffMembership ? { schoolMembershipId: staffMembership.id, boundByMembershipId: membership.id } : { schoolMembershipId: null, boundByMembershipId: null };
        const existingProfile = profiles[0];
        if (existingProfile && (existingProfile.fullName !== profileData.fullName || existingProfile.phone !== profileData.phone || existingProfile.dateOfBirth.getTime() !== profileData.dateOfBirth.getTime() || existingProfile.gender !== null || existingProfile.address !== null || existingProfile.staffCode !== record.staffCode || existingProfile.employmentStatus !== profileData.employmentStatus || existingProfile.primaryPositionId !== profileData.primaryPositionId || (existingProfile.schoolMembershipId !== null && existingProfile.schoolMembershipId !== bindData.schoolMembershipId) || (existingProfile.boundByMembershipId !== null && existingProfile.boundByMembershipId !== bindData.boundByMembershipId) || existingProfile.issuedCodes.length !== 1 || existingProfile.issuedCodes[0]?.staffCode !== record.staffCode)) {
          throw new Error(`Fixture ${record.staffCode} đã có StaffProfile khác snapshot; hãy reset development database trước khi seed lại.`);
        }
        const bound = staffMembership ? { ...bindData, boundAt: existingProfile?.boundAt ?? new Date() } : {};
        // Email is the one staff field a re-seed may change (it is how a person logs in); binding follows it.
        const profile = existingProfile
          ? (existingProfile.email !== record.email || (staffMembership && existingProfile.schoolMembershipId === null) ? await tx.staffProfile.update({ where: { id: existingProfile.id }, data: { email: record.email, ...bound } }) : existingProfile)
          : await tx.staffProfile.create({ data: { schoolId: school.id, ...profileData, ...bound } });
        if (registries[0]?.staffId && registries[0].staffId !== profile.id) throw new Error(`Mã nhân viên ${record.staffCode} đã thuộc StaffProfile khác.`);
        if (!registries[0]) await tx.staffCodeRegistry.create({ data: { schoolId: school.id, staffId: profile.id, staffCode: record.staffCode } });
        const expectedClassIds = record.primaryPositionCode === 'GIAO_VIEN' ? record.classNames.map((name) => classrooms.get(name)!.id) : [];
        const existingAssignments = await tx.staffClassAssignment.findMany({ where: { schoolId: school.id, staffProfileId: profile.id, schoolYearId: schoolYear.id } });
        const assignmentsMatch = existingAssignments.length === expectedClassIds.length && existingAssignments.every((assignment) => expectedClassIds.includes(assignment.classId) && assignment.effectiveFrom.getTime() === rosterEffectiveFrom.getTime() && assignment.effectiveTo === null && assignment.reason === staffAssignmentReason && assignment.schoolYearName === schoolYear.name && assignment.schoolYearStartsOn.getTime() === schoolYear.startsOn.getTime() && assignment.schoolYearEndsOn.getTime() === schoolYear.endsOn.getTime() && assignment.className === Array.from(classrooms.values()).find((classroom) => classroom.id === assignment.classId)?.name);
        if (existingAssignments.length && !assignmentsMatch) throw new Error(`Fixture ${record.staffCode} đã có lịch sử phân lớp khác snapshot; hãy reset development database trước khi seed lại.`);
        for (const classId of expectedClassIds) {
          if (!existingAssignments.some((assignment) => assignment.classId === classId)) {
            const classroom = Array.from(classrooms.values()).find((item) => item.id === classId)!;
            await tx.staffClassAssignment.create({ data: { schoolId: school.id, staffProfileId: profile.id, schoolYearId: schoolYear.id, classId, effectiveFrom: rosterEffectiveFrom, reason: staffAssignmentReason, schoolYearName: schoolYear.name, schoolYearStartsOn: schoolYear.startsOn, schoolYearEndsOn: schoolYear.endsOn, className: classroom.name } });
          }
        }
      }
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

// PeakLand finance setup mirrored read-only from Kidsonline (school 2688) on 2026-10-07 so the switch-over keeps
// what staff already use: the personal receiving accounts, the receivable catalog and the deductions as promotion
// policies, plus a finance policy with Monday–Friday school days (Saturday is a separately paid programme whose
// meals are in its fee). Collection history is not migrated. Rows are created once and left untouched on
// later seeds.
const financeSeedKey = '8d5c7a52-3f0e-4c61-9d7b-2a41e6f0b9c3';
const financeSeedRoute = 'development-seed/finance-fixtures';
// Kidsonline lists seven non-taxable accounts, all held by Nguyễn Thị Hoan, plus two household-business accounts (BIDV,
// TPBank) that are PeakLand's School accounts. The first account of each kind becomes every Class default of that kind;
// Finance can change both per Class.
const financeSeedAccounts = [
  { receivingBank: 'ACB', bankBin: '970416', accountNumber: '50934947' },
  { receivingBank: 'MBBank', bankBin: '970422', accountNumber: '0916612859' },
  { receivingBank: 'Techcombank', bankBin: '970407', accountNumber: '1916612859' },
  { receivingBank: 'TPBank', bankBin: '970423', accountNumber: '10005507047' },
  { receivingBank: 'Vietcombank', bankBin: '970436', accountNumber: '1916612859' },
  { receivingBank: 'VIB', bankBin: '970441', accountNumber: '163430' },
  { receivingBank: 'VPBank', bankBin: '970432', accountNumber: '0916612859' },
].map((account) => ({ ...account, kind: 'PERSONAL' as 'PERSONAL' | 'SCHOOL', accountHolderName: 'NGUYEN THI HOAN' })).concat([
  { receivingBank: 'BIDV', bankBin: '970418', accountNumber: '8827839003', kind: 'SCHOOL', accountHolderName: 'LOP MAM NON DOC LAP GIAO DUC DINH CAO' },
  { receivingBank: 'TPBank', bankBin: '970423', accountNumber: '88888882026', kind: 'SCHOOL', accountHolderName: 'HKD NHOM TRE, LOP MAM NON DOC LAP KY LAN' },
]);
// Receivables keep Kidsonline names, units and prices; code = KO-<Kidsonline receivable id> to trace rows back during
// migration. Kidsonline "Ngoại khóa" maps to EXTRACURRICULAR; only the two lines every Student gets each month
// (HỌC PHÍ TIÊU CHUẨN THÁNG, Tiền ăn) are FIXED, everything else is FLEXIBLE. Tiền ăn is the only Kidsonline item
// computed from attendance (Mon–Fri, refund 40.000 đ per absent day). Kidsonline marks Học phí and Tiền ăn "Thuế suất
// 0%" only for e-invoices; its tax separation is off and every fee is paid into the personal accounts, so all items
// are NOT_DECLARED here. Skipped: the two 0 đ items (Phụ Phí bé dưới 18 tháng, PHÍ TRÔNG MUỘN; a price must be
// positive) and two deductions entered as receivables (VOCHER GIẢM GIÁ, GIẢM TRỪ HỌC PHÍ NGHỈ 2 TUẦN LIÊN TIẾP).
const financeSeedReceivables = [
  { code: 'KO-41400', displayName: 'Lễ phục võ', unitLabel: 'bộ', defaultUnitPrice: 250000n, refundUnitPrice: 250000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40987', displayName: 'Bộ gymkid', unitLabel: 'bộ', defaultUnitPrice: 220000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40986', displayName: 'Bộ Polo', unitLabel: 'bộ', defaultUnitPrice: 240000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40852', displayName: 'LỚP MC', unitLabel: 'buổi', defaultUnitPrice: 100000n, refundUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Ngoại khóa' },
  { code: 'KO-28018', displayName: 'Đồng phục mùa đông', unitLabel: 'bộ', defaultUnitPrice: 160000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40851', displayName: 'VÕ THUẬT', unitLabel: 'buổi', defaultUnitPrice: 100000n, refundUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Ngoại khóa' },
  { code: 'KO-40850', displayName: 'MỸ THUẬT', unitLabel: 'buổi', defaultUnitPrice: 100000n, refundUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Ngoại khóa' },
  { code: 'KO-36749', displayName: 'Combo thương hiệu Peakland(mũ,lễ phục,gymkid,túi đựng đồ bẩn,đồng phục mùa đông, túi đựng chăn,tạp dề,tặng thêm balo)', unitLabel: 'bộ', defaultUnitPrice: 1272000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40849', displayName: 'NHẢY HIỆN ĐẠI', unitLabel: 'buổi', defaultUnitPrice: 100000n, refundUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Ngoại khóa' },
  { code: 'KO-40583', displayName: 'PHÍ SỰ KIỆN NĂM HỌC 2026-2027 ĐỢT 2', unitLabel: 'lần', defaultUnitPrice: 500000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40582', displayName: 'PHÍ CƠ SỞ VẬT CHẤT NĂM HỌC 2026-2027', unitLabel: 'lần', defaultUnitPrice: 1500000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40410', displayName: 'HỌC PHÍ GRAPESEED', unitLabel: 'UNIT', defaultUnitPrice: 3500000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-40388', displayName: 'Học phí', unitLabel: 'ngày', defaultUnitPrice: 210000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-38937', displayName: 'Đón sớm', unitLabel: 'lần', defaultUnitPrice: 20000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-38588', displayName: 'Thu khác', unitLabel: 'tháng', defaultUnitPrice: 1000000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26115', displayName: 'Trông muộn Từ 17h30-18h00', unitLabel: '30 Phút', defaultUnitPrice: 20000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-38584', displayName: 'CHƯƠNG TRÌNH HỌC TRẢI NGHIỆM', unitLabel: 'lần', defaultUnitPrice: 1980000n, refundUnitPrice: 1980000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-30789', displayName: 'Phí trông muộn sau 18h30', unitLabel: 'lần', defaultUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26121', displayName: 'Trông muộn từ 18h01 - 18h30', unitLabel: 'lần', defaultUnitPrice: 40000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-38241', displayName: 'Thẻ từ ra vào cổng', unitLabel: 'cái', defaultUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-37847', displayName: 'Dã Ngoại', unitLabel: 'lần', defaultUnitPrice: 195000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-38076', displayName: 'ĐẶT CỌC HỌC SINH MỚI', unitLabel: 'lần', defaultUnitPrice: 2000000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-27676', displayName: 'Tiền ăn ngày Thứ 7 - Con GV', unitLabel: 'buổi', defaultUnitPrice: 50000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26497', displayName: 'Phí đón sớm Từ 6h45-7h15', unitLabel: 'lần', defaultUnitPrice: 20000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26495', displayName: 'Lễ phục', unitLabel: 'bộ', defaultUnitPrice: 250000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26484', displayName: 'Phí Phần mềm điện tử Kidsonline', unitLabel: 'năm', defaultUnitPrice: 360000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-37409', displayName: 'Đồng phục mua thêm', unitLabel: 'bộ', defaultUnitPrice: 250000n, refundUnitPrice: 250000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-36948', displayName: 'Phí học phẩm theo quý', unitLabel: 'lần', defaultUnitPrice: 450000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-32403', displayName: 'Tiền sách Baby Grapeseed', unitLabel: 'bộ', defaultUnitPrice: 260000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-36519', displayName: 'Phí bản quyền Grapeseed', unitLabel: 'tháng', defaultUnitPrice: 800000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-32404', displayName: 'Bộ GymKid', unitLabel: 'bộ', defaultUnitPrice: 210000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-33306', displayName: 'Sách Giáo Khoa Grapeseed', unitLabel: 'bộ', defaultUnitPrice: 295000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-32452', displayName: 'Túi đựng chăn', unitLabel: 'cái', defaultUnitPrice: 150000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26146', displayName: 'Chương trình học Thứ 7 full tháng', unitLabel: 'tháng', defaultUnitPrice: 890000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26112', displayName: 'Tiền ăn', unitLabel: 'ngày', defaultUnitPrice: 50000n, refundUnitPrice: 40000n, autoLeaveDeduction: true, taxCategory: 'NOT_DECLARED', group: 'Khoản thu cố định' },
  { code: 'KO-30002', displayName: 'Phí bảo lưu', unitLabel: 'tháng', defaultUnitPrice: 414000n, refundUnitPrice: 414000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-30009', displayName: 'Phí bảo lưu', unitLabel: 'tháng', defaultUnitPrice: 415000n, refundUnitPrice: 415000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-30391', displayName: 'Học phí chương trình BẠN LÀ KHÁCH', unitLabel: 'lần', defaultUnitPrice: 1980000n, refundUnitPrice: 1980000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-31901', displayName: 'Phí đón sớm', unitLabel: 'lần', defaultUnitPrice: 20000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-36518', displayName: 'TIỀN ĐIỆN ĐIỀU HÒA', unitLabel: 'tháng', defaultUnitPrice: 100000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-28708', displayName: 'Phí học phẩm', unitLabel: 'tháng', defaultUnitPrice: 150000n, refundUnitPrice: 150000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-26148', displayName: 'Học phí thứ 7 đăng kí theo ngày', unitLabel: 'ngày', defaultUnitPrice: 250000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
  { code: 'KO-37955', displayName: 'HỌC PHÍ TIÊU CHUẨN THÁNG', unitLabel: 'tháng', defaultUnitPrice: 6900000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu cố định' },
  { code: 'KO-30780', displayName: 'Phí Sự Kiện', unitLabel: 'năm', defaultUnitPrice: 2000000n, taxCategory: 'NOT_DECLARED', group: 'Khoản thu linh hoạt' },
] as const;
// Kidsonline deductions ("Khoản giảm trừ") as DISCOUNT promotion policies on the same receivables, same VND or % value,
// in Kidsonline's sort order (first = highest priority). Kidsonline picks deductions per invoice line, so there are no
// standing Student assignments to migrate; Finance assigns Students here. Prepaid packages ("Gói 4 tặng 2"…) stay a
// lump-sum discount on a multi-month quantity, as staff enter them today. Skipped: deductions whose only receivables
// no longer exist in Kidsonline, ƯU ĐÃI VOCHER (its receivable is dropped), the one-off meal refunds (Nghỉ tết dương
// lịch 1/1/2026, Hoàn trả 2 phiếu ăn…, Tiền ăn ngày nghỉ có phép tháng 9: leave deduction on Tiền ăn covers them) and
// the three with no receivable.
const financeSeedPromotions = [
  { name: 'ĐÓNG 12 THÁNG GIẢM 37% HỌC PHÍ TIÊU CHUẨN', discountType: 'FIXED_VND', discountValue: 30000000n, targets: ['KO-37955'] },
  { name: 'GIẢM 30% HỌC PHÍ TIÊU CHUẨN', discountType: 'FIXED_VND', discountValue: 6300000n, targets: ['KO-37955'] },
  { name: 'Giảm 80% học phí tiêu chuẩn', discountType: 'PERCENTAGE', discountValue: 80n, targets: ['KO-37955'] },
  { name: 'GÓI ƯU ĐÃI 4 TẶNG 2', discountType: 'FIXED_VND', discountValue: 13800000n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI GÓI 1 THÁNG CHO 20 SUẤT ĐẶC BIỆT THÁNG 3.2026', discountType: 'FIXED_VND', discountValue: 1550000n, targets: ['KO-37955'] },
  { name: 'Ưu đãi 30% cho đồng phục', discountType: 'PERCENTAGE', discountValue: 30n, targets: ['KO-36749'] },
  { name: 'Ưu đãi giảm 20% phí sự kiện', discountType: 'PERCENTAGE', discountValue: 20n, targets: ['KO-30780'] },
  { name: 'GÓI ĐÓNG 4 THÁNG TẶNG 2,5 THÁNG', discountType: 'FIXED_VND', discountValue: 17250000n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI COMBO THƯƠNG HIỆU', discountType: 'PERCENTAGE', discountValue: 30n, targets: ['KO-36749'] },
  { name: 'Ưu đãi gói 5 tháng tặng 2 tháng.', discountType: 'FIXED_VND', discountValue: 13800000n, targets: ['KO-37955'] },
  { name: 'Ưu đãi con giáo viên nghỉ sinh 6 tháng', discountType: 'PERCENTAGE', discountValue: 50n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI GOM NHÓM', discountType: 'PERCENTAGE', discountValue: 3n, targets: ['KO-37955'] },
  { name: 'CHƯƠNG TRÌNH BẠN LÀ KHÁCH', discountType: 'FIXED_VND', discountValue: 1980000n, targets: ['KO-30391'] },
  { name: 'Ưu đãi 5% anh chị em ruột học cùng trường', discountType: 'PERCENTAGE', discountValue: 5n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI GÓI 3 THÁNG TẶNG 1.5 THÁNG', discountType: 'FIXED_VND', discountValue: 10350000n, targets: ['KO-37955'] },
  { name: 'CON CÁN BỘ TÒA NHÀ', discountType: 'FIXED_VND', discountValue: 1000000n, targets: ['KO-26112'] },
  { name: 'Ưu đãi HP CON GIÁO VIÊN CON CÔ NGÂN', discountType: 'PERCENTAGE', discountValue: 90n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI T7.2024', discountType: 'PERCENTAGE', discountValue: 38n, targets: ['KO-37955'] },
  { name: 'Ưu đãi gói 1 tháng CTT8.2024', discountType: 'PERCENTAGE', discountValue: 30n, targets: ['KO-37955'] },
  { name: 'Ưu đãi gói hp 12 tháng', discountType: 'PERCENTAGE', discountValue: 43n, targets: ['KO-37955'] },
  { name: 'GÓI ƯU ĐÃI 6 TẶNG 3', discountType: 'FIXED_VND', discountValue: 20700000n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI HP GÓI 1 THÁNG', discountType: 'PERCENTAGE', discountValue: 20n, targets: ['KO-37955'] },
  { name: 'Ưu đãi 35% gói 1 tháng', discountType: 'PERCENTAGE', discountValue: 35n, targets: ['KO-37955'] },
  { name: 'ƯU ĐÃI 50 HỌC SINH KHAI GIẢNG 2023', discountType: 'PERCENTAGE', discountValue: 40n, targets: ['KO-37955'] },
  { name: 'Ưu đãi giảm 7% cho hs gom nhom', discountType: 'PERCENTAGE', discountValue: 7n, targets: ['KO-37955'] },
  { name: 'Ưu đãi giảm 5% gom nhóm', discountType: 'PERCENTAGE', discountValue: 5n, targets: ['KO-37955'] },
  { name: 'HOÀN TIỀN ĐẶT CỌC HỌC SINH MỚI', discountType: 'FIXED_VND', discountValue: 2000000n, targets: ['KO-38076'] },
  { name: 'Ưu đãi gói 3 tháng tặng 2 tháng', discountType: 'FIXED_VND', discountValue: 13800000n, targets: ['KO-37955'] },
  { name: 'Ưu đãi phí sự kiện theo năm', discountType: 'FIXED_VND', discountValue: 1000000n, targets: ['KO-30780'] },
] as const;
// Kidsonline bills these per session through receivables only (its extracurricular module is empty), so each
// EXTRACURRICULAR receivable gets one empty class in SchoolYear 2026-2027 for staff to enrol Students into.
const financeSeedExtracurricularClasses = [
  { name: 'Lớp MC', code: 'KO-40852' },
  { name: 'Võ thuật', code: 'KO-40851' },
  { name: 'Mỹ thuật', code: 'KO-40850' },
  { name: 'Nhảy hiện đại', code: 'KO-40849' },
] as const;

async function seedFinanceFixtures(tx: any, input: { schoolId: string; schoolYearId: string; membershipId: string; ownerId: string; classrooms: Array<{ id: string; defaultBankAccountId: string | null; defaultSchoolBankAccountId: string | null }> }) {
  const { schoolId, membershipId, ownerId } = input;
  const operation = await tx.operation.findFirst({ where: { schoolId, route: financeSeedRoute, idempotencyKey: financeSeedKey } })
    ?? await tx.operation.create({ data: { schoolId, membershipId, actorIdentityId: ownerId, actorType: 'SCHOOL_MEMBERSHIP', actorReference: membershipId, route: financeSeedRoute, fingerprint: 'peakland-finance-fixtures-v1', idempotencyKey: financeSeedKey, status: 'COMPLETED', outcome: { schoolId } } });
  if (!await tx.financePolicy.findFirst({ where: { schoolId } })) {
    await tx.financePolicy.create({ data: { schoolId, effectiveFrom: new Date('2026-08-01T00:00:00.000Z'), dueDaysAfterIssue: 10, schoolWeekdays: [1, 2, 3, 4, 5], taxTreatment: 'NOT_APPLICABLE', debtScope: 'CURRENT_SCHOOL_YEAR_ONLY', reversalMode: 'DIRECT', reason: 'PeakLand development seed', actorIdentityId: ownerId, membershipId } });
  }
  const accounts = { PERSONAL: [] as string[], SCHOOL: [] as string[] };
  const rekinded = new Set<string>();
  for (const account of financeSeedAccounts) {
    const existing = await tx.bankAccount.findFirst({ where: { schoolId, bankBin: account.bankBin, accountNumber: account.accountNumber } });
    const row = existing ?? await tx.bankAccount.create({ data: { schoolId, ...account, transferTemplate: '{{studentName}} {{className}}', actorIdentityId: ownerId, membershipId } });
    if (!existing) await tx.bankAccountLifecycleTransition.create({ data: { schoolId, bankAccountId: row.id, status: 'ACTIVE', actorIdentityId: ownerId, membershipId, operationId: operation.id, sequence: 1 } });
    // Earlier seeds stored the business accounts as PERSONAL; move them to their kind and off the personal Class defaults.
    if (existing && existing.kind !== account.kind) {
      await tx.class.updateMany({ where: { schoolId, defaultBankAccountId: row.id }, data: { defaultBankAccountId: null } });
      await tx.class.updateMany({ where: { schoolId, defaultSchoolBankAccountId: row.id }, data: { defaultSchoolBankAccountId: null } });
      await tx.bankAccount.update({ where: { id: row.id }, data: { kind: account.kind } });
      rekinded.add(row.id);
    }
    accounts[account.kind].push(row.id);
  }
  for (const classroom of input.classrooms) {
    const personal = !classroom.defaultBankAccountId || rekinded.has(classroom.defaultBankAccountId);
    const school = !classroom.defaultSchoolBankAccountId || rekinded.has(classroom.defaultSchoolBankAccountId);
    if (personal || school) await tx.class.update({ where: { id: classroom.id }, data: { ...(personal ? { defaultBankAccountId: accounts.PERSONAL[0] } : {}), ...(school ? { defaultSchoolBankAccountId: accounts.SCHOOL[0] } : {}) } });
  }
  const groups = new Map<string, string>((await tx.receivableGroup.findMany({ where: { schoolId } })).map((group: { name: string; id: string }) => [group.name, group.id]));
  for (const { group, ...receivable } of financeSeedReceivables) {
    if (await tx.receivable.findFirst({ where: { schoolId, code: receivable.code } })) continue;
    const row = await tx.receivable.create({ data: { schoolId, groupId: groups.get(group)!, ...receivable } });
    await tx.receivableLifecycleTransition.create({ data: { schoolId, receivableId: row.id, status: 'ACTIVE', actorIdentityId: ownerId, membershipId, operationId: operation.id, sequence: 1 } });
  }
  for (const { name, code } of financeSeedExtracurricularClasses) {
    if (await tx.extracurricularClass.findFirst({ where: { schoolId, schoolYearId: input.schoolYearId, name } })) continue;
    const receivable = await tx.receivable.findFirstOrThrow({ where: { schoolId, code } });
    const row = await tx.extracurricularClass.create({ data: { schoolId, schoolYearId: input.schoolYearId, name, receivableId: receivable.id } });
    await tx.extracurricularClassLifecycleTransition.create({ data: { schoolId, extracurricularClassId: row.id, status: 'ACTIVE', actorIdentityId: ownerId, membershipId, operationId: operation.id, sequence: 1 } });
  }
  for (const [index, { name, targets, ...value }] of financeSeedPromotions.entries()) {
    if (await tx.promotionPolicy.findFirst({ where: { schoolId, name } })) continue;
    const receivables = await tx.receivable.findMany({ where: { schoolId, code: { in: [...targets] } } });
    const policy = await tx.promotionPolicy.create({ data: { schoolId, name } });
    const version = await tx.promotionPolicyVersion.create({ data: { schoolId, policyId: policy.id, version: 1, status: 'DRAFT', ...value, priority: financeSeedPromotions.length - index, stackingMode: 'STACKABLE', fulfillmentMode: 'DISCOUNT', effectiveFrom: new Date('2026-08-01T00:00:00.000Z') } });
    await tx.promotionPolicyTarget.createMany({ data: receivables.map((receivable: { id: string }) => ({ schoolId, versionId: version.id, receivableId: receivable.id })) });
    await tx.promotionPolicyVersion.update({ where: { id: version.id }, data: { status: 'ACTIVE' } });
  }
}

if (process.env.PRISMA_SEED === 'true') {
  void seed().catch((error: unknown) => {
    console.error('Failed to seed the database.', error);
    process.exitCode = 1;
  });
}
