import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceWorkspace } from "./finance-workspace";

const catalog = { groups: [], receivables: [] };
const run = {
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "year-a",
  billingMonth: "2026-09",
  type: "MONTHLY",
  status: "DRAFT",
  version: 2,
  selectedStudentIds: ["22222222-2222-4222-8222-222222222222"],
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
    { id: run.selectedStudentIds[0], studentCode: "HS001", fullName: "Bé An" },
  ],
};
const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), { status });
afterEach(() => {
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("FinanceWorkspace", () => {
  it("renders server preview eligible rows and categorized skips without local classification", async () => {
    const preview = {
      run,
      fingerprint: "server-fingerprint",
      eligible: [
        {
          studentId: run.selectedStudentIds[0],
          studentCode: "HS001",
          fullName: "Bé An",
          className: "Lá 1",
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Xem trước từ máy chủ" }),
    );
    expect(await screen.findByText("HS001 / Bé An")).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Xem trước từ máy chủ" }),
    );
    await screen.findByRole("button", {
      name: "Xác nhận preview và chuyển READY",
    });
    fireEvent.click(
      screen.getByRole("button", { name: "Xác nhận preview và chuyển READY" }),
    );
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Bản xem trước đã cũ.",
    );
    expect(
      (screen.getByLabelText("Chọn HS001 Bé An") as HTMLInputElement).checked,
    ).toBe(true);
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
    fireEvent.change(await screen.findByLabelText("Năm học"), {
      target: { value: "year-a" },
    });
    fireEvent.change(screen.getByLabelText("Tháng thu"), {
      target: { value: "2026-09" },
    });
    fireEvent.submit(
      screen
        .getByRole("button", { name: "Mở hoặc vào đợt thu" })
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
          studentId: run.selectedStudentIds[0],
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
    expect(await screen.findByText("HS001 / Bé An")).toBeTruthy();
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
      created: [{ studentId: run.selectedStudentIds[0], studentCode: "HS001", fullName: "Bé An", className: "Lá 1" }],
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn nháp" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn nháp" }));
    expect(await screen.findByText("HS001 / Bé An")).toBeTruthy();
    expect(screen.getByText("HS002 / Bé Bình: Học sinh không ở trạng thái đang theo học.")).toBeTruthy();
  });
  it("requires the Student name, calls the generated-student command, and ignores a stale School response", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const };
    const outcome = { run: generatedRun, created: [{ studentId: run.selectedStudentIds[0], studentCode: "HS001", fullName: "Bé An", className: "Lá 1" }], skipped: [] };
    let resolveAddition: ((value: Response) => void) | undefined;
    const fetch = vi.fn((url: string) => {
      if (String(url).endsWith("/generated-students")) return new Promise<Response>((resolve) => { resolveAddition = resolve; });
      return Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog));
    });
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(screen.getByRole("button", { name: "Yêu cầu thêm" }));
    const confirm = screen.getByRole("button", { name: "Xác nhận thêm học sinh" });
    expect(confirm).toHaveProperty("disabled", true);
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } });
    fireEvent.click(confirm);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/generated-students"))).toBe(true);
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveAddition?.(response({ outcome }));
    await waitFor(() => expect(screen.queryByText("Kết quả tạo hóa đơn từ máy chủ")).toBeNull());
  });
  it("keeps the selected run SchoolYear candidates available after a generated-run load", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const };
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    expect(await screen.findByRole("button", { name: "Yêu cầu thêm" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("collection-run-candidates?schoolYearId=year-a"))).toBe(true);
  });
  it("reopens an Invoice discovered from the server run and edits only through server outcome", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: { serviceDate: "2026-09-01", attendanceState: "PRESENT", pickedUpAt: "17:30", lateCareMinutes: 30 }, sourceReason: "Theo dõi", sourceRecordedAt: "2026-09-01T00:00:00.000Z", sourceProvenance: {} }] };
    const expandedCatalog = { groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "PUT" ? response({ outcome: { ...invoice, total: "200", lines: [{ ...invoice.lines[0], quantity: "2", amount: "200" }] } }) : url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(expandedCatalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByText(/Rà soát hóa đơn HS001/);
    await screen.findByText(/Rà soát hóa đơn HS001/);
    expect((await screen.findAllByText((_, element) => element?.tagName === "SMALL" && element.textContent?.includes("Nguồn: 2026-09-01 PRESENT 17:30 30; Theo dõi") === true))).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Sửa" }));
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu dòng" }));
    expect((await screen.findAllByText("200")).length).toBeGreaterThanOrEqual(2);
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/lines/line-a") && (options as RequestInit).method === "PUT")).toBe(true);
  });
  it("reconciles an uncertain Invoice add with the Operation outcome and run summary", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "0" }] };
    const invoice = { id: "invoice-a", status: "DRAFT", total: "0", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] };
    const completed = { ...invoice, total: "100", lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && url.includes("/lines") ? new Response(null, { status: 503 }) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: completed }) : url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [{ ...generatedRun, invoices: [{ ...generatedRun.invoices[0], total: "100" }] }] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    await screen.findByText(/Rà soát hóa đơn HS001/);
    fireEvent.change(screen.getAllByLabelText("Khoản thu").at(-1)!, { target: { value: "receivable-a" } });
    fireEvent.change(screen.getByLabelText("Số lượng"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Thêm dòng" }));
    await waitFor(() => expect(screen.getAllByText("100").length).toBeGreaterThanOrEqual(2));
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(true);
  });
  it("ignores stale Invoice detail and mutation responses after School changes", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "0" }] };
    let resolveDetail: ((value: Response) => void) | undefined;
    const fetch = vi.fn((url: string) => String(url).includes("/invoices/") ? new Promise<Response>((resolve) => { resolveDetail = resolve; }) : Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    resolveDetail?.(response({ id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [] }));
    await waitFor(() => expect(screen.queryByText(/Rà soát hóa đơn HS001/)).toBeNull());
  });
  it("confirms removal, hides all editing actions for non-DRAFT invoices, and focuses server field errors", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    let readonly = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "DELETE" ? response({ outcome: { ...draft, total: "0", lines: [] } }) : options?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Dữ liệu không hợp lệ.", fieldErrors: { quantity: "Số lượng phải lớn hơn 0." } } }), { status: 400 }) : url.includes("/invoices/") ? response(readonly ? { ...draft, status: "ISSUED" } : draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
    await screen.findByText(/ISSUED chỉ đọc/);
    expect(screen.queryByRole("button", { name: "Thêm dòng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sửa" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xóa" })).toBeNull();
  });
  it("uses only server-returned active accounts, requires the Student name, traps focus, and renders the issued snapshot read-only", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank-active", receivingBank: "Ngân hàng A", accountNumber: "123", accountHolderName: "Ánh Hoa" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? response({ outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank-active", receivingBank: "Ngân hàng A", accountNumber: "123", accountHolderName: "Ánh Hoa" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response({ groups: [], receivables: [{ id: "receivable-a", groupId: "group", code: null, displayName: "Học phí", unitLabel: "tháng", defaultUnitPrice: "100", status: "ACTIVE", available: true }] })));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    const dialog = await screen.findByRole("dialog"); const confirm = screen.getByRole("button", { name: "Xác nhận phát hành" });
    expect(dialog.textContent).toContain("Ngân hàng A / 123 / Ánh Hoa"); expect(dialog.textContent).not.toContain("inactive"); expect(confirm).toHaveProperty("disabled", true);
    expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tài khoản nhận" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } });
    expect(confirm).toHaveProperty("disabled", false);
    fireEvent.keyDown(confirm, { key: "Tab" }); expect(document.activeElement).toBe(screen.getByRole("combobox", { name: "Tài khoản nhận" }));
    fireEvent.click(confirm);
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Thêm dòng" })).toBeNull(); expect(screen.queryByRole("button", { name: "Phát hành hóa đơn" })).toBeNull();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/issue") && (options as RequestInit).method === "POST" && (options as RequestInit).body === JSON.stringify({ bankAccountId: "bank-active" }))).toBe(true);
  });
  it("reconciles uncertain issue outcome and keeps issue validation errors in the server error summary", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank-active", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    let uncertain = true;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? uncertain ? (uncertain = false, new Response(null, { status: 503 })) : new Response(JSON.stringify({ error: { message: "Tài khoản không còn hoạt động." } }), { status: 400 }) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank-active", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" })); await screen.findByRole("dialog"); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
  });
  it("does not open an unusable issue dialog when the server has no active account", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("bank-accounts") ? response({ accounts: [] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    expect(await screen.findByText("Máy chủ không có tài khoản nhận đang hoạt động để phát hành hóa đơn.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the issued success visible when the post-issue Finance refresh fails", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "receivable-a", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...draft, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    let afterIssue = false;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? (afterIssue = true, response({ outcome: issued })) : afterIssue && url.includes("receivables") ? new Response(null, { status: 503 }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(draft) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" })); await screen.findByRole("dialog"); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy();
    expect(await screen.findByText("Hóa đơn đã phát hành; chưa thể tải lại dữ liệu mới nhất.")).toBeTruthy();
  });
});
