import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceWorkspace as FinanceWorkspaceBase } from "./finance-workspace";

const FinanceWorkspace = (props: Omit<ComponentProps<typeof FinanceWorkspaceBase>, "page"> & { page?: ComponentProps<typeof FinanceWorkspaceBase>["page"] }) => <FinanceWorkspaceBase page="collection-runs" {...props} />;

const catalog = { groups: [], receivables: [] };
const fixtureStudentId = "22222222-2222-4222-8222-222222222222";
const run = {
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "year-a",
  billingMonth: "2026-09",
  type: "MONTHLY",
  status: "DRAFT",
  version: 2,
};
const candidates = {
  schoolYears: [
    {
      id: "year-a",
      name: "Năm 2026",
      startsOn: "2026-01-01",
      endsOn: "2027-01-01",
      closedAt: null,
    },
  ],
  students: [
    { id: fixtureStudentId, studentCode: "HS001", fullName: "Bé An" },
  ],
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), { status });
const openRun = async () => {
  await screen.findByRole("button", { name: "Tùy chọn cho đợt thu 2026-09" });
  // A list reload can re-render the row trigger mid-keypress; re-query and reopen until the menu is present.
  await waitFor(() => {
    if (!screen.queryByRole("menuitem", { name: "Mở chi tiết" }))
      fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho đợt thu 2026-09" }), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Mở chi tiết" })).toBeTruthy();
  });
  fireEvent.click(screen.getByRole("menuitem", { name: "Mở chi tiết" }));
};
afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-base-ui-portal]").forEach((portal) => portal.remove());
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("FinanceWorkspace", () => {
  it("loads only the receivables surface and stays usable when a promotion endpoint would fail", async () => {
    const fetch = vi.fn((url: string) => {
      if (url.includes("promotion")) return Promise.resolve(new Response(null, { status: 500 }));
      return Promise.resolve(response(catalog));
    });
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    await screen.findByRole("heading", { name: "Khoản thu", level: 1 });
    expect(screen.getByRole("button", { name: "Thêm khoản thu" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("promotion") || String(url).includes("collection-runs"))).toBe(false);
  });
  it("renders receivable columns from the catalog data without adding derived values", async () => {
    const catalogWithReceivables = {
      groups: [{ id: "group-a", name: "Khoản thu cố định", kind: "FIXED" as const }, { id: "group-b", name: "Khoản thu linh hoạt", kind: "FLEXIBLE" as const }],
      receivables: [
        { id: "receivable-a", groupId: "group-a", kind: "FIXED" as const, kindLocked: true, code: "HP", displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "1500000", refundUnitPrice: "0", taxCategory: "VAT_5" as const, channel: "SCHOOL" as const, status: "ACTIVE" as const, available: true },
        { id: "receivable-c", groupId: "group-a", kind: "FIXED" as const, code: "TA", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", refundUnitPrice: "28000", taxCategory: "NOT_DECLARED" as const, channel: "PERSONAL" as const, status: "ACTIVE" as const, available: true },
        { id: "receivable-b", groupId: "group-b", kind: "FLEXIBLE" as const, code: null, displayName: "Dã ngoại", unitLabel: "lần", defaultUnitPrice: "350000", status: "INACTIVE" as const, available: false },
      ],
    };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response(catalogWithReceivables))));
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Khoản thu theo trường" });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Khoản thu", "Mã", "Đơn giá mặc định (chưa VAT)", "Giá hoàn trả", "Thuế", "Trạng thái", "Tùy chọn"]);
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Học phíKhoản thu cố định", "HP", "1.500.000 VND / tháng", "—", "5%Tài khoản trường", "Đang áp dụng", "..."]);
    expect(within(rows[2]!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Tiền ănKhoản thu cố định · đơn vị ngày", "TA", "35.000 VND / ngày", "28.000 VND / ngày", "Không kê khaiTài khoản cá nhân", "Đang áp dụng", "..."]);
    expect(within(rows[3]!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Dã ngoạiKhoản thu linh hoạt · đơn vị lần", "-", "350.000 VND / lần", "—", "Không kê khaiTài khoản cá nhân", "Ngừng áp dụng", "..."]);
    expect(table.parentElement?.classList.contains("table-scroll")).toBe(true);
  });
  it("spans all receivable columns for an empty catalog", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response(catalog))));
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const emptyCell = await screen.findByText("Chưa có khoản thu.");
    expect(emptyCell.getAttribute("colspan")).toBe("7");
  });
  it("opens a receivable action menu as an overlay without changing the table row layout", async () => {
    const catalogWithReceivable = { groups: [{ id: "group", name: "Học tập", status: "ACTIVE" as const }], receivables: [{ id: "receivable", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE" as const, available: true }] };
    vi.stubGlobal("fetch", vi.fn(() => Promise.resolve(response(catalogWithReceivable))));
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const action = await screen.findByRole("button", { name: "Tùy chọn cho Học phí" });
    fireEvent.click(action);
    const menu = screen.getByRole("menu");
    expect(menu.classList.contains("finance-anchored-action-menu")).toBe(true);
    expect(menu.parentElement?.parentElement?.parentElement).toBe(document.body);
    expect(within(menu).getByRole("menuitem", { name: "Ngừng áp dụng" })).toBeTruthy();
  });
  it("loads promotion data without collection runs", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    await screen.findByRole("heading", { name: "Ưu đãi", level: 1 });
    expect(screen.getByRole("button", { name: "Thêm chính sách" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("collection-runs"))).toBe(false);
  });
  it("groups each finance list action in its responsive toolbar and keeps the run filter behavior", async () => {
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [run], meta: { nextCursor: null } }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const receivablesToolbar = await screen.findByRole("form", { name: "Điều khiển danh sách khoản thu" });
    expect(receivablesToolbar.querySelectorAll("button")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Quản lý nhóm" })).toBeNull();
    expect(screen.getByRole("button", { name: "Thêm khoản thu" }).classList.contains("primary-action")).toBe(true);
    view.rerender(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    const promotionsToolbar = await screen.findByRole("form", { name: "Điều khiển danh sách ưu đãi" });
    expect(promotionsToolbar.querySelectorAll("button")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Thêm chính sách" }).classList.contains("primary-action")).toBe(true);
    view.rerender(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const runsToolbar = await screen.findByRole("form", { name: "Điều khiển danh sách đợt thu" });
    expect(runsToolbar.contains(screen.getByLabelText("Lọc trạng thái"))).toBe(true);
    expect(runsToolbar.contains(screen.getByRole("button", { name: "Tạo đợt thu" }))).toBe(true);
    fireEvent.change(screen.getByLabelText("Lọc trạng thái"), { target: { value: "CLOSED" } });
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("collection-runs?limit=25&status=CLOSED"))).toBe(true));
  });
  it("renders only the routed Invoice destination and navigates Back and adjacent Students through the route", async () => {
    const routedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }, { id: "invoice-b", studentId: "student-b", studentCode: "HS002", studentName: "Bé Bình", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const routedInvoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] };
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("/invoices/invoice-a") ? response(routedInvoice) : url.endsWith(`/collection-runs/${run.id}`) ? response(routedRun) : url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [routedRun], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const onOpenInvoice = vi.fn();
    const onBackToRun = vi.fn();
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} invoiceId="invoice-a" onOpenRun={vi.fn()} onOpenInvoice={onOpenInvoice} onBackToRun={onBackToRun} denied={vi.fn()} />);
    const review = await screen.findByRole("region", { name: "Rà soát hóa đơn HS001 / Bé An" });
    expect(within(review).getByRole("heading", { level: 1, name: "Rà soát hóa đơn" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Hóa đơn hiện có trong đợt thu" })).toBeNull();
    expect(screen.queryByRole("list", { name: "Tiến trình đợt thu" })).toBeNull();
    fireEvent.click(within(review).getByRole("button", { name: "Học sinh tiếp theo" }));
    expect(onOpenInvoice).toHaveBeenCalledWith(run.id, "invoice-b");
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/invoices/invoice-b"))).toBe(false);
    fireEvent.click(within(review).getByRole("button", { name: "Quay lại đợt thu" }));
    expect(onBackToRun).toHaveBeenCalledWith(run.id);
  });
  it("creates a receivable with its tax category and changes the category through the server", async () => {
    const receivables = [{ id: "receivable-a", groupId: "group", code: "HP", displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "3500000", taxCategory: "NOT_DECLARED", channel: "PERSONAL", status: "ACTIVE", available: true }];
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method ? response({ status: "COMPLETED", outcome: { id: "receivable-a" } }) : response({ groups: [{ id: "group", name: "Khoản thu cố định", kind: "FIXED" }], receivables })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm khoản thu" }));
    const tax = screen.getByLabelText("Mức thuế suất") as HTMLSelectElement;
    expect(Array.from(tax.options).map((option) => option.textContent)).toEqual(["Không kê khai nộp thuế", "Không chịu thuế", "Thuế suất 0%", "Thuế suất 5%", "Thuế suất 8%", "Thuế suất 10%"]);
    expect(screen.getByText("Thu vào tài khoản cá nhân")).toBeTruthy();
    fireEvent.change(tax, { target: { value: "VAT_10" } });
    expect(screen.getByText("Thu vào tài khoản trường")).toBeTruthy();
    expect(screen.getByText("Chọn một trong ba nhóm cố định của Trường.")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "Ngoại khóa" }));
    expect(screen.getByText("Thu theo lớp ngoại khóa; gắn khoản thu vào lớp ở trang Lớp ngoại khóa.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Tên khoản thu"), { target: { value: "Tiếng Anh" } });
    fireEvent.change(screen.getByLabelText("Đơn vị tính"), { target: { value: "tháng" } });
    fireEvent.change(screen.getByLabelText("Giá / đơn vị (chưa VAT)"), { target: { value: "600000" } });
    expect((screen.getByLabelText("Giá hoàn trả / đơn vị (chưa VAT)") as HTMLInputElement).value).toBe("0");
    fireEvent.change(screen.getByLabelText("Giá hoàn trả / đơn vị (chưa VAT)"), { target: { value: "700000" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/finance/receivables") && options?.method === "POST" && JSON.parse(String(options.body)).taxCategory === "VAT_10" && JSON.parse(String(options.body)).refundUnitPrice === "700000" && JSON.parse(String(options.body)).kind === "EXTRACURRICULAR" && !("groupId" in JSON.parse(String(options.body))))).toBe(true));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Tùy chọn cho Học phí" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Đổi giá hoàn trả" }));
    const refund = await screen.findByRole("dialog", { name: /Đổi giá hoàn trả/ });
    fireEvent.change(within(refund).getByLabelText("Giá hoàn trả / tháng (chưa VAT)"), { target: { value: "2000000" } });
    fireEvent.click(within(refund).getByRole("button", { name: "Lưu giá hoàn trả" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/finance/receivables/receivable-a/refund-price") && (options as RequestInit).method === "PUT" && (options as RequestInit).body === JSON.stringify({ refundUnitPrice: "2000000" }))).toBe(true));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Tùy chọn cho Học phí" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Đổi mức thuế suất" }));
    const dialog = await screen.findByRole("dialog", { name: /Đổi mức thuế suất/ });
    fireEvent.change(within(dialog).getByLabelText("Mức thuế suất"), { target: { value: "EXEMPT" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu mức thuế suất" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/finance/receivables/receivable-a/tax-category") && (options as RequestInit).method === "PUT" && (options as RequestInit).body === JSON.stringify({ taxCategory: "EXEMPT" }))).toBe(true));
  });
  it("reviews and issues a two-part payment notice with the School account and the Class default personal account", async () => {
    const line = (id: string, name: string, amount: string, extra: Record<string, unknown> = {}) => ({ id, receivableId: `r-${id}`, receivableName: name, unitLabel: "tháng", unitPrice: amount, quantity: "1", amount, grossAmount: amount, discountAmount: "0", netAmount: amount, taxCategory: "NOT_DECLARED", vatRate: null, vatAmount: "0", promotionEvaluation: null, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null, ...extra });
    const base = { status: "DRAFT", billingMonth: "2026-10", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, settlementTransfer: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Mầm 4A" } };
    const schoolPart = { ...base, id: "invoice-school", channel: "SCHOOL", total: "1417500", lines: [line("a", "Học phí", "1417500", { grossAmount: "1500000", discountAmount: "150000", netAmount: "1350000", taxCategory: "VAT_5", vatRate: 5, vatAmount: "67500" })] };
    const personalPart = { ...base, id: "invoice-personal", channel: "PERSONAL", total: "686000", lines: [line("b", "Tiền ăn", "686000", { unitLabel: "ngày", unitPrice: "35000", quantity: "22", grossAmount: "770000", netAmount: "686000", refundUnitPrice: "28000", deductionQuantity: "3", proposedDeductionQuantity: "3", deductionAmount: "84000", deductionReason: null, deductionSource: { month: "2026-09", days: ["2026-09-04", "2026-09-15", "2026-09-16"], proposedUnitPrice: "28000" } })] };
    const notice = { classDefaultBankAccountId: "bank-an", invoices: [schoolPart, personalPart] };
    const routedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-school", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Mầm 4A", status: "DRAFT", total: "1417500", channel: "SCHOOL" }, { id: "invoice-personal", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Mầm 4A", status: "DRAFT", total: "770000", channel: "PERSONAL" }] };
    const accounts = [{ id: "bank-school", kind: "SCHOOL", receivingBank: "Vietcombank", accountNumber: "0123456789", accountHolderName: "TRUONG MN" }, { id: "bank-binh", kind: "PERSONAL", receivingBank: "Techcombank", accountNumber: "1903", accountHolderName: "TRAN THI BINH" }, { id: "bank-an", kind: "PERSONAL", receivingBank: "ABBANK", accountNumber: "2088", accountHolderName: "NGUYEN VAN AN" }];
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? response({ outcome: { ...schoolPart, notice } }) : url.includes("bank-accounts") ? response({ accounts }) : url.endsWith("/invoices/invoice-school") ? response({ ...schoolPart, notice }) : url.endsWith(`/collection-runs/${run.id}`) ? response(routedRun) : url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [routedRun], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} invoiceId="invoice-school" onOpenRun={vi.fn()} onOpenInvoice={vi.fn()} onBackToRun={vi.fn()} denied={vi.fn()} />);
    const first = await screen.findByRole("table", { name: "Dòng phần 1 do máy chủ tính" });
    expect(screen.getByText("Phần 1 · Thu vào tài khoản trường")).toBeTruthy();
    expect(screen.getByText("Phần 2 · Thu vào tài khoản cá nhân")).toBeTruthy();
    expect(within(first).getByText("67.500 (5%)")).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "Dòng phần 2 do máy chủ tính" })).getByText("—")).toBeTruthy();
    expect(screen.getByText(/Tổng cần thu do hệ thống xác nhận/).closest("p")!.textContent).toContain("2.103.500 VND");
    const meals = screen.getByRole("table", { name: "Dòng phần 2 do máy chủ tính" });
    expect(within(meals).getAllByRole("columnheader").map((header) => header.textContent)).toContain("Bớt (VND)");
    expect(within(meals).getByText("-84.000")).toBeTruthy();
    expect(within(meals).getByText("3 ngày × 28.000 · nghỉ có phép 09/2026 (04/09, 15/09, 16/09)")).toBeTruthy();
    fireEvent.click(within(meals).getByRole("button", { name: "Sửa bớt" }));
    const deduction = await screen.findByRole("dialog", { name: "Sửa phần bớt · Tiền ăn" });
    expect(deduction.textContent).toContain("Hệ thống đề xuất 3 ngày nghỉ có phép tháng 09/2026: 04/09, 15/09, 16/09.");
    fireEvent.change(within(deduction).getByLabelText("Số lượng bớt (ngày)"), { target: { value: "2" } });
    fireEvent.change(within(deduction).getByLabelText("Lý do điều chỉnh"), { target: { value: "Ngày 16/09 có ăn trưa" } });
    fireEvent.click(within(deduction).getByRole("button", { name: "Lưu phần bớt" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/invoices/invoice-personal/lines/b/deduction") && (options as RequestInit).method === "PUT" && (options as RequestInit).body === JSON.stringify({ deductionQuantity: "2", refundUnitPrice: "28000", reason: "Ngày 16/09 có ăn trưa" }))).toBe(true));
    const panel = screen.getByRole("complementary", { name: "Rà soát trước khi phát hành" });
    await waitFor(() => expect(within(panel).getByText("Vietcombank · 0123456789 · TRUONG MN")).toBeTruthy());
    await waitFor(() => expect((within(panel).getByLabelText("Tài khoản cá nhân") as HTMLSelectElement).value).toBe("bank-an"));
    expect(within(panel).getByRole("option", { name: "ABBANK · 2088 · NGUYEN VAN AN (mặc định lớp Mầm 4A)" })).toBeTruthy();
    fireEvent.change(within(panel).getByLabelText("Tài khoản cá nhân"), { target: { value: "bank-binh" } });
    fireEvent.click(within(panel).getByRole("button", { name: "Phát hành phiếu thu" }));
    const dialog = await screen.findByRole("dialog", { name: /Phát hành phiếu thu cho Bé An/ });
    expect(dialog.textContent).toContain("Tài khoản trường · 1.417.500 VND: Vietcombank / 0123456789 / TRUONG MN");
    fireEvent.change(within(dialog).getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/invoices/invoice-school/issue") && (options as RequestInit).body === JSON.stringify({ personalBankAccountId: "bank-binh" }))).toBe(true));
  });
  it("offers the server payment image only for an unsettled issued Invoice and saves the returned PNG", async () => {
    const routedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "1350000" }] };
    const issued = { id: "invoice-a", status: "ISSUED", total: "1350000", billingMonth: "2026-10", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, settlementTransfer: null, carries: [], paymentImageAvailable: true, student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationCode: "OBL-202610-000123", obligationTotal: "1350000", dueOn: "2026-10-10", bankAccount: { id: "bank", receivingBank: "Vietcombank", bankBin: "970436", accountNumber: "1020888999", accountHolderName: "TRUONG A" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    let current: Record<string, unknown> = issued;
    let imageStatus = 500;
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith("/payment-image") ? new Response(imageStatus === 200 ? new Blob(["png"], { type: "image/png" }) : "{}", { status: imageStatus, headers: { "content-disposition": 'attachment; filename="OBL-202610-000123-HS001.png"' } }) : url.endsWith("/invoices/invoice-a") ? response(current) : url.endsWith(`/collection-runs/${run.id}`) ? response(routedRun) : url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [routedRun], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const createObjectURL = vi.fn(() => "blob:payment-image");
    vi.stubGlobal("URL", class extends URL { static override createObjectURL = createObjectURL; static override revokeObjectURL = vi.fn(); });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} invoiceId="invoice-a" onOpenRun={vi.fn()} onOpenInvoice={vi.fn()} onBackToRun={vi.fn()} denied={vi.fn()} />);
    const payment = await screen.findByRole("complementary", { name: "Thanh toán" });
    expect(within(payment).getByText("Mã hóa đơn OBL-202610-000123 · Hạn thanh toán 10/10/2026")).toBeTruthy();
    expect(within(payment).getByText("1.350.000 VND")).toBeTruthy();
    for (const fact of ["Vietcombank", "1020888999", "TRUONG A", "Be An La 1"]) expect(within(payment).getByText(fact)).toBeTruthy();
    expect(await within(payment).findByText("Không tạo được ảnh. Thông tin chuyển khoản bên trên vẫn dùng được; thử tải lại.")).toBeTruthy();
    imageStatus = 200;
    fireEvent.click(within(payment).getByRole("button", { name: "Tải ảnh hóa đơn" }));
    expect(await within(payment).findByText("Đã tải OBL-202610-000123-HS001.png.")).toBeTruthy();
    expect(within(payment).getByRole("img", { name: "Xem trước ảnh hóa đơn" }).getAttribute("src")).toBe("blob:payment-image");
    const anchor = click.mock.instances[0] as unknown as HTMLAnchorElement;
    expect(anchor.download).toBe("OBL-202610-000123-HS001.png");
    expect(fetch.mock.calls.filter(([url]) => String(url).endsWith("/finance/invoices/invoice-a/payment-image"))).toHaveLength(2);
    click.mockRestore();
    view.unmount();
    current = { ...issued, status: "CLOSED", paymentImageAvailable: false, receipt: { actualAmount: "1350000", outcome: "EXACT", postedAt: "2026-10-05T00:00:00.000Z", difference: null } };
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} invoiceId="invoice-a" onOpenRun={vi.fn()} onOpenInvoice={vi.fn()} onBackToRun={vi.fn()} denied={vi.fn()} />);
    await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    expect(screen.queryByRole("button", { name: "Tải ảnh hóa đơn" })).toBeNull();
    expect(screen.queryByRole("complementary", { name: "Thanh toán" })).toBeNull();
  });
  it("returns to the run when the server denies a routed Invoice", async () => {
    const routedRun = { ...run, status: "GENERATED" as const, invoices: [] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.endsWith("/invoices/foreign") ? response({}, 404) : url.endsWith(`/collection-runs/${run.id}`) ? response(routedRun) : url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [routedRun], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : response(catalog))));
    const onBackToRun = vi.fn();
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} invoiceId="foreign" onOpenRun={vi.fn()} onOpenInvoice={vi.fn()} onBackToRun={onBackToRun} denied={vi.fn()} />);
    await waitFor(() => expect(onBackToRun).toHaveBeenCalledWith(run.id));
    expect(screen.queryByRole("region", { name: /Rà soát hóa đơn/ })).toBeNull();
  });
  it("renders only the authorized run detail, returns to the list context, and maps visible run copy", async () => {
    const onOpenRun = vi.fn();
    const onBackToRuns = vi.fn();
    const detailedRun = { ...run, templateLines: [] };
    const fetch = vi.fn((url: string) => Promise.resolve(url.endsWith(`/collection-runs/${run.id}`) ? response(detailedRun) : url.includes("collection-runs") ? response({ runs: [detailedRun], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" runId={run.id} onOpenRun={onOpenRun} onBackToRuns={onBackToRuns} denied={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Đợt thu tháng 09/2026 · Nháp" })).toBeTruthy();
    expect(screen.queryByRole("form", { name: "Điều khiển danh sách đợt thu" })).toBeNull();
    expect(screen.queryByRole("table", { name: "Đợt thu theo trường" })).toBeNull();
    expect(screen.queryByText("DRAFT")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Quay lại danh sách đợt thu" }));
    expect(onBackToRuns).toHaveBeenCalledOnce();
    view.rerender(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByRole("form", { name: "Điều khiển danh sách đợt thu" })).toBeTruthy();
  });
  it("uses a named run dialog and only exposes Draft navigation from the captured run order", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }, { id: "invoice-b", studentId: "student-b", studentCode: "HS002", studentName: "Bé Bình", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = (id: string, name: string, code: string) => ({ id, status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code, name, className: "Lá 1" }, lines: [] });
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/invoice-a") ? response(invoice("invoice-a", "Bé An", "HS001")) : url.includes("/invoices/invoice-b") ? response(invoice("invoice-b", "Bé Bình", "HS002")) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun], meta: { nextCursor: null } }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Tạo đợt thu" }); fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Tạo hoặc mở đợt thu" })).toBeTruthy();
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Tạo hoặc mở đợt thu" }), { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
    await openRun();
    fireEvent.click((await screen.findAllByRole("button", { name: "Rà soát hóa đơn" }))[0]!);
    expect(await screen.findByRole("button", { name: "Học sinh tiếp theo" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Học sinh trước" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Học sinh tiếp theo" }));
    expect(await screen.findByRole("button", { name: "Học sinh trước" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Học sinh tiếp theo" })).toBeNull();
  });
  it("keeps run validation beside dialog fields and clears a stale Draft queue on School switch or denied adjacent Invoice", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }, { id: "invoice-b", studentId: "student-b", studentCode: "HS002", studentName: "Bé Bình", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] };
    const denied = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Tháng thu không hợp lệ.", fieldErrors: { billingMonth: "Chọn tháng hợp lệ." } } }), { status: 400 }) : url.includes("/invoices/invoice-b") ? new Response(null, { status: 404 }) : url.includes("/invoices/invoice-a") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun], meta: { nextCursor: null } }) : response(catalog))));
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tạo đợt thu" }));
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hoặc mở" }));
    expect(await screen.findByText("Chọn tháng hợp lệ.", { selector: "#invoice-run-billingMonth-error" })).toBeTruthy();
    expect(document.getElementById("invoice-run-billingMonth-field")).toBeTruthy();
    await openRun();
    fireEvent.click((await screen.findAllByRole("button", { name: "Rà soát hóa đơn" }))[0]!);
    expect(await screen.findByRole("button", { name: "Học sinh tiếp theo" })).toBeTruthy();
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={denied} />);
    expect(screen.queryByRole("region", { name: "Rà soát hóa đơn HS001 / Bé An" })).toBeNull();
  });
  it("clears the current Invoice and queue when the authorized adjacent Invoice is unavailable", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }, { id: "invoice-b", studentId: "student-b", studentCode: "HS002", studentName: "Bé Bình", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/invoice-b") ? new Response(null, { status: 404 }) : url.includes("/invoices/invoice-a") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun], meta: { nextCursor: null } }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click((await screen.findAllByRole("button", { name: "Rà soát hóa đơn" }))[0]!);
    fireEvent.click(await screen.findByRole("button", { name: "Học sinh tiếp theo" }));
    await screen.findByRole("alert");
    expect(screen.queryByRole("region", { name: "Rà soát hóa đơn HS001 / Bé An" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Học sinh trước" })).toBeNull();
  });
  it("marks an unsaved template input dirty and sends the current run version", async () => {
    const onStatusChange = vi.fn();
    const templateRun = { ...run, templateLines: [] };
    const catalogWithMeal = { groups: [], receivables: [{ id: "meal", groupId: "group", code: "MEAL", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", status: "ACTIVE", available: true }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "PUT" ? response({ outcome: { ...templateRun, version: 3, templateLines: [{ id: "line", receivableId: "meal", receivableName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", quantity: "22", amount: "770000" }] } }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [templateRun] }) : response(catalogWithMeal)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} onStatusChange={onStatusChange} />);
    await openRun();
    fireEvent.change(screen.getAllByLabelText("Khoản thu").at(-1)!, { target: { value: "meal" } });
    fireEvent.change(screen.getAllByLabelText("Số lượng").at(-1)!, { target: { value: "22" } });
    await waitFor(() => expect(onStatusChange).toHaveBeenLastCalledWith(expect.objectContaining({ dirty: true })));
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản thu mẫu" }));
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/template-lines") && (options as RequestInit).body === JSON.stringify({ receivableId: "meal", quantity: "22", expectedVersion: 2 }))).toBe(true);
  });
  it("loads promotion policies and submits multi-target policy and batch assignment through the shared command", async () => {
    const catalogWithReceivables = { groups: [], receivables: [{ id: "r1", groupId: "g", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }, { id: "r2", groupId: "g", code: null, displayName: "Tiền ăn", unitLabel: "tháng", defaultUnitPrice: "50", status: "ACTIVE", available: true }] };
    const policy = { id: "policy", name: "Con cán bộ", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", effectiveFrom: "2026-09-01", effectiveTo: null, targets: [], assignments: [] }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: policy }) : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalogWithReceivables)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    expect((await screen.findAllByText("Con cán bộ / Phiên bản 1")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Thêm chính sách" }));
    expect(screen.getByRole("dialog", { name: "Thêm chính sách ưu đãi" })).toBeTruthy();
    expect(document.querySelector(".dialog-backdrop")).toBeTruthy();
    expect(document.querySelector('[role="dialog"][aria-labelledby="finance-policy-title"] form')).toBeTruthy();
    expect(screen.getByText("Giảm trên hóa đơn")).toBeTruthy();
    expect(screen.getByText("Ưu đãi nộp trước")).toBeTruthy();
    const discountRadio = screen.getByRole("radio", { name: /Giảm trên hóa đơn/ });
    const prepaidRadio = screen.getByRole("radio", { name: /Ưu đãi nộp trước/ });
    expect(discountRadio).toBeTruthy();
    expect(prepaidRadio).toBeTruthy();
    expect((discountRadio as HTMLInputElement).checked).toBe(true);
    expect(screen.queryByLabelText(/Thời hạn nộp trước \(tháng\)/)).toBeNull();

    fireEvent.change(screen.getByLabelText("Tên chính sách"), { target: { value: "Hỗ trợ" } });
    fireEvent.click(screen.getByLabelText("Học phí")); fireEvent.click(screen.getByLabelText("Tiền ăn"));
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.click(prepaidRadio);
    expect((prepaidRadio as HTMLInputElement).checked).toBe(true);
    const termInput = screen.getByLabelText(/Thời hạn nộp trước \(tháng\)/);
    expect(termInput).toBeTruthy();
    fireEvent.change(termInput, { target: { value: "3" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/promotion-policies") && (options as RequestInit).method === "POST" && String((options as RequestInit).body).includes('"policyId":null') && String((options as RequestInit).body).includes('"receivableIds":["r1","r2"]') && String((options as RequestInit).body).includes('"fulfillmentMode":"PREPAID_COVERAGE"') && String((options as RequestInit).body).includes('"prepaidTermMonths":3'))).toBe(true));
  });
  it("confirms a promotion version transition from its row menu before posting and restores the menu action focus", async () => {
    const policy = { id: "policy", name: "Hỗ trợ", versions: [{ id: "version", version: 1, status: "DRAFT", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "2026-09-01", effectiveTo: null, targets: [], assignments: [] }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: policy }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    const menuTrigger = await screen.findByRole("button", { name: "Tùy chọn cho Hỗ trợ phiên bản 1" });
    fireEvent.keyDown(menuTrigger, { key: "ArrowDown" });
    const action = await screen.findByRole("menuitem", { name: "Kích hoạt phiên bản" });
    expect(action.closest('[role="menu"]')?.parentElement?.parentElement?.parentElement).toBe(document.body);
    fireEvent.click(action);
    expect(screen.getByRole("dialog", { name: "Kích hoạt phiên bản Hỗ trợ" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/activate") && (options as RequestInit).method === "POST")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận kích hoạt" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/activate") && (options as RequestInit).method === "POST")).toBe(true));
    expect(document.activeElement).toBe(menuTrigger);
  });
  it("restores the catalog dialog trigger after a confirmed successful create", async () => {
    const groups = [{ id: "group", name: "Khoản thu cố định", kind: "FIXED" as const }];
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: { id: "receivable" } }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : response({ groups, receivables: [] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Thêm khoản thu" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("radio", { name: "Khoản thu cố định" }));
    fireEvent.change(screen.getByLabelText("Tên khoản thu"), { target: { value: "Học phí" } });
    fireEvent.change(screen.getByLabelText("Đơn vị tính"), { target: { value: "tháng" } });
    fireEvent.change(screen.getByLabelText("Giá / đơn vị (chưa VAT)"), { target: { value: "100" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản thu" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Thêm khoản thu" })).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });
  it("shows the receivable form in the managed modal and keeps its focus and dismissal lifecycle", async () => {
    const groups = [{ id: "group", name: "Khoản thu cố định", kind: "FIXED" as const }];
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: { id: "receivable" } }) : response({ groups, receivables: [] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Thêm khoản thu" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Thêm khoản thu" });
    expect(dialog.classList.contains("dialog")).toBe(true);
    expect(dialog.parentElement?.classList.contains("dialog-backdrop")).toBe(true);
    expect(dialog.classList.contains("dialog-wide")).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Tên khoản thu"));

    const save = within(dialog).getByRole("button", { name: "Lưu khoản thu" });
    save.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Tên khoản thu"));
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(save);

    fireEvent.change(within(dialog).getByLabelText("Tên khoản thu"), { target: { value: "Tạm" } });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Thêm khoản thu" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(fetch.mock.calls.some(([, options]) => (options as RequestInit | undefined)?.method === "POST")).toBe(false);

    fireEvent.click(trigger);
    expect(screen.getByLabelText("Tên khoản thu")).toHaveProperty("value", "");
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog", { name: "Thêm khoản thu" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
  it("keeps receivable server validation accessible inside the modal", async () => {
    const groups = [{ id: "group", name: "Khoản thu cố định", kind: "FIXED" as const }];
    vi.stubGlobal("fetch", vi.fn((_url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST"
        ? new Response(JSON.stringify({ error: { message: "Tên khoản thu không hợp lệ.", fieldErrors: { displayName: "Tên khoản thu đã tồn tại." } } }), { status: 400 })
        : response({ groups, receivables: [] }),
    )));
    render(<FinanceWorkspaceBase schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm khoản thu" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm khoản thu" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu khoản thu" }));
    expect(await within(dialog).findByText("Tên khoản thu đã tồn tại.")).toBeTruthy();
    expect(within(dialog).getByLabelText("Tên khoản thu").getAttribute("aria-describedby")).toBe("invoice-receivable-displayName-error");
  });
  it("offers no group management and filters the catalog by the three fixed kinds", async () => {
    const receivables = [
      { id: "fixed", groupId: "g1", kind: "FIXED", code: "HP", displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true },
      { id: "flex", groupId: "g2", kind: "FLEXIBLE", code: "DN", displayName: "Dã ngoại", unitLabel: "lần", defaultUnitPrice: "100", status: "ACTIVE", available: true },
      { id: "ext", groupId: "g3", kind: "EXTRACURRICULAR", code: "NK", displayName: "Tiếng Anh", unitLabel: "tháng", defaultUnitPrice: "100", status: "INACTIVE", available: false },
    ];
    const fetch = vi.fn((_url: string) => Promise.resolve(response({ groups: [], receivables })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    await screen.findByText("Học phí");
    expect(screen.queryByRole("button", { name: "Quản lý nhóm" })).toBeNull();
    const kind = screen.getByLabelText("Nhóm") as HTMLSelectElement;
    expect(Array.from(kind.options).map((option) => option.textContent)).toEqual(["Tất cả nhóm", "Khoản thu cố định", "Khoản thu linh hoạt", "Ngoại khóa"]);
    fireEvent.change(kind, { target: { value: "FLEXIBLE" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    expect(screen.queryByText("Học phí")).toBeNull();
    expect(screen.getByText("Dã ngoại")).toBeTruthy();
    fireEvent.change(kind, { target: { value: "" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "INACTIVE" } });
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "anh" } });
    fireEvent.click(screen.getByRole("button", { name: "Lọc" }));
    expect(screen.getByText("Tiếng Anh")).toBeTruthy();
    expect(screen.queryByText("Dã ngoại")).toBeNull();
    const guide = screen.getByText("Hướng dẫn").closest("details")!;
    expect(guide.open).toBe(false);
    expect(guide.textContent).toContain("Mỗi Trường có đúng ba nhóm khoản thu, không thêm, đổi tên hoặc ngừng nhóm.");
    expect(fetch.mock.calls.every(([url]) => !String(url).includes("receivable-groups"))).toBe(true);
  });
  it("changes the kind of an unused receivable through the server and locks it once used", async () => {
    const receivables = [
      { id: "unused", groupId: "g2", kind: "FLEXIBLE", kindLocked: false, code: null, displayName: "Dã ngoại", unitLabel: "lần", defaultUnitPrice: "100", status: "ACTIVE", available: true },
      { id: "used", groupId: "g1", kind: "FIXED", kindLocked: true, code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true },
    ];
    const fetch = vi.fn((_url: string, options?: RequestInit) => Promise.resolve(options?.method ? response({ status: "COMPLETED", outcome: { id: "unused" } }) : response({ groups: [], receivables })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    fireEvent.keyDown(await screen.findByRole("button", { name: "Tùy chọn cho Học phí" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Chỉnh sửa" }));
    const locked = await screen.findByRole("dialog", { name: "Chỉnh sửa · Học phí" });
    expect(within(locked).getByRole("radio", { name: "Khoản thu cố định" })).toHaveProperty("checked", true);
    expect(within(locked).getByRole("radio", { name: "Ngoại khóa" }).matches(":disabled")).toBe(true);
    expect(within(locked).getByText("Không đổi được nhóm: khoản thu đã dùng trên hóa đơn hoặc gắn lớp ngoại khóa.")).toBeTruthy();
    expect(within(locked).getByRole("button", { name: "Lưu thay đổi" })).toHaveProperty("disabled", true);
    fireEvent.click(within(locked).getByRole("button", { name: "Hủy" }));
    fireEvent.keyDown(await screen.findByRole("button", { name: "Tùy chọn cho Dã ngoại" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Chỉnh sửa" }));
    const dialog = await screen.findByRole("dialog", { name: "Chỉnh sửa · Dã ngoại" });
    fireEvent.click(within(dialog).getByRole("radio", { name: "Ngoại khóa" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/finance/receivables/unused/kind") && (options as RequestInit).method === "PUT" && (options as RequestInit).body === JSON.stringify({ kind: "EXTRACURRICULAR" }))).toBe(true));
  });
  it("autofocuses managed catalog, policy, assignment, and transition dialogs", async () => {
    const policy = { id: "policy", name: "Hỗ trợ", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "2026-09-01", effectiveTo: null, targets: [], assignments: [] }] };
    const groups = [{ id: "group", name: "Khoản thu cố định", kind: "FIXED" as const }];
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response({ groups, receivables: [] }))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    expect((await screen.findAllByText("Hỗ trợ / Phiên bản 1")).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: "Thêm chính sách" }));
    expect(document.activeElement).toBe(screen.getByLabelText("Chính sách hiện có (để tạo phiên bản mới)"));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    const menu = await screen.findByRole("button", { name: "Tùy chọn cho Hỗ trợ phiên bản 1" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    const assign = await screen.findByRole("menuitem", { name: "Gán học sinh" });
    fireEvent.click(assign);
    expect(document.activeElement).toBe(screen.getByLabelText("Phiên bản đang áp dụng"));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(menu);
    fireEvent.click(screen.getByRole("menuitem", { name: "Ngừng phiên bản" }));
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Xác nhận ngừng phiên bản" }));
  });
  it("restores the catalog lifecycle row-menu trigger after successful confirmation", async () => {
    const catalogWithReceivable = { groups: [], receivables: [{ id: "receivable", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE" as const, available: true }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: {} }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalogWithReceivable)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="receivables" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Tùy chọn cho Học phí" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ngừng áp dụng" }));
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Kết thúc" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("/receivables/receivable/lifecycle"))).toBe(true));
    expect(document.activeElement).toBe(trigger);
  });
  it("ends an active assignment from its row menu and supports menu arrow navigation", async () => {
    const policy = { id: "policy", name: "Hỗ trợ", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "2026-09-01", effectiveTo: null, targets: [], assignments: [{ id: "assignment", studentId: "student", studentCode: "HS001", studentName: "Bé An", effectiveFrom: "2026-09-01", effectiveTo: null, isCurrent: true, reason: "Hỗ trợ", endReason: null }] }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: {} }) : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    const policyMenu = await screen.findByRole("button", { name: "Tùy chọn cho Hỗ trợ phiên bản 1" });
    fireEvent.keyDown(policyMenu, { key: "ArrowDown" });
    const assign = await screen.findByRole("menuitem", { name: "Gán học sinh" });
    fireEvent.keyDown(assign, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Ngừng phiên bản" }));
    fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(assign);
    const assignmentMenu = screen.getByRole("button", { name: "Tùy chọn cho Bé An" });
    fireEvent.keyDown(assignmentMenu, { key: "ArrowDown" });
    const endAssignment = await screen.findByRole("menuitem", { name: "Kết thúc áp dụng" });
    expect(endAssignment.closest('[role="menu"]')?.parentElement?.parentElement?.parentElement).toBe(document.body);
    fireEvent.click(endAssignment);
    expect(document.activeElement).toBe(screen.getByLabelText("Ngày kết thúc (bao gồm)"));
    fireEvent.change(screen.getByLabelText("Ngày kết thúc (bao gồm)"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Lý do"), { target: { value: "Kết thúc" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận kết thúc" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/promotion-assignments/assignment/end") && (options as RequestInit).body === JSON.stringify({ effectiveTo: "2026-10-01", reason: "Kết thúc" }))).toBe(true));
    expect(document.activeElement).toBe(assignmentMenu);
  });
  it("posts retirement only after confirmation and restores the row trigger", async () => {
    const policy = { id: "policy", name: "Hỗ trợ", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", fulfillmentMode: "DISCOUNT", effectiveFrom: "2026-09-01", effectiveTo: null, targets: [], assignments: [] }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ outcome: policy }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Tùy chọn cho Hỗ trợ phiên bản 1" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ngừng phiên bản" }));
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/retire"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ngừng phiên bản" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/retire") && (options as RequestInit).method === "POST")).toBe(true));
    expect(document.activeElement).toBe(trigger);
  });
  it("dismisses a new dialog with Escape, restores its trigger, and resets its draft", async () => {
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    const trigger = await screen.findByRole("button", { name: "Thêm chính sách" });
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Tên chính sách"), { target: { value: "Tạm" } });
    fireEvent.keyDown(screen.getByRole("dialog", { name: "Thêm chính sách ưu đãi" }), { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Thêm chính sách ưu đãi" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect(screen.getByLabelText("Tên chính sách")).toHaveProperty("value", "");
  });
  it("renders policies safely when versions or assignments are omitted", async () => {
    const policy = { id: "policy", name: "Thiếu mảng" };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    expect(await screen.findByText("Chưa có chính sách ưu đãi.")).toBeTruthy();
  });
  it("renders server-derived future coverage facts and keeps exact-only receipt messaging", async () => {
    const coverageRun = { ...run, coverageSelections: [{ studentId: fixtureStudentId, versionId: "coverage-version", billingMonth: "2026-10" }] };
    const preview = { run: coverageRun, fingerprint: "coverage", eligible: [], skips: [], coverageSelections: coverageRun.coverageSelections, futureCoverageFacts: [{ studentId: fixtureStudentId, billingMonth: "2026-10", policyId: "policy", versionId: "coverage-version", receivableId: "meal", receivableName: "Học phí", originalPrice: "100", reduction: "10", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/preview") ? response(preview) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [coverageRun] }) : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(screen.getByRole("button", { name: "Xem trước từ máy chủ" }));
    expect(await screen.findByText("Ưu đãi trả trước do máy chủ xác nhận")).toBeTruthy(); expect(screen.getByText("2026-10")).toBeTruthy();
  });
  it("renders source remaining only on the outgoing debt source and inbound provenance only on its target", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "source", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    const invoice = { id: "source", status: "ISSUED", total: "100", sourceOutstanding: "60", sourceDebtTransfers: [{ targetInvoiceId: "target", amount: "40", reason: "Đối soát", postedAt: "2026-09-25T00:00:00.000Z" }], priorDebtTransfers: [], billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText("Công nợ nguồn còn lại do máy chủ xác nhận: 60 VND.")).toBeTruthy(); expect(screen.getByText(/Đã chuyển sang hóa đơn kỳ sau/)).toBeTruthy(); expect(screen.queryByText("Công nợ kỳ trước")).toBeNull(); expect(screen.queryByRole("button", { name: "Ghi thực nhận và đóng hóa đơn" })).toBeNull();
  });
  it("renders inbound prior-debt provenance read-only without showing source outstanding on a target", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "target", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "140" }] };
    const invoice = { id: "target", status: "DRAFT", total: "140", priorDebtTransfers: [{ sourceInvoiceId: "source", amount: "40", reason: "Đối soát", postedAt: "2026-09-25T00:00:00.000Z" }], billingMonth: "2026-10", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "prior-line", kind: "PRIOR_DEBT", receivableId: null, receivableName: "Công nợ kỳ trước", unitLabel: "khoản", unitPrice: "40", quantity: "1", amount: "40", grossAmount: "40", discountAmount: "0", netAmount: "40", promotionEvaluation: null, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: "Đối soát", sourceRecordedAt: "2026-09-25T00:00:00.000Z", sourceProvenance: { sourceInvoiceId: "source" }, sourceAudit: null }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText(/Hóa đơn nguồn: 40 VND/)).toBeTruthy(); expect(screen.queryByText(/Công nợ nguồn còn lại do máy chủ xác nhận/)).toBeNull(); expect(within(screen.getByRole("table", { name: "Dòng hóa đơn do máy chủ tính" })).getByText("Công nợ kỳ trước").closest("tr")?.querySelectorAll("button")).toHaveLength(0);
  });
  it("keeps raw source identifiers and serialized provenance out of the default line row while providing a source disclosure", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "0", netAmount: "100", overrideReason: null, source: { serviceDate: "2026-09-01", attendanceState: "PRESENT", pickedUpAt: null, lateCareMinutes: null }, sourceReason: "Theo dõi", sourceRecordedAt: "2026-09-01T00:00:00.000Z", sourceProvenance: { enrollmentId: "raw-provenance-id" }, sourceAudit: { actorIdentityId: "raw-actor-id", membershipId: "raw-membership-id" } }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    const row = (await screen.findByText("Học phí")).closest("tr")!;
    expect(row.textContent).not.toContain("raw-actor-id");
    expect(row.textContent).not.toContain("raw-membership-id");
    expect(row.textContent).not.toContain("raw-provenance-id");
    const disclosure = screen.getByText("Thông tin nguồn và kiểm tra").closest("details")!;
    expect(disclosure.open).toBe(false);
    fireEvent.click(screen.getByText("Thông tin nguồn và kiểm tra"));
    expect(disclosure.open).toBe(true);
    expect(screen.getByText("Nguồn đã được máy chủ xác nhận cho dòng hóa đơn này.")).toBeTruthy();
  });
  it("renders only server-projected current assignments and never renders prior School promotion data", async () => {
    const today = new Date().toISOString().slice(0, 10); const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const policy = { id: "policy", name: "Ưu đãi Trường A", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", effectiveFrom: today, effectiveTo: null, targets: [], assignments: [{ id: "current", studentId: "s1", studentCode: "HS001", studentName: "Bé An", effectiveFrom: today, effectiveTo: null, isCurrent: true, reason: "A", endReason: null }, { id: "future", studentId: "s2", studentCode: "HS002", studentName: "Bé Bình", effectiveFrom: day(1), effectiveTo: null, isCurrent: false, reason: "B", endReason: null }, { id: "ended", studentId: "s3", studentCode: "HS003", studentName: "Bé Chi", effectiveFrom: day(-2), effectiveTo: day(-1), isCurrent: false, reason: "C", endReason: "Hết" }] }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    expect(await screen.findByText("1 đang áp dụng")).toBeTruthy(); expect(screen.queryByText(/HS002 \/ Bé Bình:/)).toBeNull();
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" page="promotions" denied={vi.fn()} />);
    expect(screen.queryByText("Ưu đãi Trường A / Phiên bản 1")).toBeNull(); expect(screen.queryByText(/HS001 \/ Bé An:/)).toBeNull();
  });
  it("keeps promotion validation in the promotion field-error scope", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST"
        ? new Response(JSON.stringify({ error: { message: "Mức giảm không hợp lệ.", fieldErrors: { discountValue: "Mức giảm phải lớn hơn 0." } } }), { status: 400 })
        : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm chính sách" }));
    fireEvent.change(await screen.findByLabelText("Tên chính sách"), { target: { value: "Hỗ trợ" } });
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));
    await screen.findByText("Mức giảm phải lớn hơn 0.", { selector: "#invoice-promotion-discountValue-error" });
    expect(screen.getByLabelText("Mức giảm")).toHaveProperty("id", "invoice-promotion-discountValue-field");
  });
  it("hides the existing policy select when promotion policies are empty and sends policyId as null", async () => {
    const todayInVietnam = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const catalogWithReceivables = {
      groups: [],
      receivables: [
        { id: "r1", groupId: "g", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true },
      ],
    };
    const fetch = vi.fn((url: string, options?: RequestInit) =>
      Promise.resolve(
        options?.method === "POST"
          ? response({ outcome: { id: "created" } })
          : url.includes("promotion-students")
            ? response({ students: candidates.students })
            : url.includes("promotion-policies")
              ? response({ policies: [] })
              : url.includes("collection-run-candidates")
                ? response(candidates)
                : url.includes("collection-runs")
                  ? response({ runs: [] })
                  : response(catalogWithReceivables),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm chính sách" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm chính sách ưu đãi" });
    expect(dialog).toBeTruthy();

    expect(screen.queryByLabelText("Chính sách hiện có (để tạo phiên bản mới)")).toBeNull();
    const effectiveFromInput = screen.getByLabelText("Hiệu lực từ") as HTMLInputElement;
    const effectiveToInput = screen.getByLabelText("Hiệu lực đến (bao gồm)") as HTMLInputElement;
    expect(effectiveFromInput.value).toBe(todayInVietnam);
    expect(effectiveFromInput.value.length).toBeGreaterThan(0);
    expect(effectiveToInput.value).toBe("");
    expect(effectiveToInput.required).toBe(false);

    fireEvent.change(screen.getByLabelText("Tên chính sách"), { target: { value: "Chính sách đầu tiên" } });
    fireEvent.click(screen.getByLabelText("Học phí"));
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "10" } });

    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));

    await waitFor(() => {
      const call = fetch.mock.calls.find(
        ([url, options]) => String(url).includes("/finance/promotion-policies") && options?.method === "POST",
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.policyId).toBeNull();
      expect(body.effectiveFrom).toBe(todayInVietnam);
      expect(body.effectiveTo).toBeNull();
    });
  });
  it("retains existing policy select when policies exist and accessibly binds policyId field errors adjacent to the select", async () => {
    const todayInVietnam = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const existingPolicy = {
      id: "policy-1",
      name: "Chính sách cũ",
      versions: [
        {
          id: "version-1",
          version: 1,
          status: "ACTIVE",
          discountType: "PERCENTAGE",
          discountValue: "10",
          priority: 1,
          stackingMode: "STACKABLE",
          fulfillmentMode: "DISCOUNT",
          effectiveFrom: "2026-09-01",
          effectiveTo: null,
          targets: [],
          assignments: [],
        },
      ],
    };
    const catalogWithReceivables = {
      groups: [],
      receivables: [
        { id: "r1", groupId: "g", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true },
      ],
    };
    const fetch = vi.fn((url: string, options?: RequestInit) =>
      Promise.resolve(
        options?.method === "POST"
          ? new Response(
              JSON.stringify({
                error: {
                  code: "VALIDATION_ERROR",
                  message: "Dữ liệu không hợp lệ.",
                  fieldErrors: { policyId: "ID không hợp lệ." },
                },
              }),
              { status: 400 },
            )
          : url.includes("promotion-students")
            ? response({ students: candidates.students })
            : url.includes("promotion-policies")
              ? response({ policies: [existingPolicy] })
              : url.includes("collection-run-candidates")
                ? response(candidates)
                : url.includes("collection-runs")
                  ? response({ runs: [] })
                  : response(catalogWithReceivables),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="promotions" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm chính sách" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm chính sách ưu đãi" });
    expect(dialog).toBeTruthy();

    const policySelect = screen.getByLabelText("Chính sách hiện có (để tạo phiên bản mới)");
    expect(policySelect).toBeTruthy();
    expect((policySelect as HTMLSelectElement).value).toBe("");
    expect(policySelect.getAttribute("aria-invalid")).toBeNull();
    expect(screen.queryByText("ID không hợp lệ.")).toBeNull();
    const effectiveFromInput = screen.getByLabelText("Hiệu lực từ") as HTMLInputElement;
    const effectiveToInput = screen.getByLabelText("Hiệu lực đến (bao gồm)") as HTMLInputElement;
    expect(effectiveFromInput.value).toBe(todayInVietnam);
    expect(effectiveFromInput.value.length).toBeGreaterThan(0);
    expect(effectiveToInput.value).toBe("");
    expect(effectiveToInput.required).toBe(false);

    fireEvent.change(screen.getByLabelText("Tên chính sách"), { target: { value: "Chính sách mới" } });
    fireEvent.click(screen.getByLabelText("Học phí"));
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));

    await waitFor(() => {
      const call = fetch.mock.calls.find(
        ([url, options]) => String(url).includes("/finance/promotion-policies") && options?.method === "POST",
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.policyId).toBeNull();
      expect(body.effectiveFrom).toBe("2026-10-01");
      expect(body.effectiveTo).toBeNull();
    });

    const errorElement = await screen.findByText("ID không hợp lệ.", { selector: "#invoice-promotion-policyId-error" });
    expect(dialog.contains(errorElement)).toBe(true);
    expect(policySelect).toHaveProperty("id", "invoice-promotion-policyId-field");
    expect(policySelect.getAttribute("aria-invalid")).toBe("true");
    expect(policySelect.getAttribute("aria-describedby")).toBe("invoice-promotion-policyId-error");
    expect(policySelect.parentElement?.nextElementSibling).toBe(errorElement);
  });
  it("renders server preview eligible rows and categorized skips without local classification", async () => {
    const preview = {
      run,
      fingerprint: "server-fingerprint",
      eligible: [
        {
          studentId: fixtureStudentId,
          studentCode: "HS001",
          fullName: "Bé An",
          className: "Lá 1",
          lines: [{ receivableId: "fixture", receivableName: "Khoản fixture", grossAmount: "0", discountAmount: "0", netAmount: "0", promotionEvaluation: { applications: [] } }],
        },
      ],
      skips: [
        {
          studentId: "33333333-3333-4333-8333-333333333333",
          reason: "CLASS_INACTIVE",
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("/preview")
            ? response(preview)
            : url.includes("collection-run-candidates")
              ? response(candidates)
              : url.includes("collection-runs")
                ? response({ runs: [run] })
                : response(catalog),
        ),
      ),
    );
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        denied={vi.fn()}
      />,
    );
    await openRun();
    fireEvent.click(
      screen.getByRole("button", { name: "Xem trước từ máy chủ" }),
    );
    expect((await screen.findAllByText("HS001 / Bé An")).length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "TD" &&
          element.textContent?.includes(
            "Lớp được phân công đã ngừng hoạt động.",
          ) === true,
      ),
    ).toBeTruthy();
    expect(screen.queryByText("CLASS_INACTIVE")).toBeNull();
  });
  it("renders distinct server-returned promotion line values and assignment reasons without deriving totals", async () => {
    const preview = { run, fingerprint: "server-fingerprint", eligible: [{ studentId: fixtureStudentId, studentCode: "HS001", fullName: "Bé An", className: "Lá 1", lines: [{ receivableId: "meal", receivableName: "Tiền ăn", grossAmount: "100", discountAmount: "25", netAmount: "75", promotionEvaluation: { applications: [{ assignmentReason: "Con nhân viên", appliedDiscount: "25" }] } }, { receivableId: "tuition", receivableName: "Học phí", grossAmount: "200", discountAmount: "0", netAmount: "200", promotionEvaluation: { applications: [] } }] }], skips: [] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/preview") ? response(preview) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [run] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(screen.getByRole("button", { name: "Xem trước từ máy chủ" }));
    expect(await screen.findByText("Con nhân viên")).toBeTruthy(); expect(screen.getByText("75")).toBeTruthy(); expect(screen.getAllByText("200")).toHaveLength(2); expect(screen.queryByText("275")).toBeNull();
  });
  it("keeps a stale preview error and selection for refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string, options?: RequestInit) => {
        if (options?.method === "POST")
          return Promise.resolve(
            new Response(
              JSON.stringify({ error: { message: "Bản xem trước đã cũ." } }),
              { status: 409 },
            ),
          );
        if (url.includes("/preview"))
          return Promise.resolve(
            response({ run, fingerprint: "old", eligible: [], skips: [] }),
          );
        return Promise.resolve(
          url.includes("collection-run-candidates")
            ? response(candidates)
            : url.includes("collection-runs")
              ? response({ runs: [run] })
              : response(catalog),
        );
      }),
    );
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        denied={vi.fn()}
      />,
    );
    await openRun();
    fireEvent.click(
      screen.getByRole("button", { name: "Xem trước từ máy chủ" }),
    );
    await screen.findByRole("button", {
      name: "Xác nhận xem trước và chuyển sẵn sàng",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận xem trước và chuyển sẵn sàng" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Bản xem trước đã cũ.",
    );
    expect(screen.queryByRole("checkbox", { name: /Chọn HS001 Bé An/ })).toBeNull();
    expect(screen.getByText("Bản xem trước do máy chủ xác định từ danh sách học sinh hợp lệ tại đầu tháng thu.")).toBeTruthy();
  });
  it("never invokes a deleted browser selection endpoint", async () => {
    const fetch = vi.fn((url: string) => {
      if (url.includes("/selection")) throw new Error("selection endpoint must not be called");
      return Promise.resolve(url.includes("/preview") ? response({ run, fingerprint: "server", eligible: [], skips: [] }) : url.includes("collection-runs") ? response({ runs: [run] }) : response(catalog));
    });
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Xem trước từ máy chủ" }));
    await screen.findByRole("button", { name: "Xác nhận xem trước và chuyển sẵn sàng" });
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/selection"))).toBe(false);
  });
  it("reconciles an uncertain command instead of retrying it", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) =>
      options?.method === "POST"
        ? Promise.resolve(new Response(null, { status: 503 }))
        : url.includes("/operations/")
          ? response({ status: "PENDING" })
          : url.includes("collection-run-candidates")
            ? response(candidates)
            : url.includes("collection-runs")
              ? response({ runs: [] })
              : response(catalog),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        denied={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Tạo đợt thu" }));
    fireEvent.change(await screen.findByLabelText("Năm học"), {
      target: { value: "year-a" },
    });
    fireEvent.change(screen.getByLabelText("Tháng thu"), {
      target: { value: "2026-09" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Xác nhận tạo hoặc mở" })
        .closest("form")!,
    );
    await waitFor(() =>
      expect(
        sessionStorage.getItem("passionedu.app.pending-finance-operation"),
      ).toContain("school-a"),
    );
    expect(fetch.mock.calls.some(([url]) => url.includes("/operations/"))).toBe(
      true,
    );
  });
  it("reconciles a timed-out template save from its Operation without retrying the command", async () => {
    const templateRun = { ...run, templateLines: [] };
    const reconciledRun = { ...templateRun, version: 3, templateLines: [{ id: "line", receivableId: "meal", receivableName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", quantity: "22", amount: "770000" }] };
    const catalogWithMeal = { groups: [], receivables: [{ id: "meal", groupId: "group", code: "MEAL", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", status: "ACTIVE", available: true }] };
    let reconciled = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      String(url).includes("/operations/") ? (reconciled = true, response({ status: "COMPLETED", outcome: reconciledRun })) :
      options?.method === "PUT" ? new Response(null, { status: 503 }) :
      url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? reconciled ? new Response(null, { status: 503 }) : response({ runs: [templateRun] }) : response(catalogWithMeal),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.change(screen.getAllByLabelText("Khoản thu").at(-1)!, { target: { value: "meal" } });
    fireEvent.change(screen.getAllByLabelText("Số lượng").at(-1)!, { target: { value: "22" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu khoản thu mẫu" }));
    expect(await screen.findByText("770.000")).toBeTruthy();
    expect(fetch.mock.calls.filter(([url, options]) => String(url).endsWith("/template-lines") && (options as RequestInit).method === "PUT")).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(true);
  });
  it("does not deny access for a missing finance resource", async () => {
    const denied = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) =>
        Promise.resolve(
          url.includes("/preview")
            ? new Response(
                JSON.stringify({
                  error: { message: "Không tìm thấy đợt thu." },
                }),
                { status: 404 },
              )
            : url.includes("collection-run-candidates")
              ? response(candidates)
              : url.includes("collection-runs")
                ? response({ runs: [run] })
                : response(catalog),
        ),
      ),
    );
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        denied={denied}
      />,
    );
    await openRun();
    fireEvent.click(
      screen.getByRole("button", { name: "Xem trước từ máy chủ" }),
    );
    await screen.findByRole("alert");
    expect(denied).not.toHaveBeenCalled();
  });
  it("requires named confirmation and renders only the generate outcome returned by the server", async () => {
    const readyRun = { ...run, status: "READY" as const };
    const outcome = {
      run: { ...readyRun, status: "GENERATED" as const },
      created: [
        {
          studentId: fixtureStudentId,
          studentCode: "HS001",
          fullName: "Bé An",
          className: "Lá 1",
        },
      ],
      skipped: [{ studentId: "server-skip", reason: "NOT_ENROLLED" }],
    };
    const fetch = vi.fn((url: string, options?: RequestInit) =>
      Promise.resolve(
        options?.method === "POST"
          ? response({ outcome })
          : url.includes("collection-run-candidates")
            ? response(candidates)
            : url.includes("collection-runs")
              ? response({ runs: [readyRun] })
              : response(catalog),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        denied={vi.fn()}
      />,
    );
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn nháp" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    const confirm = screen.getByRole("button", {
      name: "Xác nhận tạo hóa đơn nháp",
    });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(
      screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"),
      { target: { value: "2026-10" } },
    );
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(
      screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"),
      { target: { value: "2026-09" } },
    );
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.click(
      confirm,
    );
    expect(await screen.findByText(/Đã tạo 1 hóa đơn nháp; bỏ qua 1\s+học sinh\./)).toBeTruthy();
    expect(
      screen.getByText("Học sinh không ở trạng thái đang theo học."),
    ).toBeTruthy();
    expect(
      fetch.mock.calls.some(
        ([url, options]) =>
          String(url).endsWith("/generate") &&
          (options as RequestInit).method === "POST",
      ),
    ).toBe(true);
  });
  it("renders a completed generate outcome after reconciliation", async () => {
    const readyRun = { ...run, status: "READY" as const };
    const outcome = {
      run: { ...readyRun, status: "GENERATED" as const },
      created: [{ studentId: fixtureStudentId, studentCode: "HS001", fullName: "Bé An", className: "Lá 1" }],
      skipped: [{ studentId: "server-skip", studentCode: "HS002", fullName: "Bé Bình", reason: "NOT_ENROLLED" }],
    };
    let generate = true;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => {
      if (url.includes("/operations/")) return Promise.resolve(response({ status: "COMPLETED", outcome }));
      if (options?.method === "POST" && generate) {
        generate = false;
        return Promise.resolve(new Response(null, { status: 503 }));
      }
      return Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [readyRun] }) : response(catalog));
    }));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn nháp" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn nháp" }));
    expect(await screen.findByText(/Đã tạo 1 hóa đơn nháp; bỏ qua 1\s+học sinh\./)).toBeTruthy();
    const skipped = screen.getByRole("table", { name: "Học sinh bị bỏ qua khi tạo" });
    expect(within(skipped).getByRole("row", { name: "HS002 / Bé Bình Học sinh không ở trạng thái đang theo học." })).toBeTruthy();
  });
  it("renders only server-returned generate progress while reconciliation remains pending", async () => {
    const readyRun = { ...run, status: "READY" as const };
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST"
        ? response({ status: "PENDING", outcome: null, progress: { status: "QUEUED", total: 1000, processed: 0, eligible: 0, skipped: 0, lastError: null } })
        : url.includes("/operations/")
          ? response({ status: "PENDING", progress: { status: "RUNNING", total: 1000, processed: 50, eligible: 50, skipped: 0, lastError: null } })
          : url.includes("collection-run-candidates")
            ? response(candidates)
            : url.includes("collection-runs")
              ? response({ runs: [readyRun] })
              : response(catalog),
    )));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn nháp" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn nháp" }));
    expect(await screen.findByText("Đang xử lý 50/1000; đủ điều kiện 50; bỏ qua 0.")).toBeTruthy();
  });
  it("requires the Student name, calls the generated-student command, and ignores a stale School response", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const };
    const outcome = { run: generatedRun, created: [{ studentId: fixtureStudentId, studentCode: "HS001", fullName: "Bé An", className: "Lá 1" }], skipped: [] };
    let resolveAddition: ((value: Response) => void) | undefined;
    const fetch = vi.fn((url: string) => {
      if (String(url).endsWith("/generated-students")) return new Promise<Response>((resolve) => { resolveAddition = resolve; });
      return Promise.resolve(url.includes("/addable-students") ? response({ students: candidates.students, meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog));
    });
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Thêm học sinh" }));
    fireEvent.click(await screen.findByRole("button", { name: "Yêu cầu thêm" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận thêm học sinh" });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } });
    fireEvent.click(confirm);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/generated-students"))).toBe(true);
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveAddition?.(response({ outcome }));
    await waitFor(() => expect(screen.queryByText("Kết quả tạo hóa đơn từ máy chủ")).toBeNull());
  });
  it("marks the server lifecycle step and shows only the server summary for a generated run", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }], summary: { invoiceCount: 7, issuedCount: 5, invoiceTotal: "9007199254740993" } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    const steps = await screen.findByRole("list", { name: "Tiến trình đợt thu" });
    expect(within(steps).getAllByRole("listitem").map((item) => item.getAttribute("aria-current"))).toEqual([null, null, "step", null]);
    expect(within(steps).queryByRole("button")).toBeNull();
    const overview = screen.getByLabelText("Tổng quan do máy chủ tính");
    expect(within(overview).getByText("7")).toBeTruthy();
    expect(within(overview).getByText("5")).toBeTruthy();
    expect(within(overview).getByText("9.007.199.254.740.993 VND")).toBeTruthy();
  });
  it("shows the READY server summary and locked template, and waits for a DRAFT preview before showing figures", async () => {
    const readyRun = { ...run, status: "READY" as const, templateLines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí tháng", unitLabel: "tháng", defaultUnitPrice: "1500000", quantity: "1", amount: "1500000" }], summary: { eligibleCount: 124, skippedCount: 1, expectedTotal: "262600000" } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-runs") ? response({ runs: [readyRun] }) : response(catalog))));
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    const overview = await screen.findByLabelText("Tổng quan do máy chủ tính");
    expect(within(overview).getByText("124")).toBeTruthy();
    expect(within(overview).getByText("262.600.000 VND")).toBeTruthy();
    expect(within(screen.getByRole("table", { name: "Khoản thu đã chốt cho đợt" })).getByText("Học phí tháng")).toBeTruthy();
    view.unmount();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-runs") ? response({ runs: [run] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    expect(within(await screen.findByLabelText("Tổng quan do máy chủ tính")).getAllByText("Chưa xem trước")).toHaveLength(3);
  });
  it("keeps the selected run SchoolYear candidates available after a generated-run load", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const };
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("/addable-students") ? response({ students: candidates.students, meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Thêm học sinh" }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm học sinh vào đợt đã tạo" });
    expect(within(dialog).getByRole("button", { name: "Yêu cầu thêm" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes(`/collection-runs/${run.id}/addable-students`))).toBe(true);
  });
  it("requires a close reason, sends the close command, and renders the returned read-only CLOSED run", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const closed = { ...generatedRun, status: "CLOSED" as const };
    let isClosed = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/close") ? (isClosed = true, response({ status: "COMPLETED", outcome: closed })) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [isClosed ? closed : generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Đóng đợt thu" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận đóng đợt thu" });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do đóng đợt thu"), { target: { value: "Đã rà soát" } });
    fireEvent.click(confirm);
    expect(await screen.findByText("Đợt thu đã đóng")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Yêu cầu thêm" })).toBeNull();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/close") && (options as RequestInit).body === JSON.stringify({ reason: "Đã rà soát" }))).toBe(true);
  });
  it("reconciles a timed-out close with its CLOSED outcome when refresh fails and explains a DRAFT block", async () => {
    const issuedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const closed = { ...issuedRun, status: "CLOSED" as const };
    let failRefresh = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/close") ? (failRefresh = true, new Response(null, { status: 503 })) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: closed }) : url.includes(`/collection-runs/${run.id}`) ? failRefresh ? new Response(null, { status: 503 }) : response(issuedRun) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? failRefresh ? new Response(null, { status: 503 }) : response({ runs: [issuedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(screen.getByRole("button", { name: "Đóng đợt thu" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do đóng đợt thu"), { target: { value: "Đã rà soát" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đóng đợt thu" }));
    expect(await screen.findByRole("heading", { name: "Đợt thu đã đóng" })).toBe(document.activeElement);
  });
  it("disables close and explains the server-returned DRAFT invoice block", async () => {
    const draftRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [draftRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    await screen.findByText("Chưa thể đóng: còn hóa đơn nháp cần phát hành.");
    expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", true);
  });
  it("allows close when every invoice has been issued", async () => {
    const issuedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [issuedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", false);
  });
  it("reopens an Invoice discovered from the server run and edits only through server outcome", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: { serviceDate: "2026-09-01", attendanceState: "PRESENT", pickedUpAt: "17:30", lateCareMinutes: 30 }, sourceReason: "Theo dõi", sourceRecordedAt: "2026-09-01T00:00:00.000Z", sourceProvenance: {} }] };
    const expandedCatalog = { groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "PUT" ? response({ outcome: { ...invoice, total: "200", lines: [{ ...invoice.lines[0], quantity: "2", amount: "200" }] } }) : url.includes("/invoices/") ? response(invoice) : url.includes("/roster/school-years/year-a/students") ? response({ data: candidates.students }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(expandedCatalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    expect((await screen.findAllByText((_, element) => element?.tagName === "SMALL" && element.textContent?.includes("Nguồn: 2026-09-01; PRESENT; 17:30; 30 phút; Theo dõi") === true))).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu dòng" }));
    expect((await screen.findAllByText("200")).length).toBeGreaterThanOrEqual(2);
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/lines/line-a") && (options as RequestInit).method === "PUT")).toBe(true);
  });
  it("reconciles an uncertain Invoice add with the Operation outcome and run summary", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "0" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "0", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] };
    const completed = { ...invoice, total: "100", lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && url.includes("/lines") ? new Response(null, { status: 503 }) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: completed }) : url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [{ ...generatedRun, invoices: [{ ...generatedRun.invoices[0], total: "100" }] }] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    fireEvent.change(screen.getAllByLabelText("Khoản thu").at(-1)!, { target: { value: "receivable-a" } });
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await waitFor(() => expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(2));
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(true);
  });
  it("ignores stale Invoice detail and mutation responses after School changes", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "0" }] };
    let resolveDetail: ((value: Response) => void) | undefined;
    const fetch = vi.fn((url: string) => String(url).includes("/invoices/") ? new Promise<Response>((resolve) => { resolveDetail = resolve; }) : Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveDetail?.(response({ id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] }));
    await waitFor(() => expect(screen.queryByRole("region", { name: /Rà soát hóa đơn HS001/ })).toBeNull());
  });
  it("confirms removal, hides all editing actions for non-DRAFT invoices, and focuses server field errors", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    let readonly = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "DELETE" ? response({ outcome: { ...draft, total: "0", lines: [] } }) : options?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Dữ liệu không hợp lệ.", fieldErrors: { quantity: "Số lượng phải lớn hơn 0." } } }), { status: 400 }) : url.includes("/invoices/") ? response(readonly ? { ...draft, status: "ISSUED" } : draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xóa" }));
    expect(fetch.mock.calls.some(([_, options]) => (options as RequestInit)?.method === "DELETE")).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.change(screen.getAllByLabelText("Khoản thu").at(-1)!, { target: { value: "receivable-a" } });
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await screen.findByText("Số lượng phải lớn hơn 0.", { selector: "#invoice-invoice-quantity-error" });
    expect(screen.getByLabelText("Số lượng")).toHaveProperty("id", "invoice-invoice-quantity-field");
    expect(document.activeElement).toBe(screen.getByLabelText("Số lượng"));
    readonly = true;
    fireEvent.click(screen.getByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByText(/Hóa đơn đã phát hành chỉ đọc/);
    expect(screen.queryByRole("button", { name: "Thêm dòng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull();
  });
  it("uses only server-returned active accounts, requires the Student name, traps focus, and renders the issued snapshot read-only", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank-active", receivingBank: "Ngân hàng A", accountNumber: "123", accountHolderName: "Ánh Hoa" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? response({ outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank-active", receivingBank: "Ngân hàng A", accountNumber: "123", accountHolderName: "Ánh Hoa" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    const dialog = await screen.findByRole("dialog"); const confirm = screen.getByRole("button", { name: "Xác nhận phát hành" });
    expect(dialog.textContent).toContain("Ngân hàng A / 123 / Ánh Hoa"); expect(dialog.textContent).not.toContain("inactive"); expect(confirm).toHaveProperty("disabled", true);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tài khoản nhận" })));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } });
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.keyDown(confirm, { key: "Tab" }); expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tài khoản nhận" }));
    fireEvent.click(confirm);
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm dòng" })).toBeNull(); expect(screen.queryByRole("button", { name: "Phát hành hóa đơn" })).toBeNull();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/issue") && (options as RequestInit).method === "POST" && (options as RequestInit).body === JSON.stringify({ personalBankAccountId: "bank-active" }))).toBe(true);
  });
  it("refreshes the selected run from the server after issuing the second invoice so it can be closed", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [
      { id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" },
      { id: "invoice-b", studentId: "33333333-3333-4333-8333-333333333333", studentCode: "HS002", studentName: "Bé Bình", className: "Lá 2", status: "DRAFT", total: "100" },
    ] };
    const refreshedRun = { ...generatedRun, invoices: generatedRun.invoices.map((item) => item.id === "invoice-b" ? { ...item, status: "ISSUED" } : item) };
    const draft = { id: "invoice-b", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS002", name: "Bé Bình", className: "Lá 2" }, lines: [{ id: "line-b", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "0", netAmount: "100", promotionEvaluation: null, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be Binh La 2", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    let afterIssue = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST" && String(url).endsWith("/issue") ? (afterIssue = true, response({ outcome: issued })) :
      url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) :
      url.includes("/invoices/") ? response(draft) :
       url.includes("collection-run-candidates") ? response(candidates) :
       url.includes(`/collection-runs/${run.id}`) ? response(afterIssue ? refreshedRun : generatedRun) :
       url.includes("collection-runs") ? response({ runs: [afterIssue ? refreshedRun : generatedRun], meta: { nextCursor: null } }) :
      response(catalog),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByText("HS002 / Bé Bình").closest("tr")!.querySelector("button")!);
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé Bình để xác nhận"), { target: { value: "Bé Bình" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", false));
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("collection-runs")).length).toBeGreaterThanOrEqual(2);
  });
  it("closes the Issue dialog, reloads the current-School Invoice, and shows the server review message", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "0", netAmount: "100", promotionEvaluation: { applications: [{ assignmentReason: "Draft cũ", appliedDiscount: "0" }] }, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const refreshed = { ...draft, lines: [{ ...draft.lines[0], promotionEvaluation: { applications: [{ assignmentReason: "Draft mới từ máy chủ", appliedDiscount: "10" }] } }] };
    let invoiceReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? new Response(JSON.stringify({ error: { code: "PROMOTION_REVIEW_REQUIRED", message: "Máy chủ yêu cầu rà soát ưu đãi." } }), { status: 409 }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(++invoiceReads === 1 ? draft : refreshed) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    fireEvent.change(await screen.findByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Máy chủ yêu cầu rà soát ưu đãi.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Draft mới từ máy chủ")).toBeTruthy();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/invoices/invoice-a")).length).toBeGreaterThanOrEqual(2);
  });
  it("renders issued and cancelled promotion reasons only from application snapshots", async () => {
    const issued = { id: "invoice-a", status: "ISSUED", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "10", netAmount: "90", promotionEvaluation: { applications: [{ assignmentReason: "Draft provenance", appliedDiscount: "10" }] }, promotionApplicationSnapshot: [{ assignmentReason: "Issued snapshot", appliedDiscount: "10" }], overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }], issue: { obligationTotal: "90", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "90" }] };
    let cancelled = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(cancelled ? { ...issued, status: "CANCELLED", lines: [{ ...issued.lines[0], promotionApplicationSnapshot: [{ assignmentReason: "Cancelled snapshot", appliedDiscount: "10" }] }] } : issued) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });
    expect(await screen.findByText("Issued snapshot")).toBeTruthy(); expect(screen.queryByText("Draft provenance")).toBeNull();
    cancelled = true; fireEvent.click(screen.getByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText("Cancelled snapshot")).toBeTruthy(); expect(screen.queryByText("Draft provenance")).toBeNull();
  });
  it("reconciles uncertain issue outcome and keeps issue validation errors in the server error summary", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank-active", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    let uncertain = true;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? uncertain ? (uncertain = false, new Response(null, { status: 503 })) : new Response(JSON.stringify({ error: { message: "Tài khoản không còn hoạt động." } }), { status: 400 }) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank-active", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("/roster/school-years/year-a/students") ? response({ data: candidates.students }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" })); await screen.findByRole("dialog"); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
  });
  it("does not open an unusable issue dialog when the server has no active account", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("bank-accounts") ? response({ accounts: [] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    expect(await screen.findByText("Máy chủ không có tài khoản nhận đang hoạt động để phát hành hóa đơn.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("explains that a negative monthly Invoice closes at issue and carries its credit to next month", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "-35000" }] };
    const draft = { id: "invoice-a", kind: "NORMAL", status: "DRAFT", total: "-35000", billingMonth: "2026-10", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Tiền ăn", unitLabel: "ngày", unitPrice: "35000", quantity: "2", amount: "-35000", grossAmount: "70000", discountAmount: "0", refundUnitPrice: "35000", deductionQuantity: "3", deductionAmount: "105000", netAmount: "-35000", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("bank-accounts") ? response({ accounts: [{ id: "bank-active", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText("Tổng âm: tiền thừa 35.000 đ không hoàn ngay mà trừ vào hóa đơn tháng sau. Hóa đơn tự đóng khi phát hành.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Phát hành hóa đơn" }) as HTMLButtonElement).disabled).toBe(false);
  });
  it("keeps the issued success visible when the post-issue Finance refresh fails", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    let afterIssue = false;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? (afterIssue = true, response({ outcome: issued })) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(draft) : url.includes(`/collection-runs/${run.id}`) ? afterIssue ? new Response(null, { status: 503 }) : response(generatedRun) : url.includes("collection-run-candidates") ? response(candidates) : afterIssue && url.includes("collection-runs") ? new Response(null, { status: 503 }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" })); await screen.findByRole("dialog"); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
    expect(await screen.findByText("Hóa đơn đã phát hành; chưa thể tải lại dữ liệu mới nhất.")).toBeTruthy();
  });
  it("requires a reason and named confirmation before preparing a server-returned revision draft", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    const issued = { id: "invoice-a", status: "ISSUED", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const replacement = { ...issued, id: "replacement", status: "DRAFT", revisesInvoiceId: "invoice-a", revisionReason: "Sai khoản thu", lines: [] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/revisions") ? response({ outcome: replacement }) : url.includes("/invoices/") ? response(issued) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Chuẩn bị bản điều chỉnh" }));
    const dialog = await screen.findByRole("dialog", { name: "Chuẩn bị bản điều chỉnh cho Bé An" });
    expect(document.activeElement).toBe(screen.getByLabelText("Lý do điều chỉnh"));
    const confirm = screen.getByRole("button", { name: "Xác nhận chuẩn bị bản điều chỉnh" }); expect(confirm).toHaveProperty("disabled", true);
    fireEvent.keyDown(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { key: "Tab" }); expect(document.activeElement).toBe(dialog.querySelector("textarea"));
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh"), { target: { value: "Sai khoản thu" } }); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(confirm);
    expect(within(await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ })).getByText("Nháp")).toBeTruthy();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/revisions") && (options as RequestInit).body === JSON.stringify({ reason: "Sai khoản thu" }))).toBe(true);
  });
  it("traps revision-dialog focus, restores its trigger, issues the replacement route, and renders a cancelled source readonly", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "replacement", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const replacement = { id: "replacement", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: "source", revisionReason: "Sai", replacementInvoiceId: null, student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...replacement, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue-revision") ? response({ outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(replacement) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch); render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ }); fireEvent.click(screen.getByRole("button", { name: "Phát hành bản thay thế" })); await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy(); expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/issue-revision"))).toBe(true);
  });
  it("does not load unrelated coverage approvals in the run detail workspace", async () => {
    const pendingRequest = { id: "request-a", coverageId: "coverage-a", studentName: "Bé An", amount: "62", effectiveOn: "2026-10-10", reason: "Rút học", canDecide: true };
    const fetch = vi.fn((url: string) => Promise.resolve(
      String(url).includes("coverage-reversal-requests") ? response({ requests: [pendingRequest] }) :
      String(url).includes("promotion-students") ? response({ students: [] }) : String(url).includes("promotion-policies") ? response({ policies: [] }) : String(url).includes("collection-run-candidates") ? response(candidates) : String(url).includes("collection-runs") ? response({ runs: [] }) : response(catalog),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole("form", { name: "Điều khiển danh sách đợt thu" });
    expect(screen.queryByText("Yêu cầu hoàn ưu đãi trả trước chờ duyệt")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("coverage-reversal-requests"))).toBe(false);
  });
  it("settles a Student who left last month from the run instead of a standalone prepaid refund", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "90" }] };
    let settled = false;
    const settlement = { id: "invoice-s", kind: "SETTLEMENT", channel: "SCHOOL", status: "DRAFT", total: "-11970000", billingMonth: "2026-09", enrollmentEndedOn: "2026-08-15", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, settlementTransfer: null, carries: [], student: { code: "HS063", name: "Bé Gia Bảo", className: "Chồi 3B" }, lines: [{ id: "line-p", kind: "NORMAL", receivableId: "tuition", receivableName: "Học phí", unitLabel: "gói", unitPrice: "6900000", quantity: "0", amount: "-11970000", grossAmount: "0", discountAmount: "0", netAmount: "-11400000", taxCategory: "VAT_5", vatRate: 5, vatAmount: "-570000", refundUnitPrice: "11400000", deductionQuantity: "1", proposedDeductionQuantity: "1", deductionAmount: "11400000", deductionReason: null, deductionSource: { type: "PREPAID_PACKAGE_V1", months: 12, usedMonths: 6, firstMonth: "2026-03", lastMonth: "2027-02", paidNet: "52800000", listPriceUsed: "41400000", priorRefundNet: "0" }, promotionEvaluation: { applications: [] }, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const students = () => [{ studentId: "student-s", studentCode: "HS063", fullName: "Bé Gia Bảo", className: "Chồi 3B", lifecycle: "WITHDRAWN", endedOn: "2026-08-15", invoices: settled ? [{ id: "invoice-s", channel: "SCHOOL", status: "DRAFT", total: "-11970000" }] : [] }];
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/settlements") ? (settled = true, response({ status: "COMPLETED", outcome: settlement })) : url.endsWith("/settlements") ? response({ students: students() }) : url.endsWith("/invoices/invoice-s") ? response({ ...settlement, notice: { classDefaultBankAccountId: null, invoices: [settlement] } }) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    const table = await screen.findByRole("table", { name: "Học sinh cần quyết toán trong đợt" });
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["HS063 / Bé Gia Bảo", "Chồi 3B", "15/08/2026", "Chưa tạo", "—", "Tạo hóa đơn quyết toán"]);
    fireEvent.click(within(table).getByRole("button", { name: "Tạo hóa đơn quyết toán" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith(`/collection-runs/${run.id}/settlements`) && (options as RequestInit | undefined)?.method === "POST" && (options as RequestInit).body === JSON.stringify({ studentId: "student-s" }))).toBe(true));
    expect(await screen.findByText("Quyết toán")).toBeTruthy();
    expect(screen.getByText(/Hoàn học phí nộp trước · gói 12 tháng 03\/2026 - 02\/2027 · đã học 6\/12 tháng · đã nộp 52.800.000 - giá gốc tháng đã học 41.400.000/)).toBeTruthy();
    // The standalone prepaid refund form is gone.
    expect(screen.queryByRole("region", { name: "Hoàn ưu đãi nộp trước" })).toBeNull();
    expect(screen.queryByLabelText("Ưu đãi đã phát hành")).toBeNull();
  });
  it("does not expose coverage approval controls in the run workspace", async () => {
    const request = { id: "request-a", coverageId: "coverage-a", studentName: "Bé An", amount: "62", effectiveOn: "2026-10-10", reason: "Rút học", canDecide: false };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("coverage-reversal-requests") ? response({ requests: [request] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByRole("form", { name: "Điều khiển danh sách đợt thu" });
    expect(screen.queryByText("Không có quyền quyết định")).toBeNull(); expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull(); expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
  });
  it("renders a closed replacement as settled through immutable transferred source receipt", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "replacement", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const replacement = { id: "replacement", status: "CLOSED", total: "100", billingMonth: "2026-09", revisesInvoiceId: "source", revisionReason: "Sửa", replacementInvoiceId: null, receipt: null, settlementTransfer: { sourceInvoiceId: "source", sourceReceiptId: "receipt-source", amount: "100", postedAt: "2026-09-20T00:00:00.000Z" }, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(replacement) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun(); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText(/Đã tất toán theo khoản thu đã ghi nhận trước đó: 100 VND/)).toBeTruthy(); expect(screen.getByText(/ghi nhận 2026-09-20T00:00:00.000Z/)).toBeTruthy(); expect(screen.queryByText("Chưa có trạng thái thanh toán trong phạm vi này.")).toBeNull();
  });

  it("creates PREPAID_COVERAGE policy version with positive prepaidTermMonths", async () => {
    const customCatalog = {
      groups: [],
      receivables: [
        {
          id: "rec-1",
          groupId: "group-1",
          code: "HP",
          displayName: "Học phí",
          unitLabel: "tháng",
          defaultUnitPrice: "100",
          status: "ACTIVE" as const,
          available: true,
        },
      ],
    };
    const fetch = vi.fn((url: string, options?: RequestInit) =>
      Promise.resolve(
        options?.method === "POST" && String(url).includes("/finance/promotion-policies")
          ? response({ outcome: { id: "policy-new" } })
          : url.includes("promotion-students")
            ? response({ students: candidates.students })
            : url.includes("promotion-policies")
              ? response({ policies: [] })
              : url.includes("collection-run-candidates")
                ? response(candidates)
                : url.includes("collection-runs")
                  ? response({ runs: [] })
                  : response(customCatalog),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(
      <FinanceWorkspace
        schoolId="school-a"
        schoolName="Trường A"
        page="promotions"
        denied={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Thêm chính sách" }));
    fireEvent.change(await screen.findByLabelText("Tên chính sách"), { target: { value: "Đóng trước 3 tháng" } });
    expect(screen.queryByLabelText("Thời hạn nộp trước (tháng)")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: /Ưu đãi nộp trước/ }));
    const termInput = await screen.findByLabelText("Thời hạn nộp trước (tháng)");
    fireEvent.change(termInput, { target: { value: "3" } });
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByLabelText("Học phí"));
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));
    await waitFor(() => {
      const call = fetch.mock.calls.find(([url, options]) =>
        String(url).includes("/finance/promotion-policies") && options?.method === "POST"
      );
      expect(call).toBeTruthy();
      const body = JSON.parse((call![1] as RequestInit).body as string);
      expect(body.policyId).toBeNull();
      expect(body.fulfillmentMode).toBe("PREPAID_COVERAGE");
      expect(body.prepaidTermMonths).toBe(3);
    });
  });

  it("applies and clears coverage on a DRAFT invoice with derived facts", async () => {
    const generatedRun = {
      ...run,
      status: "GENERATED" as const,
      invoices: [{ id: "invoice-draft", studentId: fixtureStudentId, studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "180" }],
    };
    const coveragePolicy = {
      id: "cov-pol",
      name: "Prepaid 3M",
      versions: [
        {
          id: "cov-ver-1",
          version: 1,
          status: "ACTIVE" as const,
          discountType: "PERCENTAGE" as const,
          discountValue: "10",
          priority: 1,
          stackingMode: "STACKABLE" as const,
          fulfillmentMode: "PREPAID_COVERAGE" as const,
          prepaidTermMonths: 3,
          effectiveFrom: "2026-09-01",
          effectiveTo: null,
          targets: [{ id: "target-1", receivableId: "meal", receivableName: "Học phí" }],
          assignments: [],
        },
      ],
    };
    const draftInvoice = {
      id: "invoice-draft",
      status: "DRAFT",
      total: "180",
      billingMonth: "2026-10",
      revisesInvoiceId: null,
      revisionReason: null,
      replacementInvoiceId: null,
      receipt: null,
      carries: [],
      coverageFacts: [
        {
          receivableId: "meal",
          billingMonth: "2026-10",
          originalPrice: "100",
          reduction: "10",
          serviceStart: "2026-10-01",
          serviceEnd: "2026-11-01",
          calendarEffectiveFrom: "2026-01-01",
          timezone: "Asia/Ho_Chi_Minh",
          issuedAt: null,
          versionId: "cov-ver-1",
        },
      ],
      student: { code: "HS001", name: "Bé An", className: "Lá 1" },
      lines: [
        {
          id: "line-1",
          receivableId: "meal",
          receivableName: "Học phí",
          unitLabel: "tháng",
          unitPrice: "90",
          quantity: "1",
          amount: "90",
          grossAmount: "100",
          discountAmount: "10",
          netAmount: "90",
          promotionEvaluation: null,
          promotionApplicationSnapshot: null,
          overrideReason: null,
          source: null,
          sourceReason: null,
          sourceRecordedAt: null,
          sourceProvenance: null,
          sourceAudit: null,
        },
      ],
      issue: null,
    };

    const fetch = vi.fn((url: string, options?: RequestInit) => {
      const urlStr = String(url);
      if (options?.method === "PUT" && urlStr.includes("/invoices/invoice-draft/coverage")) {
        return Promise.resolve(response({ outcome: { id: "invoice-draft" } }));
      }
      if (urlStr.includes("/invoices/invoice-draft")) {
        return Promise.resolve(response(draftInvoice));
      }
      if (urlStr.includes("promotion-policies")) {
        return Promise.resolve(response({ policies: [coveragePolicy] }));
      }
      if (urlStr.includes("collection-run-candidates")) {
        return Promise.resolve(response(candidates));
      }
      if (urlStr.includes("collection-runs")) {
        return Promise.resolve(response({ runs: [generatedRun] }));
      }
      return Promise.resolve(response(catalog));
    });
    vi.stubGlobal("fetch", fetch);

    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await openRun();
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByRole("region", { name: /Rà soát hóa đơn HS001/ });

    // Verify derived coverage facts table rendering
    expect(await screen.findByText("Thông tin ưu đãi nộp trước cho hóa đơn")).toBeTruthy();
    expect(screen.getByText("Chờ hóa đơn đóng")).toBeTruthy();

    // Verify Apply coverage
    fireEvent.change(screen.getByLabelText("Chính sách ưu đãi nộp trước"), { target: { value: "cov-ver-1" } });
    const applyBtn = screen.getByRole("button", { name: "Áp dụng ưu đãi nộp trước" });
    expect(applyBtn).toHaveProperty("disabled", false);
    fireEvent.click(applyBtn);

    await waitFor(() => {
      const call = fetch.mock.calls.find(([u, opts]) =>
        String(u).includes("/invoices/invoice-draft/coverage") && opts?.method === "PUT"
      );
      expect(call).toBeTruthy();
      expect(JSON.parse((call![1] as RequestInit).body as string)).toEqual({ versionId: "cov-ver-1" });
    });

    // Verify Clear coverage
    const clearBtn = screen.getByRole("button", { name: "Xóa ưu đãi nộp trước" });
    fireEvent.click(clearBtn);

    await waitFor(() => {
      const call = fetch.mock.calls.find(([u, opts]) =>
        String(u).includes("/invoices/invoice-draft/coverage") && opts?.method === "PUT" &&
        JSON.parse((opts as RequestInit).body as string).versionId === null
      );
      expect(call).toBeTruthy();
    });
  });
});
