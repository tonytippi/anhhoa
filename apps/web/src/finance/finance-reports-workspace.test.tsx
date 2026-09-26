import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("renders metadata and VND values returned by the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(report())));
    render(<FinanceReportsWorkspace {...props()} />);

    await screen.findByText(/Chốt tại 2026-09-25T10:30:00\+07:00; tạo lúc 2026-09-25T10:31:00\+07:00; Asia\/Ho_Chi_Minh; finance-ledger-v3\./);
    expect(screen.getByText("1.234.567 VND")).toBeTruthy();
    expect(screen.getByText("1.000.000 VND")).toBeTruthy();
    expect(screen.getByText("-12.500 VND")).toBeTruthy();
    expect(screen.getByRole("cell", { name: "1.000.000" })).toBeTruthy();
  });

  it("requests each of the four server report workspaces", async () => {
    const fetch = vi.fn().mockResolvedValue(response(report()));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    await screen.findByRole("button", { name: "Tải CSV từ máy chủ" });

    fireEvent.click(screen.getByRole("tab", { name: "Đối soát đợt thu" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/collection-runs", { credentials: "include" }));
    fireEvent.click(screen.getByRole("tab", { name: "Công nợ" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/outstanding", { credentials: "include" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sổ cash/điều chỉnh" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật báo cáo" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Không thể tải báo cáo từ sổ cái.");
    expect(screen.queryByRole("button", { name: "Tải CSV từ máy chủ" })).toBeNull();
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
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));
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
    await screen.findByRole("button", { name: "Tải CSV từ máy chủ" });
    fireEvent.change(screen.getByLabelText("Nhóm khoản thu"), { target: { value: "Học phí" } });
    fireEvent.change(screen.getByLabelText("Lớp"), { target: { value: "Lá 1" } });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật báo cáo" }));
    await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/app/schools/school-a/finance/reports/overview?className=L%C3%A1+1&groupName=H%E1%BB%8Dc+ph%C3%AD", { credentials: "include" }));
    fireEvent.keyDown(screen.getByRole("tab", { name: "Tổng quan Finance" }), { key: "ArrowRight" });
    await waitFor(() => expect(screen.getByRole("tab", { name: "Đối soát đợt thu" })).toHaveProperty("tabIndex", 0));
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));
    expect((await screen.findByRole("alert")).textContent).toContain("không còn cho phép xuất");
    expect(screen.getByText(/Chốt tại 2026-09-25T10:30:00/)).toBeTruthy();
    expect(screen.getByText("Cash, carry, debt, coverage và hoàn theo cả hóa đơn chưa được phân bổ vào nhóm.")).toBeTruthy();
  });

  it("clears the prior School report while the replacement School request is pending", async () => {
    let resolveSchoolB!: (value: Response) => void;
    const fetch = vi.fn((url: string) => String(url).includes("school-b") ? new Promise<Response>((resolve) => { resolveSchoolB = resolve; }) : Promise.resolve(response(report({ rows: [{ id: "old", postedAt: "old-entry", type: "RECEIPT", billingMonth: null, amount: "1" }] }))));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceReportsWorkspace {...props()} />);
    await screen.findByText("old-entry");
    view.rerender(<FinanceReportsWorkspace {...props({ schoolId: "school-b", schoolName: "Trường B" })} />);
    expect(screen.getByText("Đang tải báo cáo...")).toBeTruthy();
    expect(screen.queryByText("old-entry")).toBeNull();
    resolveSchoolB(response(report({ rows: [{ id: "new", postedAt: "new-entry", type: "ADJUSTMENT", billingMonth: null, amount: "2" }] })));
    await screen.findByText("new-entry");
  });

  it("requests an opaque server export with reconciliation identifiers and navigates only from its completed outcome", async () => {
    const assign = vi.fn();
    const createObjectUrl = vi.spyOn(URL, "createObjectURL");
    vi.stubGlobal("window", { location: { assign } });
    const fetch = vi.fn((_: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ id: "operation-id", status: "COMPLETED", outcome: { exportId: "export-opaque-id" } }) : response(report())));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceReportsWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));

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
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Tải CSV từ máy chủ" }));
    view.rerender(<FinanceReportsWorkspace {...props({ schoolId: "school-b", schoolName: "Trường B" })} />);
    resolveExport(response({ exportId: "old-school-export" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    vi.unstubAllGlobals();
    expect(assign).not.toHaveBeenCalled();
  });
});
