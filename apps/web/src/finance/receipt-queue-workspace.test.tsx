import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptQueueWorkspace } from "./receipt-queue-workspace";

const row = { id: "invoice-a", student: { code: "HS001", name: "Bé An" }, class: { id: "class-a", name: "Lá 1" }, schoolYearId: "year-a", billingMonth: "2026-09", issuedAt: "2026-09-01T00:00:00.000Z", outstanding: "120000", status: "ISSUED" as const };
const queue = { invoices: [row], filters: { schoolYearId: null, billingMonth: "2026-09", classIdSnapshot: null, student: null }, meta: { nextCursor: null } };
const detail = { id: "invoice-a", status: "ISSUED", outstanding: "120000", student: { code: "HS001", name: "Bé An" } };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

const openReceiptMenu = async () => {
  await screen.findByRole("button", { name: "Tùy chọn cho Bé An" });
  // A queue reload can re-render the row trigger mid-keypress; re-query and reopen until the menu is present.
  await waitFor(() => {
    if (!screen.queryByRole("menuitem", { name: "Ghi thực nhận" }))
      fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho Bé An" }), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Ghi thực nhận" })).toBeTruthy();
  });
};

afterEach(() => { cleanup(); document.querySelectorAll("[data-base-ui-portal]").forEach((portal) => portal.remove()); vi.unstubAllGlobals(); });

describe("ReceiptQueueWorkspace", () => {
  it("lists a negative Invoice as a refund and records an exact payout instead of a receipt", async () => {
    const refundRow = { ...row, id: "invoice-r", outstanding: "-448000", direction: "REFUND" as const };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({ status: "COMPLETED", outcome: { id: "invoice-r", student: row.student, status: "CLOSED", receipt: null, carries: [], payout: { amount: "448000", paidOn: "2026-09-12", method: "CASH", reference: "Phiếu chi 12" } } }));
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [] }));
      if (url.includes("/receipt-queue/invoice-r")) return Promise.resolve(response({ id: "invoice-r", status: "ISSUED", outstanding: "-448000", direction: "REFUND", student: row.student }));
      return Promise.resolve(response({ ...queue, invoices: [refundRow] }));
    });
    vi.stubGlobal("fetch", fetch); render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByText("Hoàn 448.000 VND");
    expect(screen.getByText("Chờ chi hoàn")).toBeTruthy();
    await waitFor(() => {
      if (!screen.queryByRole("menuitem", { name: "Ghi nhận đã chi" })) fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho Bé An" }), { key: "ArrowDown" });
      expect(screen.getByRole("menuitem", { name: "Ghi nhận đã chi" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Ghi nhận đã chi" }));
    const dialog = await screen.findByRole("dialog", { name: "Ghi nhận đã chi cho Bé An" });
    expect(dialog.textContent).toContain("Số tiền phải chi do hệ thống xác nhận: 448.000 VND.");
    expect((within(dialog).getByRole("button", { name: "Xác nhận đã chi" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Ngày chi"), { target: { value: "2026-09-12" } });
    fireEvent.change(within(dialog).getByLabelText("Hình thức"), { target: { value: "CASH" } });
    fireEvent.change(within(dialog).getByLabelText("Mã giao dịch hoặc ghi chú"), { target: { value: "Phiếu chi 12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận đã chi" }));
    await screen.findByRole("heading", { name: "Đã ghi nhận chi hoàn" });
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    expect(String(post[0])).toMatch(/\/invoices\/invoice-r\/payout$/);
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ paidOn: "2026-09-12", method: "CASH", reference: "Phiếu chi 12" });
  });
  it("opens one server-authorized Invoice from an accessible row menu and only offers next after the refreshed queue", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({ status: "COMPLETED", outcome: { ...detail, status: "CLOSED", receipt: { actualAmount: "120000", outcome: "EXACT", difference: null }, carries: [], coverageFacts: [{ billingMonth: "2026-10", issuedAt: "2026-09-20T00:00:00.000Z" }] } }));
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [{ id: "class-a", name: "Lá 1" }] }));
      if (url.includes("/receipt-queue/invoice-a")) return Promise.resolve(response(detail));
      return Promise.resolve(response(queue));
    });
    vi.stubGlobal("fetch", fetch); render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByText("HS001 / Bé An");
    await openReceiptMenu();
    const receiptAction = screen.getByRole("menuitem", { name: "Ghi thực nhận" });
    expect(receiptAction.closest('[role="menu"]')?.parentElement?.parentElement?.parentElement).toBe(document.body);
    fireEvent.click(receiptAction);
    const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận cho Bé An" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await screen.findByRole("heading", { name: "Kết quả ghi thực nhận" });
    expect(screen.getByText("Thực nhận: 120.000 VND.")).toBeTruthy();
    expect(screen.getByText("Kết quả máy chủ: Đủ.")).toBeTruthy();
    expect(screen.getByText("Chênh lệch: 0 VND.")).toBeTruthy();
    expect(screen.getByText("Trạng thái chuyển kỳ: Máy chủ chưa tạo khoản chuyển kỳ cho hóa đơn này.")).toBeTruthy();
    expect(screen.getByText("Coverage kỳ 2026-10 đã phát hành.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Hóa đơn tiếp theo" })).toBeNull();
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes("receipt-queue?")).length).toBeGreaterThan(1));
  });
  it("clears protected state when Invoice detail is denied", async () => {
    const denied = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/classes") ? response({ classes: [] }) : url.includes("/receipt-queue/invoice-a") ? response({}, 403) : response(queue))));
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    await openReceiptMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ghi thực nhận" }));
    await waitFor(() => expect(denied).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the receipt dialog actionable after a validation error without polling an operation", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Số thực nhận không hợp lệ.", fieldErrors: { actualAmount: "Chỉ dùng số nguyên VND." } } }), { status: 400 }) : url.includes("/classes") ? response({ classes: [] }) : url.includes("/receipt-queue/invoice-a") ? response(detail) : response(queue)));
    vi.stubGlobal("fetch", fetch);
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openReceiptMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Ghi thực nhận" }));
    const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận cho Bé An" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await screen.findByText("Số thực nhận không hợp lệ.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(dialog).getByLabelText("Số thực nhận (VND)")).toHaveProperty("disabled", false);
    expect(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" })).toHaveProperty("disabled", false);
    expect(sessionStorage.getItem("passionedu.app.pending-receipt-queue-operation")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(false);
  });
});
