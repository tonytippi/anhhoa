import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertDevelopmentEnvironment, parseAnhHoaRosterCsv, parseAnhNhatRosterCsv, parseAnhNhatStaffCsv, parseHatNhoRosterCsv, parseHatNhoStaffCsv, parsePeakLandRosterCsv, parsePeakLandStaffCsv, seed, selectSchoolSlugs } from './seed.js';

describe('development fixture seed', () => {
  it('refuses to seed outside development before opening a database connection', async () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    try {
      expect(assertDevelopmentEnvironment).toThrow('NODE_ENV=development');
      await expect(seed()).rejects.toThrow('NODE_ENV=development');
    } finally {
      if (previous === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previous;
    }
  });

  it('parses source parent contacts with exact labels and nullable normalized email', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/hocsinh-peakland.csv', import.meta.url)));
    const roster = parsePeakLandRosterCsv(await readFile(csvPath, 'utf8'));
    expect(roster).toHaveLength(127);
    expect(roster.map((record) => record.studentCode)).toEqual(Array.from({ length: 127 }, (_, index) => `PL${index + 1}`));
    expect(new Set(roster.flatMap((record) => record.className ? [record.className] : []))).toEqual(new Set(['Marie Curie', 'Einstein', 'Newton', 'Archimedes', 'Picasso', 'Mozart', 'Elizabeth']));
    expect(roster.filter((record) => record.lifecycle === 'ENROLLED' && record.className)).toHaveLength(126);
    expect(roster.filter((record) => record.lifecycle === 'WAITING_FOR_CLASS' && !record.className)).toHaveLength(1);
    expect(roster[0]).toMatchObject({ fullName: 'Nguyễn Minh An', preferredName: 'Sữa', gender: 'NAM', address: 'căn hộ GSB 2110B, toà nhà Geleximco 897 Giải Phóng' });
    expect(roster[0]?.mother).toEqual({ fullName: 'Nguyễn Minh Hòa', phone: '0966695297', emailNormalized: null, address: 'căn hộ GSB 2110B, toà nhà Geleximco 897 Giải Phóng - Phường Hoàng Mai - Thành phố Hà Nội' });
    expect(roster[3]).toMatchObject({ mother: { fullName: 'Bùi Thị Thương', phone: '0366672898', emailNormalized: 'buithuong95@gmail.com' }, father: null });
    expect(roster[25]?.mother).toBeNull();
    expect(roster[1]).toMatchObject({ gender: 'NU' });
    expect(roster[126]).toMatchObject({ lifecycle: 'WAITING_FOR_CLASS', className: null });
    await expect(readFile(csvPath, 'utf8').then((csv) => parsePeakLandRosterCsv(csv.replace('buithuong95@gmail.com', 'not-an-email')))).rejects.toThrow('Email phụ huynh');
    await expect(readFile(csvPath, 'utf8').then((csv) => parsePeakLandRosterCsv(csv.replace('phamhoangha2611@gmail.com', 'buithuong95@gmail.com')))).rejects.toThrow('mâu thuẫn họ tên hoặc số điện thoại');
  });

  it('rejects malformed roster data before opening a database transaction', () => {
    const valid = 'STT,Học sinh,Tên thường gọi,Lớp,Trạng thái,Ngày sinh,Giới tính,Địa chỉ,Họ và tên mẹ,SĐT mẹ,Email mẹ,Địa chỉ mẹ,Họ và tên bố,SĐT bố,Email bố,Địa chỉ bố\n';
    expect(() => parsePeakLandRosterCsv(valid)).toThrow('đúng 127 học sinh');
    expect(() => parsePeakLandRosterCsv(valid.replace('Giới tính', 'Giới'))).toThrow('thiếu cột bắt buộc Giới tính');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,Newton,Trong lớp,31-02-2024,Nam,Địa chỉ,,,,,,,,`)).toThrow('Ngày sinh');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,,Chờ phân lớp,01-01-2024,Khác,Địa chỉ,,,,,,,,`)).toThrow('Giới tính');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,Newton,Chờ phân lớp,01-01-2024,Nam,Địa chỉ,,,,,,,,`)).toThrow('phải để trống');
    expect(() => parsePeakLandRosterCsv(valid.replace('STT,', 'STT,STT,'))).toThrow('cấu trúc cột');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,"Newton"không hợp lệ,Trong lớp,01-01-2024,Nam,Địa chỉ,,,,,,,,`)).toThrow('sau dấu nháy đóng');
  });

  it('parses staff profiles, nullable contacts, multiline classes, and position priority', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/nhanvien-peakland.csv', import.meta.url)));
    const staff = parsePeakLandStaffCsv(await readFile(csvPath, 'utf8'));
    expect(staff).toHaveLength(31);
    expect(new Set(staff.map((record) => record.staffCode)).size).toBe(31);
    expect(staff[0]).toMatchObject({ fullName: 'Phạm Ngọc Phương', email: 'ngocphuong.pham@gmail.com', phone: '0985907213', primaryPositionCode: 'QUAN_LY_TRUONG' });
    expect(staff[12]).toMatchObject({ fullName: 'Ms. Nancy', primaryPositionCode: 'HIEU_TRUONG' });
    expect(staff[17]).toMatchObject({ fullName: 'Ms Hana', primaryPositionCode: 'GIAO_VIEN', classNames: ['Marie Curie', 'Einstein', 'Newton', 'Archimedes', 'Picasso', 'Mozart', 'Elizabeth'] });
    expect(staff[18]).toMatchObject({ fullName: 'Cô Võ Hương', phone: null, primaryPositionCode: 'GIAO_VIEN', classNames: ['Archimedes'] });
  });

  it('rejects malformed staff data before opening a database transaction', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/nhanvien-peakland.csv', import.meta.url)));
    const csv = await readFile(csvPath, 'utf8');
    expect(() => parsePeakLandStaffCsv(csv.replace('TSC-2023-2688-921258', 'GSC-2016-0195-10695'))).toThrow('Mã nhân viên trùng lặp');
    expect(() => parsePeakLandStaffCsv(csv.replace('Picasso\n', 'Picasso\nPicasso\n'))).toThrow('lớp trùng lặp');
    expect(() => parsePeakLandStaffCsv(csv.replace('Picasso\n', 'Lớp không hỗ trợ\n'))).toThrow('Lớp không được hỗ trợ');
    expect(() => parsePeakLandStaffCsv(csv.replace('16-06-1983', '31-02-1983'))).toThrow('Ngày sinh');
    expect(() => parsePeakLandStaffCsv(csv.replace('STT,Mã nhân viên', 'STT,Mã'))).toThrow('thiếu cột bắt buộc Mã nhân viên');
    expect(() => parsePeakLandStaffCsv(csv.replace('Giáo viên Điểm danh', ''))).toThrow('Chức vụ là bắt buộc');
  });

  it('parses the Anh Nhật roster, leaving out students who already left', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/anhnhat/anhnhat-hocsinh.csv', import.meta.url)));
    const roster = parseAnhNhatRosterCsv(await readFile(csvPath, 'utf8'));
    expect(roster).toHaveLength(51);
    expect(roster[0]).toMatchObject({ studentCode: 'AN1', fullName: 'Nguyễn Minh Anh', preferredName: 'Happy', className: 'KITTEN', lifecycle: 'ENROLLED', gender: 'NU' });
    expect(new Set(roster.map((record) => record.studentCode)).size).toBe(51);
    expect(new Set(roster.map((record) => record.className))).toEqual(new Set(['KITTEN', 'KOALA', 'MISA', 'PANDA']));
    expect(roster.some((record) => record.fullName === 'Trần Tuấn Dũng')).toBe(false);
  });

  it('parses the Anh Nhật staff with their classes', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/anhnhat/anhnhat-nhanvien.csv', import.meta.url)));
    const staff = parseAnhNhatStaffCsv(await readFile(csvPath, 'utf8'));
    expect(staff).toHaveLength(17);
    expect(staff[3]).toMatchObject({ fullName: 'Nguyễn Thị Hoa', primaryPositionCode: 'KE_TOAN', email: null });
    expect(staff[4]).toMatchObject({ fullName: 'Phí Thanh Thuý', primaryPositionCode: 'GIAO_VIEN', classNames: ['KOALA'] });
    expect(staff[6]).toMatchObject({ fullName: 'Lê Thị Thỏa', classNames: [] });
  });

  it('parses the Ánh Hoa student list without gender or parents', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/anhhoa/anhhoa-hocsinh.csv', import.meta.url)));
    const csv = await readFile(csvPath, 'utf8');
    const roster = parseAnhHoaRosterCsv(csv);
    expect(roster).toHaveLength(134);
    expect(roster[0]).toMatchObject({ studentCode: 'AH1', fullName: 'Lương Trúc Nhi', className: 'MICKEY', lifecycle: 'ENROLLED', dateOfBirth: new Date('2024-12-15T00:00:00.000Z'), gender: null, mother: null, father: null });
    expect(new Set(roster.map((record) => record.className))).toEqual(new Set(['MICKEY', 'DONALD', 'LITTLESEED', 'DUMBO 4', 'DUMBO 5', 'REGGIO 03', 'REGGIO 36']));
    expect(roster.map((record) => record.studentCode)).toEqual(Array.from({ length: 134 }, (_, index) => `AH${index + 1}`));
    expect(roster[34]).toMatchObject({ studentCode: 'AH35', fullName: 'Nguyễn Ngọc Bảo Anh', className: 'LITTLESEED' });
    expect(roster[11]).toMatchObject({ fullName: 'Nguyễn Ngọc Minh Châu', dateOfBirth: new Date('1900-01-01T00:00:00.000Z') });
    expect(roster[50]).toMatchObject({ fullName: 'Nguyễn Thục Khánh An', dateOfBirth: new Date('2022-09-27T00:00:00.000Z') });
    expect(() => parseAnhHoaRosterCsv(csv.replace('15/12/2024', '31/02/2024'))).toThrow('Ngày sinh');
    expect(() => parseAnhHoaRosterCsv(csv.replace('MICKEY,Trong lớp', 'MICKEY,Nghỉ học'))).toThrow('Trạng thái');
  });

  it('parses the Hạt Nho roster with parents, coding students by STT', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/hatnho/hatnho-hocsinh.csv', import.meta.url)));
    const roster = parseHatNhoRosterCsv(await readFile(csvPath, 'utf8'));
    expect(roster).toHaveLength(30);
    expect(roster.map((record) => record.studentCode)).toEqual(Array.from({ length: 30 }, (_, index) => `HN${index + 1}`));
    expect(new Set(roster.map((record) => record.className))).toEqual(new Set(['Newton', 'Picasso', 'Einstein']));
    expect(roster[0]).toMatchObject({ fullName: 'Nguyễn Ngọc Khánh An', preferredName: 'Xoài', className: 'Newton', lifecycle: 'ENROLLED', gender: 'NU', dateOfBirth: new Date('2021-08-23T00:00:00.000Z') });
    expect(roster[0]?.mother).toMatchObject({ fullName: 'Kiều Thị Hoàn', phone: '0948234993', emailNormalized: null });
    expect(roster[0]?.father).toMatchObject({ fullName: 'Nguyễn Tùng Lâm', phone: '0911829818' });
    expect(roster[11]).toMatchObject({ fullName: 'Nguyễn Đức Duy', mother: { emailNormalized: 'nguyenthimo280201@gmail.com' }, father: null });
  });

  it('parses the Hạt Nho staff, giving kitchen staff the Bếp position', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/hatnho/hatnho-nhanvien.csv', import.meta.url)));
    const staff = parseHatNhoStaffCsv(await readFile(csvPath, 'utf8'));
    expect(staff).toHaveLength(15);
    expect(staff[0]).toMatchObject({ fullName: 'Phạm Ngọc Phương', email: 'ngocphuong.pham@gmail.com', primaryPositionCode: 'QUAN_LY_TRUONG' });
    expect(staff[3]).toMatchObject({ fullName: 'Lê Thị Hồng Nhung', primaryPositionCode: 'GIAO_VIEN', classNames: ['Newton'] });
    expect(staff[6]).toMatchObject({ fullName: 'Phạm Thu Mai', primaryPositionCode: 'BEP', phone: null });
    expect(staff[12]).toMatchObject({ fullName: 'Đặng Ngọc Phương', primaryPositionCode: 'GIAO_VIEN', classNames: ['Newton', 'Picasso', 'Einstein'] });
  });

  it('selects Schools to seed by slug from SEED_SCHOOL', async () => {
    expect(selectSchoolSlugs(undefined)).toEqual(['pl', 'pgc', 'an', 'ah', 'hn']);
    expect(selectSchoolSlugs('')).toEqual(['pl', 'pgc', 'an', 'ah', 'hn']);
    expect(selectSchoolSlugs('hn')).toEqual(['hn']);
    expect(selectSchoolSlugs('hn, pl')).toEqual(['pl', 'hn']);
    expect(() => selectSchoolSlugs('xx')).toThrow('SEED_SCHOOL xx không tồn tại');
  });
});
