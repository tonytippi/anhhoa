import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceReportsWorkspace } from "./finance-reports-workspace";

const report = (overrides: Record<string, unknown> = {}) => ({
  workspace: "overview",
  asOf: "2026-09-25T10:30:00+07:00",
  generatedAt: "2026-09-25T10:31:00+07:00",
  timezone: "Asia/Ho_Chi_Minh",
  reportDefinitionVersion: "finance-ledger-v3",
  summary: { billed: "1234567", actualReceipt: "1000000", adjustments: "-12500" },
  rows: [{ id: "entry-a", postedAt: "2026-09-25T09:00:00+07:00", type: "RECEIPT", billingMonth: "2026-09", amount: "1000000" }],
  ...overrides,
});
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status, headers: { "content-type": "application/json" } });
const props = (overrides: Partial<Parameters<typeof FinanceReportsWorkspace>[0]> = {}) => ({ schoolId: "school-a", schoolName: "Trường A", denied: vi.fn(), ...overrides });

describe("FinanceReportsWorkspace", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("leads with server KPI tiles and charts and keeps metadata to one footnote", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(report({ summary: { gross: "2550000", promotionDiscount: "150000", deduction: "84000", vat: "67500", otherAdjustments: "0", netBilled: "2383500", actualReceipt: "2000000", outstanding: "383500", payout: "448000", refundOwed: "0", refund: "0", refundVat: "0" }, charts: { byMonth: [{ billingMonth: "2026-08", netBilled: "2300000", actualReceipt: "2300000" }, { billingMonth: "2026-09", netBilled: "2383500", actualReceipt: "2000000" }], byClass: [{ className: "Mầm 4A", netBilled: "2383500", actualReceipt: "2000000", outstanding: "383500" }], runStatus: [], aging: [], topDebtors: [], cashByWeek: [] } }))));
    render(<FinanceReportsWorkspace {...props()} />);
    await screen.findAllByText("Phải thu ròng");
    const kpis = document.querySelector(".finance-report-kpis")!;
    for (const [label, value] of [["Đã thu", "2.000.000 đ"], ["Còn phải thu", "383.500 đ"], ["Đã chi hoàn", "448.000 đ"]] as const) expect(within(kpis as HTMLElement).getByText(label).parentElement!.textContent).toContain(value);
    expect(screen.getByText("83% số phải thu")).toBeTruthy();
    // The bridge shows each server measure with its sign; zero adjustments are omitted.
    const bridge = screen.getByRole("region", { name: "Từ tổng phải thu đến phải thu ròng" });
    for (const text of ["Tổng phải thu", "2.550.000 đ", "-150.000 đ", "Bớt (hoàn trả nghỉ)", "-84.000 đ", "+67.500 đ", "Phải thu ròng", "2.383.500 đ"]) expect(bridge.textContent).toContain(text);
    expect(bridge.textContent).not.toContain("Nợ kỳ trước và chênh lệch");
    const months = screen.getByRole("region", { name: "Phải thu và đã thu theo tháng" });
    expect(months.querySelectorAll("path.finance-chart-mark")).toHaveLength(4);
    expect(within(months).getByRole("img", { name: "Đã thu · 09/2026: 2.000.000 đ" })).toBeTruthy();
    fireEvent.focus(within(months).getByRole("img", { name: "Đã thu · 09/2026: 2.000.000 đ" }));
    expect(screen.getByRole("status").textContent).toBe("2.000.000 đĐã thu · 09/2026");
    expect(within(months).getByText("Xem dạng bảng")).toBeTruthy();
    expect(screen.getByRole("table", { name: "Chi tiết theo lớp" }).textContent).toContain("83%");
    expect(screen.getByText(/Số liệu chốt/)).toBeTruthy();
    expect(screen.queryByText(/Phiên bản định nghĩa|Kết quả do hệ thống trả về/)).toBeNull();
    expect(screen.getByText(/múi giờ Asia\/Ho_Chi_Minh, phiên bản finance-ledger-v3/)).toBeTruthy();
  });

  it("shows coverage refund and its VAT only when the server result has them", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(report({ summary: { gross: "100", promotionDiscount: "0", deduction: "0", vat: "0", otherAdjustments: "0", netBilled: "100", actualReceipt: "0", outstanding: "100", payout: "0", refundOwed: "0", refund: "0", refundVat: "0" } }))));
    const { unmount } = render(<FinanceReportsWorkspace {...props()} />);
    await screen.findByRole("button", { name: "Tải CSV" });
    expect(screen.queryByText(/Hoàn tiền coverage/)).toBeNull();
    expect(screen.queryByText("Thuế GTGT")).toBeNull();
    unmount();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(report({ summary: { gross: "3000000", promotionDiscount: "0", deduction: "0", vat: "250000", otherAdjustments: "0", netBilled: "3250000", actualReceipt: "0", outstanding: "0", payout: "0", refundOwed: "0", refund: "-110000", refundVat: "10000" } }))));
    render(<FinanceReportsWorkspace {...props()} />);
    expect((await screen.findByText(/Hoàn tiền coverage/)).textContent).toBe("Hoàn tiền coverage: -110.000 đ · VAT đã hoàn 10.000 đ");
    expect(screen.getByText("Thuế GTGT")).toBeTruthy();
  });

  it("draws debt aging, run status and weekly cash from the server series", async () => {
    const charts = { byMonth: [], byClass: [], runStatus: [{ collectionRunId: "run", billingMonth: "2026-09", issued: 5, exact: 2, shortfall: 1, overpayment: 0, refunded: 1, awaitingReceipt: 1, awaitingPayout: 0 }], aging: [{ key: "NOT_DUE", amount: "100" }, { key: "1_15", amount: "50" }, { key: "16_30", amount: "0" }, { key: "OVER_30", amount: "25" }], topDebtors: [{ studentId: "s", studentCode: "HS1", studentName: "Bé An", className: "Lá 1", outstanding: "175", invoices: 2, maxOverdueDays: 41 }], cashByWeek: [{ weekStart: "2026-09-07", cashIn: "2000000", cashOut: "448000" }] };
    const fetch = vi.fn((url: string) => Promise.resolve(response(report({ workspace: String(url).split("/reports/")[1]!.split("?")[0], charts, rows: [] }))));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    await screen.findAllByText("Phải thu ròng");
    fireEvent.click(screen.getByRole("tab", { name: "Đối soát đợt thu" }));
    const status = await screen.findByRole("region", { name: "Trạng thái hóa đơn · Đợt thu tháng 09/2026" });
    expect(status.textContent).toContain("✓ Đã thu đủ 2");
    expect(status.textContent).toContain("! Thu thiếu 1");
    fireEvent.click(screen.getByRole("tab", { name: "Công nợ" }));
    const aging = await screen.findByRole("region", { name: "Công nợ theo thời gian quá hạn" });
    expect(within(aging).getByRole("img", { name: "Quá hạn trên 30 ngày: 25 đ" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Học sinh còn nợ nhiều nhất" }).textContent).toContain("41 ngày");
    fireEvent.click(screen.getByRole("tab", { name: "Sổ tiền và điều chỉnh" }));
    const cash = await screen.findByRole("region", { name: "Tiền vào và tiền ra theo tuần" });
    expect(within(cash).getByRole("img", { name: "Tiền ra · 07/09: 448.000 đ" })).toBeTruthy();
  });

  it("requests each of the four server report workspaces", async () => {
    const fetch = vi.fn().mockResolvedValue(response(report()));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    await screen.findByRole("button", { name: "Tải CSV" });

    fireEvent.click(screen.getByRole("tab", { name: "Đối soát đợt thu" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/collection-runs", { credentials: "include" }));
    fireEvent.click(screen.getByRole("tab", { name: "Công nợ" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/outstanding", { credentials: "include" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sổ tiền và điều chỉnh" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/cash-adjustments", { credentials: "include" }));
    expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/overview", { credentials: "include" });
  });

  it("shows loading, an explicit empty ledger, and a non-denied error without synthetic results", async () => {
    let resolve!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(new Promise<Response>((done) => { resolve = done; })).mockResolvedValueOnce(response(report({ rows: [] }))));
    render(<FinanceReportsWorkspace {...props()} />);
    expect(screen.getByText("Đang tải báo cáo...")).toBeTruthy();
    resolve(response(report({ rows: [] })));
    await screen.findByText("Không có hoạt động sổ cái phù hợp tại thời điểm chốt.");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 500 })));
    fireEvent.click(screen.getByRole("button", { name: "Xem số liệu" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể tải báo cáo từ sổ cái.");
    expect(screen.queryByRole("button", { name: "Tải CSV" })).toBeNull();
  });

  it("delegates 401 report loads and 403 export requests to protected-state handling", async () => {
    const deniedLoad = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({}, 401)));
    const view = render(<FinanceReportsWorkspace {...props({ denied: deniedLoad })} />);
    await waitFor(() => expect(deniedLoad).toHaveBeenCalledTimes(1));
    view.unmount();

    const deniedExport = vi.fn();
    const fetch = vi.fn((_: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({}, 403) : response(report())));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props({ denied: deniedExport })} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));
    await waitFor(() => expect(deniedExport).toHaveBeenCalledTimes(1));
  });

  it("sends editable server filters, supports keyboard tabs, and preserves the report on an unavailable export", async () => {
    const fetch = vi.fn((_: string, options?: RequestInit) =>
      Promise.resolve(
        options?.method === "POST"
          ? response({}, 409)
          : response(report({ filters: { schoolYearId: null, billingMonth: "2026-09", runId: null, className: "Lá 1", groupName: "Học phí", status: "ISSUED" } })),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    await screen.findByRole("button", { name: "Tải CSV" });
    fireEvent.change(screen.getByLabelText("Nhóm khoản thu"), { target: { value: "Học phí" } });
    fireEvent.change(screen.getByLabelText("Lớp"), { target: { value: "Lá 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Xem số liệu" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/overview?className=L%C3%A1+1&groupName=H%E1%BB%8Dc+ph%C3%AD", { credentials: "include" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tổng quan" }), { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Đối soát đợt thu" })).toHaveProperty("tabIndex", 0));
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));
    expect((await screen.findByRole("alert")).textContent).toContain("không còn cho phép xuất");
    expect(screen.getByText(/Số liệu chốt/)).toBeTruthy();
    expect(screen.getByText("Tiền thu, chuyển kỳ, nợ, gói nộp trước và hoàn tiền theo cả hóa đơn chưa được phân bổ vào nhóm.")).toBeTruthy();
  });

  it("clears the prior School report while the replacement School request is pending", async () => {
    let resolveSchoolB!: (value: Response) => void;
    const fetch = vi.fn((url: string) => String(url).includes("school-b") ? new Promise<Response>((resolve) => { resolveSchoolB = resolve; }) : Promise.resolve(response(report({ charts: { byMonth: [], byClass: [{ className: "old-entry", netBilled: "1", actualReceipt: "0", outstanding: "1" }], runStatus: [], aging: [], topDebtors: [], cashByWeek: [] } }))));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceReportsWorkspace {...props()} />);
    await screen.findAllByText("old-entry");
    view.rerender(<FinanceReportsWorkspace {...props({ schoolId: "school-b", schoolName: "Trường B" })} />);
    expect(screen.getByText("Đang tải báo cáo...")).toBeTruthy();
    expect(screen.queryAllByText("old-entry")).toHaveLength(0);
    resolveSchoolB(response(report({ charts: { byMonth: [], byClass: [{ className: "new-entry", netBilled: "2", actualReceipt: "0", outstanding: "2" }], runStatus: [], aging: [], topDebtors: [], cashByWeek: [] } })));
    await screen.findAllByText("new-entry");
  });

  it("requests an opaque server export with reconciliation identifiers and navigates only from its completed outcome", async () => {
    const assign = vi.fn();
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    vi.stubGlobal("window", { location: { assign } });
    const fetch = vi.fn((_: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ id: "operation-id", status: "COMPLETED", outcome: { exportId: "export-opaque-id" } }) : response(report())));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    expect(assign).toHaveBeenCalledWith("/api/app/schools/school-a/finance/report-exports/export-opaque-id/download");
    expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/overview/exports", expect.objectContaining({ method: "POST", credentials: "include", headers: expect.objectContaining({ "content-type": "application/json", "x-csrf-token": "", "idempotency-key": expect.any(String), "x-operation-id": expect.any(String) }), body: JSON.stringify({ asOf: "2026-09-25T10:30:00+07:00", schoolYearId: null, billingMonth: null, runId: null, className: null, groupName: null, status: null }) }));
    expect(createObjectUrl).not.toHaveBeenCalled();
  });

  it("reconciles an ambiguous export POST before downloading its completed Operation outcome", async () => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.reject(new TypeError("timeout"));
      if (url.includes("/operations/")) return Promise.resolve(response({ id: "operation", status: "COMPLETED", outcome: { exportId: "reconciled-export" } }));
      return Promise.resolve(response(report()));
    });
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/finance/operations/"), { credentials: "include" });
    expect(assign).toHaveBeenCalledWith("/api/app/schools/school-a/finance/report-exports/reconciled-export/download");
  });

  it.each([503, 504])("reconciles HTTP %i export uncertainty once before downloading", async (status) => {
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({}, status));
      if (url.includes("/operations/")) return Promise.resolve(response({ id: "operation", status: "COMPLETED", outcome: { exportId: `reconciled-${status}` } }));
      return Promise.resolve(response(report()));
    });
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    expect(fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/finance/operations/"), { credentials: "include" });
    expect(assign).toHaveBeenCalledWith(`/api/app/schools/school-a/finance/report-exports/reconciled-${status}/download`);
  });

  it("never navigates for an export that resolves after its School context changed", async () => {
    let resolveExport!: (value: Response) => void;
    const assign = vi.fn(); vi.stubGlobal("window", { location: { assign } });
    const fetch = vi.fn((url: string, options?: RequestInit) => options?.method === "POST" ? new Promise<Response>((resolve) => { resolveExport = resolve; }) : Promise.resolve(response(report({ rows: [{ id: String(url), postedAt: String(url), type: "RECEIPT", billingMonth: null, amount: "1" }] }))));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceReportsWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV" }));
    view.rerender(<FinanceReportsWorkspace {...props({ schoolId: "school-b", schoolName: "Trường B" })} />);
    resolveExport(response({ exportId: "old-school-export" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    expect(assign).not.toHaveBeenCalled();
  });
});
