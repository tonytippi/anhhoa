import { Resvg } from '@resvg/resvg-js';
import jsQRModule from 'jsqr';
import satori from 'satori';
import { describe, expect, it } from 'vitest';
import { paymentImageTree, renderPaymentImage } from './payment-image.js';
import { crc16, transferContent, transferContentLimit, vietQrBank, vietQrBankCode, vietQrBanks, vietQrPayload } from './vietqr.js';

// jsqr is CommonJS; NodeNext types expose its namespace as the default import.
const jsQR = ((jsQRModule as unknown as { default?: unknown }).default ?? jsQRModule) as (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;

const tlv = (value: string) => {
  const fields: Record<string, string> = {};
  for (let index = 0; index < value.length;) {
    const id = value.slice(index, index + 2), length = Number(value.slice(index + 2, index + 4));
    fields[id] = value.slice(index + 4, index + 4 + length);
    index += 4 + length;
  }
  return fields;
};

describe('VietQR transfer content', () => {
  it('is Student name + Class name without diacritics or special characters', () => {
    expect(transferContent('Nguyễn Thị Minh Anh', 'Mầm 4A')).toBe('Nguyen Thi Minh Anh Mam 4A');
    expect(transferContent('Đỗ  Đức-Anh (Bin)', 'Lá 1/2')).toBe('Do Duc Anh Bin La 1 2');
  });
  it('shortens a long Student name by whole words and keeps the Class name complete', () => {
    const result = transferContent('Nguyễn Hoàng Phương Thảo Nguyên Bảo Ngọc Minh Châu', 'Mầm non Hoa Hướng Dương');
    expect(result).toBe('Nguyen Hoang Phuong Thao Mam non Hoa Huong Duong');
    expect(result.length).toBeLessThanOrEqual(transferContentLimit);
    expect(transferContent('Konstantinopolsky-Alexandrovich', 'Lớp Hoa Hướng Dương Buổi Chiều Thứ Bảy')).toBe('Konstantino Lop Hoa Huong Duong Buoi Chieu Thu Bay');
  });
  it('cuts the whole text at the limit when the Class name alone is too long', () => {
    const result = transferContent('An', 'Lớp năng khiếu âm nhạc mỹ thuật và vận động buổi chiều');
    expect(result).toBe('An Lop nang khieu am nhac my thuat va van dong buo');
    expect(result.length).toBeLessThanOrEqual(transferContentLimit);
  });
});

describe('VietQR payload', () => {
  it('uses CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('encodes BIN, account, exact amount and content as a NAPAS account-transfer QR', () => {
    const payload = vietQrPayload({ bin: '970436', accountNumber: '1020 888 999', amount: 2120000n, content: 'Nguyen Minh Anh Mam 4A' });
    const fields = tlv(payload);
    expect(fields).toMatchObject({ '00': '01', '01': '12', '53': '704', '54': '2120000', '58': 'VN' });
    const merchant = tlv(fields['38']!);
    expect(merchant['00']).toBe('A000000727');
    expect(merchant['02']).toBe('QRIBFTTA');
    expect(tlv(merchant['01']!)).toEqual({ '00': '970436', '01': '1020888999' });
    expect(tlv(fields['62']!)).toEqual({ '08': 'Nguyen Minh Anh Mam 4A' });
    expect(fields['63']).toBe(crc16(payload.slice(0, -4)));
  });
  it('refuses an unknown BIN or a non-positive amount', () => {
    expect(() => vietQrPayload({ bin: '123456', accountNumber: '1', amount: 1n, content: 'A' })).toThrow();
    expect(() => vietQrPayload({ bin: '970436', accountNumber: '1', amount: 0n, content: 'A' })).toThrow();
  });
  it('keeps a unique server bank directory', () => {
    expect(new Set(vietQrBanks.map((bank) => bank.bin)).size).toBe(vietQrBanks.length);
    expect(vietQrBanks.every((bank) => /^\d{6}$/.test(bank.bin))).toBe(true);
    expect(vietQrBank('970436')?.shortName).toBe('Vietcombank');
    expect(new Set(vietQrBanks.map((bank) => bank.code)).size).toBe(vietQrBanks.length);
  });
  it('names a receiving account by its short bank code, or the snapshot bank name for an unknown BIN', () => {
    expect(vietQrBankCode('970407', 'Techcombank')).toBe('TCB');
    expect(vietQrBankCode('970425', 'ABBANK')).toBe('ABB');
    expect(vietQrBankCode('999999', 'Ngân hàng lạ')).toBe('Ngân hàng lạ');
  });
});

describe('payment image', () => {
  const school = { bin: '970436', accountNumber: '1020888999', holder: 'TRUONG MAM NON ANH HOA' };
  const part = (overrides: Record<string, unknown> = {}) => ({ channel: 'SCHOOL' as const, obligationCode: 'OBL-202610-000123', rows: [{ label: 'Học phí tháng 10/2026', amount: 1500000n }, { label: 'Giảm trừ ưu đãi · Học phí tháng 10/2026', amount: -150000n }, { label: 'Thuế GTGT 5%', amount: 67500n }], total: 1417500n, bankName: 'Vietcombank', accountNumber: school.accountNumber, accountHolderName: school.holder, transferContent: 'Nguyen Minh Anh Mam 4A', qrPayload: vietQrPayload({ bin: school.bin, accountNumber: school.accountNumber, amount: 1417500n, content: 'Nguyen Minh Anh Mam 4A' }), ...overrides });
  const personal = part({ channel: 'PERSONAL', obligationCode: 'OBL-202610-000124', rows: [{ label: 'Tiền ăn · 22 ngày', amount: 770000n }], total: 770000n, bankName: 'ABBANK', accountNumber: '215000002088', accountHolderName: 'NGUYEN VAN AN', qrPayload: vietQrPayload({ bin: '970425', accountNumber: '215000002088', amount: 770000n, content: 'Nguyen Minh Anh Mam 4A' }) });
  const input = { schoolName: 'Trường Mầm non Ánh Hoa', billingMonth: '2026-10', studentCode: 'HS001', studentName: 'Nguyễn Minh Anh', className: 'Mầm 4A', dueOn: '2026-10-10' };
  const pixels = async (tree: unknown) => {
    const svg = await satori(tree as never, { width: 1080, fonts: [{ name: 'Be Vietnam Pro', data: (await import('node:fs')).readFileSync(new URL('../../../assets/fonts/BeVietnamPro-Regular.ttf', import.meta.url)), weight: 400, style: 'normal' }] });
    return new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render();
  };
  it('renders a PNG whose QR decodes to the server payload', async () => {
    const png = await renderPaymentImage({ ...input, parts: [part()] });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const image = await pixels(paymentImageTree({ ...input, parts: [part()] }));
    expect(jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height)?.data).toBe(part().qrPayload);
  }, 20000);
  it('renders one decodable VietQR per channel part', async () => {
    const image = await pixels(paymentImageTree({ ...input, parts: [part(), personal] }));
    // Scan horizontal bands so each band holds at most one code.
    const found = new Set<string>();
    const rowBytes = image.width * 4;
    for (let top = 0; top + 600 <= image.height; top += 100) {
      const band = new Uint8ClampedArray(image.pixels.subarray(top * rowBytes, (top + 600) * rowBytes));
      const decoded = jsQR(band, image.width, 600);
      if (decoded) found.add(decoded.data);
    }
    expect(found).toEqual(new Set([part().qrPayload, personal.qrPayload]));
  }, 20000);
  it('shows the server totals and payment facts', () => {
    const single = JSON.stringify(paymentImageTree({ ...input, parts: [part()] }));
    for (const value of ['Thông báo học phí tháng 10/2026', 'HS001 · Nguyễn Minh Anh', 'OBL-202610-000123', '10/10/2026', '1.500.000 đ', '-150.000 đ', 'Thuế GTGT 5%', '67.500 đ', 'Tổng cần nộp', '1.417.500 đ', 'Vietcombank', 'Nguyen Minh Anh Mam 4A']) expect(single).toContain(value);
    expect(single).not.toContain('Phần 1');
    const notice = JSON.stringify(paymentImageTree({ ...input, parts: [part(), personal] }));
    for (const value of ['Phần 1 · Thu vào tài khoản trường', 'Phần 2 · Thu vào tài khoản cá nhân', 'Mã: OBL-202610-000124', 'Tổng phần 1', 'Tổng phần 2', '770.000 đ', 'Tổng cần nộp (2 lần chuyển khoản)', '2.187.500 đ', 'NGUYEN VAN AN']) expect(notice).toContain(value);
  });
});
