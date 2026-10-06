// NAPAS VietQR bank directory for receiving accounts. Source: https://api.vietqr.io/v2/banks
// (checked 2026-09-29), limited to banks with transfer support; e-wallets are excluded.
export const vietQrBanks: ReadonlyArray<{ bin: string; code: string; shortName: string; name: string }> = [
  { bin: "970436", code: "VCB", shortName: "Vietcombank", name: "Ngân hàng TMCP Ngoại Thương Việt Nam" },
  { bin: "970415", code: "ICB", shortName: "VietinBank", name: "Ngân hàng TMCP Công thương Việt Nam" },
  { bin: "970418", code: "BIDV", shortName: "BIDV", name: "Ngân hàng TMCP Đầu tư và Phát triển Việt Nam" },
  { bin: "970405", code: "VBA", shortName: "Agribank", name: "Ngân hàng Nông nghiệp và Phát triển Nông thôn Việt Nam" },
  { bin: "970407", code: "TCB", shortName: "Techcombank", name: "Ngân hàng TMCP Kỹ thương Việt Nam" },
  { bin: "970422", code: "MB", shortName: "MBBank", name: "Ngân hàng TMCP Quân đội" },
  { bin: "970416", code: "ACB", shortName: "ACB", name: "Ngân hàng TMCP Á Châu" },
  { bin: "970432", code: "VPB", shortName: "VPBank", name: "Ngân hàng TMCP Việt Nam Thịnh Vượng" },
  { bin: "970423", code: "TPB", shortName: "TPBank", name: "Ngân hàng TMCP Tiên Phong" },
  { bin: "970403", code: "STB", shortName: "Sacombank", name: "Ngân hàng TMCP Sài Gòn Thương Tín" },
  { bin: "970437", code: "HDB", shortName: "HDBank", name: "Ngân hàng TMCP Phát triển Thành phố Hồ Chí Minh" },
  { bin: "970441", code: "VIB", shortName: "VIB", name: "Ngân hàng TMCP Quốc tế Việt Nam" },
  { bin: "970443", code: "SHB", shortName: "SHB", name: "Ngân hàng TMCP Sài Gòn - Hà Nội" },
  { bin: "970431", code: "EIB", shortName: "Eximbank", name: "Ngân hàng TMCP Xuất Nhập khẩu Việt Nam" },
  { bin: "970426", code: "MSB", shortName: "MSB", name: "Ngân hàng TMCP Hàng Hải Việt Nam" },
  { bin: "970448", code: "OCB", shortName: "OCB", name: "Ngân hàng TMCP Phương Đông" },
  { bin: "970440", code: "SEAB", shortName: "SeABank", name: "Ngân hàng TMCP Đông Nam Á" },
  { bin: "970425", code: "ABB", shortName: "ABBANK", name: "Ngân hàng TMCP An Bình" },
  { bin: "970454", code: "VCCB", shortName: "VietCapitalBank", name: "Ngân hàng TMCP Bản Việt" },
  { bin: "970429", code: "SCB", shortName: "SCB", name: "Ngân hàng TMCP Sài Gòn" },
  { bin: "970449", code: "LPB", shortName: "LPBank", name: "Ngân hàng TMCP Lộc Phát Việt Nam" },
  { bin: "970452", code: "KLB", shortName: "KienLongBank", name: "Ngân hàng TMCP Kiên Long" },
  { bin: "970428", code: "NAB", shortName: "NamABank", name: "Ngân hàng TMCP Nam Á" },
  { bin: "970419", code: "NCB", shortName: "NCB", name: "Ngân hàng TMCP Quốc Dân" },
  { bin: "970412", code: "PVCB", shortName: "PVcomBank", name: "Ngân hàng TMCP Đại Chúng Việt Nam" },
  { bin: "970438", code: "BVB", shortName: "BaoVietBank", name: "Ngân hàng TMCP Bảo Việt" },
  { bin: "970409", code: "BAB", shortName: "BacABank", name: "Ngân hàng TMCP Bắc Á" },
  { bin: "970430", code: "PGB", shortName: "PGBank", name: "Ngân hàng TMCP Thịnh vượng và Phát triển" },
  { bin: "970427", code: "VAB", shortName: "VietABank", name: "Ngân hàng TMCP Việt Á" },
  { bin: "970433", code: "VIETBANK", shortName: "VietBank", name: "Ngân hàng TMCP Việt Nam Thương Tín" },
  { bin: "970400", code: "SGICB", shortName: "SaigonBank", name: "Ngân hàng TMCP Sài Gòn Công Thương" },
  { bin: "970414", code: "MBV", shortName: "MBV", name: "Ngân hàng TNHH MTV Việt Nam Hiện Đại" },
  { bin: "970446", code: "COOPBANK", shortName: "COOPBANK", name: "Ngân hàng Hợp tác xã Việt Nam" },
  { bin: "970424", code: "SHBVN", shortName: "ShinhanBank", name: "Ngân hàng TNHH MTV Shinhan Việt Nam" },
  { bin: "970457", code: "WVN", shortName: "Woori", name: "Ngân hàng TNHH MTV Woori Việt Nam" },
  { bin: "422589", code: "CIMB", shortName: "CIMB", name: "Ngân hàng TNHH MTV CIMB Việt Nam" },
  { bin: "668888", code: "KBANK", shortName: "KBank", name: "Ngân hàng Đại chúng TNHH Kasikornbank" },
  { bin: "546034", code: "CAKE", shortName: "CAKE", name: "Ngân hàng số CAKE by VPBank" },
  { bin: "546035", code: "UBANK", shortName: "Ubank", name: "Ngân hàng số Ubank by VPBank" },
  { bin: "963388", code: "TIMO", shortName: "Timo", name: "Ngân hàng số Timo by Ban Viet Bank" },
];

export const vietQrBank = (bin: unknown) => vietQrBanks.find((bank) => bank.bin === bin);

// The short VietQR code (TCB, VCB…) names a receiving account on Finance lists; an unknown BIN keeps the snapshot bank name.
export const vietQrBankCode = (bin: unknown, fallback: string | null | undefined) => vietQrBank(bin)?.code ?? fallback ?? "";

export const transferContentLimit = 50;
const plain = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").replace(/[^A-Za-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// `<Student name> <Class name>` without diacritics; a long Student name is shortened by whole words so the Class name stays complete.
export function transferContent(studentName: string, className: string) {
  const student = plain(studentName), klass = plain(className);
  const full = [student, klass].filter(Boolean).join(" ");
  if (full.length <= transferContentLimit) return full;
  if (klass.length + 1 >= transferContentLimit) return full.slice(0, transferContentLimit).trim();
  const budget = transferContentLimit - klass.length - 1;
  let shortened = "";
  for (const word of student.split(" ")) {
    const next = shortened ? `${shortened} ${word}` : word;
    if (next.length > budget) break;
    shortened = next;
  }
  if (!shortened) shortened = student.slice(0, budget);
  return `${shortened} ${klass}`;
}

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

export function crc16(value: string) {
  let crc = 0xffff;
  for (const byte of Buffer.from(value, "utf8")) {
    crc ^= byte << 8;
    for (let bit = 0; bit < 8; bit++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

// EMVCo merchant-presented QR per NAPAS VietQR: dynamic, account transfer (QRIBFTTA), VND, fixed amount and content.
export function vietQrPayload(input: { bin: string; accountNumber: string; amount: bigint; content: string }) {
  if (!vietQrBank(input.bin)) throw new Error("Unknown VietQR bank BIN");
  if (input.amount <= 0n) throw new Error("VietQR amount must be positive");
  const beneficiary = field("00", input.bin) + field("01", input.accountNumber.replace(/\s+/g, ""));
  const merchant = field("00", "A000000727") + field("01", beneficiary) + field("02", "QRIBFTTA");
  const body = field("00", "01") + field("01", "12") + field("38", merchant) + field("53", "704") + field("54", input.amount.toString()) + field("58", "VN") + field("62", field("08", input.content)) + "6304";
  return body + crc16(body);
}
