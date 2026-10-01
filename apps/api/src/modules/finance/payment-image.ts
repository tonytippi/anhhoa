import { readFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import QRCode from "qrcode";
import satori from "satori";

export type PaymentImagePart = {
  channel: "SCHOOL" | "PERSONAL";
  obligationCode: string;
  rows: { label: string; amount: bigint }[];
  total: bigint;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  transferContent: string;
  // Null for a refund part (negative total): the School pays the parent back, nothing is scanned.
  qrPayload: string | null;
};

// A payment notice has one part per unsettled channel Invoice, School-account part first.
export type PaymentImageInput = {
  schoolName: string;
  billingMonth: string;
  studentCode: string;
  studentName: string;
  className: string;
  dueOn: string;
  parts: PaymentImagePart[];
};

const font = (file: string) => readFileSync(new URL(`../../../assets/fonts/${file}`, import.meta.url));
let fonts: { name: string; data: Buffer; weight: 400 | 700 | 800; style: "normal" }[] | undefined;
const loadFonts = () => fonts ??= [
  { name: "Be Vietnam Pro", data: font("BeVietnamPro-Regular.ttf"), weight: 400, style: "normal" },
  { name: "Be Vietnam Pro", data: font("BeVietnamPro-Bold.ttf"), weight: 700, style: "normal" },
  { name: "Be Vietnam Pro", data: font("BeVietnamPro-ExtraBold.ttf"), weight: 800, style: "normal" },
];

export const formatVnd = (amount: bigint) => `${amount < 0n ? "-" : ""}${(amount < 0n ? -amount : amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")} đ`;
const month = (value: string) => `${value.slice(5, 7)}/${value.slice(0, 4)}`;
const date = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;

function qrSvg(payload: string) {
  const qr = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const size = qr.modules.size, quiet = 2;
  let path = "";
  for (let row = 0; row < size; row++) for (let column = 0; column < size; column++) if (qr.modules.get(row, column)) path += `M${column + quiet} ${row + quiet}h1v1h-1z`;
  const box = size + quiet * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${box} ${box}" shape-rendering="crispEdges"><rect width="${box}" height="${box}" fill="#fff"/><path d="${path}" fill="#111"/></svg>`;
}

type Node = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, ...children: (Node | string)[]): Node => ({ type, props: { style, children: children.length === 1 ? children[0] : children } });
const ink = "#1f2d27", muted = "#5b6b63", green = "#2f7d4f";

export function paymentImageTree(input: PaymentImageInput): Node {
  const fact = (label: string, value: string) => h("div", { display: "flex", fontSize: 28, lineHeight: 1.5 }, h("div", { width: 230, color: muted }, label), h("div", { flex: 1, fontWeight: 700 }, value));
  const row = (label: string, amount: string, last = false) => h("div", { display: "flex", justifyContent: "space-between", gap: 24, padding: "14px 0", fontSize: 28, borderBottom: last ? "none" : "1px solid #e3e8e5" }, h("div", { flex: 1 }, label), h("div", { whiteSpace: "nowrap" }, amount));
  const payFact = (label: string, value: string, content = false) => h("div", { display: "flex", flexDirection: "column", marginBottom: 14 }, h("div", { color: muted, fontSize: 24 }, label), h("div", { fontWeight: 700, fontSize: 30, ...(content ? { background: "#fff", padding: "6px 12px", borderRadius: 8 } : {}) }, value));
  const several = input.parts.length > 1;
  const refundOnly = input.parts.every((item) => item.total < 0n);
  const refund = (item: PaymentImagePart, index: number) => h("div", { display: "flex", flexDirection: "column", marginTop: 36 },
    ...(several ? [h("div", { display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: `2px solid ${green}` }, h("div", { color: green, fontWeight: 800, fontSize: 30 }, `Phần ${index + 1} · ${item.channel === "SCHOOL" ? "Tài khoản trường" : "Tài khoản cá nhân"}`), h("div", { color: muted, fontSize: 24 }, `Mã: ${item.obligationCode}`))] : []),
    h("div", { display: "flex", justifyContent: "space-between", padding: "12px 0", color: muted, fontSize: 26, fontWeight: 700, borderBottom: "2px solid #d5ddd8" }, h("div", {}, "Nội dung"), h("div", {}, "Số tiền")),
    ...item.rows.map((entry, rowIndex) => row(entry.label, formatVnd(entry.amount), rowIndex === item.rows.length - 1)),
    h("div", { display: "flex", justifyContent: "space-between", paddingTop: 22, fontSize: 36, fontWeight: 800, borderTop: "2px solid #d5ddd8" }, h("div", {}, several ? `Trường hoàn lại phần ${index + 1}` : "Trường hoàn lại cho phụ huynh"), h("div", {}, formatVnd(-item.total))));
  const part = (item: PaymentImagePart, index: number) => {
    if (!item.qrPayload) return refund(item, index);
    const qr = `data:image/svg+xml;base64,${Buffer.from(qrSvg(item.qrPayload)).toString("base64")}`;
    return h("div", { display: "flex", flexDirection: "column", marginTop: 36 },
      ...(several ? [h("div", { display: "flex", justifyContent: "space-between", alignItems: "baseline", paddingBottom: 12, borderBottom: `2px solid ${green}` }, h("div", { color: green, fontWeight: 800, fontSize: 30 }, `Phần ${index + 1} · Thu vào ${item.channel === "SCHOOL" ? "tài khoản trường" : "tài khoản cá nhân"}`), h("div", { color: muted, fontSize: 24 }, `Mã: ${item.obligationCode}`))] : []),
      h("div", { display: "flex", justifyContent: "space-between", padding: "12px 0", color: muted, fontSize: 26, fontWeight: 700, borderBottom: "2px solid #d5ddd8" }, h("div", {}, "Khoản thu"), h("div", {}, "Số tiền")),
      ...item.rows.map((entry, rowIndex) => row(entry.label, formatVnd(entry.amount), rowIndex === item.rows.length - 1)),
      h("div", { display: "flex", justifyContent: "space-between", paddingTop: 22, fontSize: 36, fontWeight: 800, borderTop: "2px solid #d5ddd8" }, h("div", {}, several ? `Tổng phần ${index + 1}` : "Tổng cần nộp"), h("div", {}, formatVnd(item.total))),
      h("div", { display: "flex", alignItems: "center", gap: 40, marginTop: 28, padding: 32, background: "#f1f7f3", borderRadius: 24 },
        { type: "img", props: { src: qr, width: 400, height: 400, style: { borderRadius: 12 } } },
        h("div", { display: "flex", flexDirection: "column", flex: 1 },
          payFact("Ngân hàng", item.bankName),
          payFact("Số tài khoản", item.accountNumber),
          payFact("Chủ tài khoản", item.accountHolderName),
          payFact("Nội dung chuyển khoản", item.transferContent, true))));
  };
  const grandTotal = input.parts.reduce((sum, item) => sum + item.total, 0n);
  return h("div", { display: "flex", flexDirection: "column", width: 1080, padding: "64px 64px 56px", background: "#fff", color: ink, fontFamily: "Be Vietnam Pro" },
    h("div", { display: "flex", flexDirection: "column", borderBottom: `3px solid ${green}`, paddingBottom: 28, marginBottom: 32 },
      h("div", { color: green, fontWeight: 800, fontSize: 26, letterSpacing: 2 }, input.schoolName.toUpperCase()),
      h("div", { marginTop: 8, fontWeight: 800, fontSize: 44 }, refundOnly ? `Phiếu hoàn tiền tháng ${month(input.billingMonth)}` : `Thông báo học phí tháng ${month(input.billingMonth)}`)),
    fact("Học sinh", `${input.studentCode} · ${input.studentName}`),
    fact("Lớp", input.className),
    ...(several ? [] : [fact("Mã hóa đơn", input.parts[0]!.obligationCode)]),
    ...(refundOnly ? [] : [fact("Hạn thanh toán", date(input.dueOn))]),
    ...input.parts.map(part),
    ...(several ? [h("div", { display: "flex", justifyContent: "space-between", marginTop: 36, padding: "24px 32px", background: ink, color: "#fff", borderRadius: 16, fontSize: 34, fontWeight: 800 }, h("div", {}, refundOnly ? `Trường hoàn lại cho phụ huynh (${input.parts.length} lần chi)` : grandTotal < 0n ? "Trường hoàn lại cho phụ huynh (sau khi trừ phần phải nộp)" : `Tổng cần nộp (${input.parts.length} lần chuyển khoản)`), h("div", {}, formatVnd(grandTotal < 0n ? -grandTotal : grandTotal)))] : []),
    h("div", { marginTop: 32, color: muted, fontSize: 24 }, refundOnly ? "Nhà trường chuyển khoản hoặc trả tiền mặt đúng số tiền từng phần và xác nhận sau khi chi." : several ? "Quét từng mã bằng ứng dụng ngân hàng để chuyển đúng số tiền và nội dung của từng phần. Nhà trường xác nhận sau khi nhận được tiền." : "Quét mã bằng ứng dụng ngân hàng để chuyển đúng số tiền và nội dung. Nhà trường xác nhận sau khi nhận được tiền."));
}

export async function renderPaymentImage(input: PaymentImageInput) {
  const svg = await satori(paymentImageTree(input) as any, { width: 1080, fonts: loadFonts() });
  return new Resvg(svg, { fitTo: { mode: "width", value: 1080 }, font: { loadSystemFonts: false } }).render().asPng();
}
