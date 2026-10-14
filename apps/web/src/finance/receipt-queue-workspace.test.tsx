import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptQueueWorkspace } from "./receipt-queue-workspace";

const schoolAccount = { id: "bank-school", kind: "SCHOOL" as const, bankCode: "VCB", accountHolderName: "TRUONG MN ANH HOA", accountNumber: "0123456789" };
const personalAccount = { id: "bank-an", kind: "PERSONAL" as const, bankCode: "ABB", accountHolderName: "NGUYEN VAN AN", accountNumber: "215000002088" };
const row = { id: "invoice-a", channel: "SCHOOL" as const, obligationCode: "OBL-202609-000123", account: schoolAccount, student: { code: "HS001", name: "Bé An" }, class: { id: "class-a", name: "Lá 1" }, schoolYearId: "year-a", billingMonth: "2026-09", issuedAt: "2026-09-01T00:00:00.000Z", outstanding: "120000", status: "ISSUED" as const };
const queue = { invoices: [row], filters: { schoolYearId: null, billingMonth: "2026-09", classIdSnapshot: null, student: null }, meta: { nextCursor: null } };
const detail = { id: "invoice-a", channel: "SCHOOL", obligationCode: "OBL-202609-000123", account: schoolAccount, status: "ISSUED", outstanding: "120000", student: { code: "HS001", name: "Bé An" }, className: "Lá 1", periodLabel: "Tháng 09/2026", issuedTotal: "120000", lines: [{ id: "line-a", receivableName: "Học phí", unitLabel: "tháng", quantity: 1, amount: "120000" }] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

const openReceiptMenu = async () => {
  await screen.findByRole("button", { name: "Tùy chọn cho Bé An · Tài khoản trường" });
  // A queue reload can re-render the row trigger mid-keypress; re-query and reopen until the menu is present.
  await waitFor(() => {
    if (!screen.queryByRole("menuitem", { name: "Ghi thực nhận" }))
      fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho Bé An · Tài khoản trường" }), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Ghi thực nhận" })).toBeTruthy();
  });
};

afterEach(() => { cleanup(); document.querySelectorAll("[data-base-ui-portal]").forEach((portal) => portal.remove()); vi.unstubAllGlobals(); });

describe("ReceiptQueueWorkspace", () => {
  it("lists a negative Invoice as a refund and records an exact payout instead of a receipt", async () => {
    const refundRow = { ...row, id: "invoice-r", channel: "PERSONAL" as const, account: personalAccount, outstanding: "-448000", direction: "REFUND" as const };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({ status: "COMPLETED", outcome: { id: "invoice-r", student: row.student, status: "CLOSED", receipt: null, carries: [], payout: { amount: "448000", paidOn: "2026-09-12", method: "CASH", reference: "Phiếu chi 12" } } }));
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [] }));
      if (url.includes("/receipt-queue/invoice-r")) return Promise.resolve(response({ id: "invoice-r", channel: "PERSONAL", obligationCode: "OBL-202609-000312", account: personalAccount, status: "ISSUED", outstanding: "-448000", direction: "REFUND", student: row.student }));
      return Promise.resolve(response({ ...queue, invoices: [refundRow] }));
    });
    vi.stubGlobal("fetch", fetch); render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByText("Hoàn 448.000 đ");
    expect(screen.getByText("Chờ chi hoàn")).toBeTruthy();
    await waitFor(() => {
      if (!screen.queryByRole("menuitem", { name: "Ghi nhận đã chi" })) fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho Bé An · Tài khoản cá nhân" }), { key: "ArrowDown" });
      expect(screen.getByRole("menuitem", { name: "Ghi nhận đã chi" })).toBeTruthy();
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Ghi nhận đã chi" }));
    const dialog = await screen.findByRole("dialog", { name: "Ghi nhận đã chi cho Bé An · ABB - NGUYEN VAN AN" });
    expect(dialog.textContent).toContain("Hóa đơn OBL-202609-000312 · tài khoản cá nhân ABB - NGUYEN VAN AN · 215000002088.");
    expect(dialog.textContent).toContain("Số tiền phải chi do hệ thống xác nhận: 448.000 đ.");
    expect((within(dialog).getByRole("button", { name: "Xác nhận đã chi" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(dialog).getByLabelText("Ngày chi"), { target: { value: "2026-09-12" } });
    fireEvent.change(within(dialog).getByLabelText("Hình thức"), { target: { value: "CASH" } });
    fireEvent.change(within(dialog).getByLabelText("Mã giao dịch hoặc ghi chú"), { target: { value: "Phiếu chi 12" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận đã chi" }));
    expect((await screen.findByRole("heading", { name: /^Đã ghi nhận chi hoàn 448\.000 đ · HS001 \/ Bé An$/ })).textContent).toBeTruthy();
    expect(screen.getByText("Ngày 12/09/2026 · Tiền mặt · Phiếu chi 12")).toBeTruthy();
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
    const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận · tháng 09/2026 Bé An" });
    expect(document.querySelector(".dialog-backdrop")).toBeTruthy();
    expect(dialog.textContent).toContain("HS001 · Lớp Lá 1 · Hóa đơn OBL-202609-000123");
    expect(within(dialog).getByRole("region", { name: "Tài khoản nhận" }).textContent).toBe("Tiền vào tài khoảnTài khoản trườngVCB 0123456789TRUONG MN ANH HOA");
    expect(within(dialog).getByRole("row", { name: "Học phí 1 tháng 120.000" })).toBeTruthy();
    expect(within(dialog).getByRole("row", { name: /Cần thu.*120\.000 đ/ })).toBeTruthy();
    expect(dialog.textContent).toContain("hóa đơn của tài khoản kia không đổi.");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await screen.findByRole("heading", { name: "Đã ghi thực nhận 120.000 đ · HS001 / Bé An" });
    expect(screen.getByText("Đủ · ưu đãi nộp trước kỳ 10/2026 đã phát hành")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    expect(screen.queryByRole("heading", { name: /^Đã ghi thực nhận/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "Hóa đơn tiếp theo" })).toBeNull();
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes("receipt-queue?")).length).toBeGreaterThan(1));
  });
  it("lists settled Invoices with what was received and no actions", async () => {
    const settledRow = { ...row, status: "CLOSED" as const, settlement: { type: "RECEIPT" as const, amount: "100000", outcome: "SHORTFALL" as const, on: "2026-09-15" } };
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("/classes") ? response({ classes: [] }) : url.includes("state=SETTLED") ? response({ ...queue, invoices: [settledRow], filters: { ...queue.filters, state: "SETTLED" } }) : response(queue)));
    vi.stubGlobal("fetch", fetch);
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole("button", { name: "Tùy chọn cho Bé An · Tài khoản trường" });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "SETTLED" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    const table = await screen.findByRole("table", { name: "Hóa đơn đã thu và phiếu hoàn tiền đã chi" });
    expect(within(table).getByRole("row", { name: /HS001 \/ Bé An.*100\.000 đ.*Ngày 15\/09\/2026.*Thu thiếu/ })).toBeTruthy();
    expect(within(table).queryByRole("button")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/classes?") && String(url).includes("state=SETTLED"))).toBe(true);
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
    const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận · tháng 09/2026 Bé An" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await screen.findByText("Số thực nhận không hợp lệ.");
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(within(dialog).getByLabelText("Số thực nhận (đ)")).toHaveProperty("disabled", false);
    expect(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" })).toHaveProperty("disabled", false);
    expect(sessionStorage.getItem("passionedu.app.pending-receipt-queue-operation")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(false);
  });
  it("shows each row's receiving account and filters by a server-listed account grouped by kind", async () => {
    const personalRow = { ...row, id: "invoice-p", channel: "PERSONAL" as const, account: personalAccount, outstanding: "770000" };
    const fetch = vi.fn((url: string) => {
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [], accounts: [schoolAccount, personalAccount], months: ["2026-09", "2026-08"] }));
      return Promise.resolve(response({ ...queue, invoices: url.includes("bankAccountId=bank-an") ? [personalRow] : [row, personalRow], filters: { ...queue.filters, bankAccountId: url.includes("bankAccountId=bank-an") ? "bank-an" : null } }));
    });
    vi.stubGlobal("fetch", fetch);
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const table = await screen.findByRole("table");
    await within(table).findByText("VCB - TRUONG MN ANH HOA");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("0123456789")).toBeTruthy();
    expect(within(rows[0]!).getByText("Tài khoản trường").className).toBe("sr-only");
    expect(within(rows[1]!).getByText("ABB - NGUYEN VAN AN")).toBeTruthy();
    expect(within(rows[1]!).queryByText("Tài khoản trường")).toBeNull();
    const select = screen.getByLabelText("Tài khoản nhận") as HTMLSelectElement;
    await waitFor(() => expect(select.querySelectorAll("optgroup")).toHaveLength(2));
    expect([...select.querySelectorAll("optgroup")].map((group) => [group.label, [...group.querySelectorAll("option")].map((option) => option.textContent)])).toEqual([
      ["Tài khoản trường", ["VCB - TRUONG MN ANH HOA · 0123456789"]],
      ["Tài khoản cá nhân", ["ABB - NGUYEN VAN AN · 215000002088"]],
    ]);
    // The month opens on the server's latest month with issued Invoices; there is no school-year picker.
    const month = screen.getByLabelText("Tháng thu") as HTMLSelectElement;
    expect(month.value).toBe("2026-09");
    expect([...month.options].map((option) => option.textContent)).toEqual(["Tất cả tháng", "Tháng 09/2026", "Tháng 08/2026"]);
    expect(screen.queryByLabelText("Năm học")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/receivables"))).toBe(false);
    fireEvent.change(select, { target: { value: "bank-an" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    await waitFor(() => expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2));
    expect(fetch.mock.calls.some(([url]) => String(url).includes("receipt-queue?") && String(url).includes("bankAccountId=bank-an"))).toBe(true);
    expect(select.value).toBe("bank-an");
  });

  it("shows the run period label in a Kỳ column for a class-scoped School and keeps the month column otherwise", async () => {
    const labelled = { ...queue, invoices: [{ ...row, periodLabel: "Starters A · Unit 3" }] };
    const fetch = () => vi.fn((url: string) => Promise.resolve(url.includes("/classes") ? response({ classes: [], months: ["2026-09"], accounts: [] }) : response(labelled)));
    vi.stubGlobal("fetch", fetch());
    const center = render(<ReceiptQueueWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" classRuns denied={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Hóa đơn chờ thu và phiếu hoàn tiền chờ chi" });
    const cells = within((await within(table).findByText(/HS001/)).closest("tr")!).getAllByRole("cell");
    expect(within(table).getAllByRole("columnheader")[3]!.textContent).toBe("Kỳ");
    expect(cells[2]!.textContent).toBe("Starters A · Unit 3");
    expect(screen.getByLabelText("Tháng thu")).toBeTruthy();
    center.unmount();
    vi.stubGlobal("fetch", fetch());
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const monthly = await screen.findByRole("table", { name: "Hóa đơn chờ thu và phiếu hoàn tiền chờ chi" });
    expect(within(monthly).getAllByRole("columnheader")[3]!.textContent).toBe("Tháng");
    expect(within((await within(monthly).findByText(/HS001/)).closest("tr")!).getAllByRole("cell")[2]!.textContent).toBe("09/2026");
  });
  it("names the invoice's own period by the run label in the receipt result for a class-scoped School and keeps the month otherwise", async () => {
    const labelled = { ...queue, invoices: [{ ...row, periodLabel: "Starters A · Unit 3" }] };
    const fetch = () => vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({ status: "COMPLETED", outcome: { ...detail, status: "CLOSED", receipt: { actualAmount: "120000", outcome: "EXACT", difference: null }, carries: [], coverageFacts: [{ billingMonth: "2026-09", issuedAt: "2026-09-20T00:00:00.000Z" }, { billingMonth: "2026-10", issuedAt: null }] } }));
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [{ id: "class-a", name: "Lá 1" }] }));
      if (url.includes("/receipt-queue/invoice-a")) return Promise.resolve(response(detail));
      return Promise.resolve(response(labelled));
    });
    const settle = async () => {
      await screen.findByText("HS001 / Bé An");
      await openReceiptMenu();
      fireEvent.click(screen.getByRole("menuitem", { name: "Ghi thực nhận" }));
      const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận · tháng 09/2026 Bé An" });
      fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
      await screen.findByRole("heading", { name: /^Đã ghi thực nhận/ });
    };
    vi.stubGlobal("fetch", fetch());
    const center = render(<ReceiptQueueWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" classRuns denied={vi.fn()} />);
    await settle();
    // Only the invoice's own period takes the run label; another covered month stays a month.
    expect(screen.getByText("Đủ · ưu đãi nộp trước kỳ Starters A · Unit 3 đã phát hành · ưu đãi nộp trước kỳ 10/2026 chưa phát hành")).toBeTruthy();
    center.unmount();
    document.querySelectorAll("[data-base-ui-portal]").forEach((portal) => portal.remove());
    vi.stubGlobal("fetch", fetch());
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await settle();
    expect(screen.getByText("Đủ · ưu đãi nộp trước kỳ 09/2026 đã phát hành · ưu đãi nộp trước kỳ 10/2026 chưa phát hành")).toBeTruthy();
  });
});
