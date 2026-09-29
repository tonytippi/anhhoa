import { Resvg } from '@resvg/resvg-js';
import jsQRModule from 'jsqr';
import satori from 'satori';
import { describe, expect, it } from 'vitest';
import { paymentImageTree, renderPaymentImage } from './payment-image.js';
import { crc16, transferContent, transferContentLimit, vietQrBank, vietQrBanks, vietQrPayload } from './vietqr.js';

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
  });
});

describe('payment image', () => {
  const input = { schoolName: 'Trường Mầm non Ánh Hoa', billingMonth: '2026-10', studentCode: 'HS001', studentName: 'Nguyễn Minh Anh', className: 'Mầm 4A', obligationCode: 'OBL-202610-000123', dueOn: '2026-10-10', rows: [{ label: 'Học phí tháng 10/2026', amount: 1500000n }, { label: 'Giảm trừ ưu đãi · Học phí tháng 10/2026', amount: -150000n }], total: 1350000n, bankName: 'Vietcombank', accountNumber: '1020888999', accountHolderName: 'TRUONG MAM NON ANH HOA', transferContent: 'Nguyen Minh Anh Mam 4A' };
  it('renders a PNG whose QR decodes to the server payload', async () => {
    const qrPayload = vietQrPayload({ bin: '970436', accountNumber: input.accountNumber, amount: input.total, content: input.transferContent });
    const png = await renderPaymentImage({ ...input, qrPayload });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    const svg = await satori(paymentImageTree({ ...input, qrPayload }) as never, { width: 1080, fonts: [{ name: 'Be Vietnam Pro', data: (await import('node:fs')).readFileSync(new URL('../../../assets/fonts/BeVietnamPro-Regular.ttf', import.meta.url)), weight: 400, style: 'normal' }] });
    const image = new Resvg(svg, { fitTo: { mode: 'width', value: 1080 } }).render();
    const decoded = jsQR(new Uint8ClampedArray(image.pixels), image.width, image.height);
    expect(decoded?.data).toBe(qrPayload);
  }, 20000);
  it('shows the server total and payment facts', () => {
    const text = JSON.stringify(paymentImageTree({ ...input, qrPayload: vietQrPayload({ bin: '970436', accountNumber: '1', amount: 1n, content: 'A' }) }));
    for (const value of ['Thông báo học phí tháng 10/2026', 'HS001 · Nguyễn Minh Anh', 'OBL-202610-000123', '10/10/2026', '1.500.000 đ', '-150.000 đ', 'Tổng cần nộp', '1.350.000 đ', 'Vietcombank', 'Nguyen Minh Anh Mam 4A']) expect(text).toContain(value);
  });
});
