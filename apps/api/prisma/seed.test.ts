import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { assertDevelopmentEnvironment, parsePeakLandRosterCsv, seed } from './seed.js';

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

  it('parses the 127 PeakLand students without reading parent data', async () => {
    const csvPath = resolve(fileURLToPath(new URL('../../../docs/peakland/hocsinh-peakland.csv', import.meta.url)));
    const roster = parsePeakLandRosterCsv(await readFile(csvPath, 'utf8'));
    expect(roster).toHaveLength(127);
    expect(roster.map((record) => record.studentCode)).toEqual(Array.from({ length: 127 }, (_, index) => `PL${index + 1}`));
    expect(new Set(roster.flatMap((record) => record.className ? [record.className] : []))).toEqual(new Set(['Marie Curie', 'Einstein', 'Newton', 'Archimedes', 'Picasso', 'Mozart', 'Elizabeth']));
    expect(roster.filter((record) => record.lifecycle === 'ENROLLED' && record.className)).toHaveLength(126);
    expect(roster.filter((record) => record.lifecycle === 'WAITING_FOR_CLASS' && !record.className)).toHaveLength(1);
    expect(roster[0]).toMatchObject({ fullName: 'Nguyễn Minh An', preferredName: 'Sữa', gender: 'NAM', address: 'căn hộ GSB 2110B, toà nhà Geleximco 897 Giải Phóng' });
    expect(roster[1]).toMatchObject({ gender: 'NU' });
    expect(roster[126]).toMatchObject({ lifecycle: 'WAITING_FOR_CLASS', className: null });
  });

  it('rejects malformed roster data before opening a database transaction', () => {
    const valid = 'STT,Học sinh,Tên thường gọi,Lớp,Trạng thái,Ngày sinh,Giới tính,Địa chỉ\n';
    expect(() => parsePeakLandRosterCsv(valid)).toThrow('đúng 127 học sinh');
    expect(() => parsePeakLandRosterCsv(valid.replace('Giới tính', 'Giới'))).toThrow('thiếu cột bắt buộc Giới tính');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,Newton,Trong lớp,31-02-2024,Nam,Địa chỉ`)).toThrow('Ngày sinh');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,,Chờ phân lớp,01-01-2024,Khác,Địa chỉ`)).toThrow('Giới tính');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,Newton,Chờ phân lớp,01-01-2024,Nam,Địa chỉ`)).toThrow('phải để trống');
    expect(() => parsePeakLandRosterCsv(valid.replace('STT,', 'STT,STT,'))).toThrow('cấu trúc cột');
    expect(() => parsePeakLandRosterCsv(`${valid}1,Học sinh,Tên,"Newton"không hợp lệ,Trong lớp,01-01-2024,Nam,Địa chỉ`)).toThrow('sau dấu nháy đóng');
  });
});
