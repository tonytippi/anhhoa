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
  it("marks an unsaved template input dirty and sends the current run version", async () => {
    const onStatusChange = vi.fn();
    const templateRun = { ...run, templateLines: [] };
    const catalogWithMeal = { groups: [], receivables: [{ id: "meal", groupId: "group", code: "MEAL", displayName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", status: "ACTIVE", available: true }] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "PUT" ? response({ outcome: { ...templateRun, version: 3, templateLines: [{ id: "line", receivableId: "meal", receivableName: "Tiền ăn", unitLabel: "ngày", defaultUnitPrice: "35000", quantity: "22", amount: "770000" }] } }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [templateRun] }) : response(catalogWithMeal)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} onStatusChange={onStatusChange} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect((await screen.findAllByText("Con cán bộ / Phiên bản 1")).length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("Tên chính sách"), { target: { value: "Hỗ trợ" } });
    fireEvent.click(screen.getByLabelText("Học phí")); fireEvent.click(screen.getByLabelText("Tiền ăn"));
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Cách thực hiện"), { target: { value: "PREPAID_COVERAGE" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/promotion-policies") && (options as RequestInit).method === "POST" && String((options as RequestInit).body).includes('"receivableIds":["r1","r2"]') && String((options as RequestInit).body).includes('"fulfillmentMode":"PREPAID_COVERAGE"'))).toBe(true));
  });
  it("renders server-derived future coverage facts and keeps exact-only receipt messaging", async () => {
    const coverageRun = { ...run, coverageSelections: [{ studentId: run.selectedStudentIds[0], versionId: "coverage-version", billingMonth: "2026-10" }] };
    const preview = { run: coverageRun, fingerprint: "coverage", eligible: [], skips: [], coverageSelections: coverageRun.coverageSelections, futureCoverageFacts: [{ studentId: run.selectedStudentIds[0], billingMonth: "2026-10", policyId: "policy", versionId: "coverage-version", receivableId: "meal", receivableName: "Học phí", originalPrice: "100", reduction: "10", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/preview") ? response(preview) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [coverageRun] }) : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(screen.getByRole("button", { name: "Xem trước từ máy chủ" }));
    expect(await screen.findByText("Fact coverage tương lai từ máy chủ")).toBeTruthy(); expect(screen.getByText("2026-10")).toBeTruthy();
  });
  it("shows exact-only wording for a server-returned coverage Invoice", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "90" }] };
    const invoice = { id: "invoice-a", status: "ISSUED", total: "90", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], coverageFacts: [{ receivableId: "meal", billingMonth: "2026-10", policyId: "policy", versionId: "coverage-version", originalPrice: "100", reduction: "10", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh", issuedAt: null }], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "90", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Ghi thực nhận và đóng hóa đơn" }));
    expect(screen.getByRole("dialog").textContent).toContain("chỉ số tiền đúng bằng nghĩa vụ");
  });
  it("renders source remaining only on the outgoing debt source and inbound provenance only on its target", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "source", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    const invoice = { id: "source", status: "ISSUED", total: "100", sourceOutstanding: "60", sourceDebtTransfers: [{ targetInvoiceId: "target", amount: "40", reason: "Đối soát", postedAt: "2026-09-25T00:00:00.000Z" }], priorDebtTransfers: [], billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText("Công nợ nguồn còn lại do máy chủ xác nhận: 60 VND.")).toBeTruthy(); expect(screen.getByText(/Đã chuyển sang Invoice target/)).toBeTruthy(); expect(screen.queryByText("Công nợ kỳ trước")).toBeNull(); fireEvent.click(screen.getByRole("button", { name: "Ghi thực nhận và đóng hóa đơn" })); expect(screen.getByRole("dialog").textContent).toContain("Công nợ nguồn còn lại do máy chủ xác nhận: 60 VND."); expect(screen.getByLabelText("Số thực nhận (VND)")).toHaveProperty("value", "60");
  });
  it("renders inbound prior-debt provenance read-only without showing source outstanding on a target", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "target", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "140" }] };
    const invoice = { id: "target", status: "DRAFT", total: "140", priorDebtTransfers: [{ sourceInvoiceId: "source", amount: "40", reason: "Đối soát", postedAt: "2026-09-25T00:00:00.000Z" }], billingMonth: "2026-10", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "prior-line", kind: "PRIOR_DEBT", receivableId: null, receivableName: "Công nợ kỳ trước", unitLabel: "khoản", unitPrice: "40", quantity: "1", amount: "40", grossAmount: "40", discountAmount: "0", netAmount: "40", promotionEvaluation: null, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: "Đối soát", sourceRecordedAt: "2026-09-25T00:00:00.000Z", sourceProvenance: { sourceInvoiceId: "source" }, sourceAudit: null }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(invoice) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText(/Invoice nguồn source: 40 VND/)).toBeTruthy(); expect(screen.queryByText(/Công nợ nguồn còn lại do máy chủ xác nhận/)).toBeNull(); expect(screen.getAllByText("Công nợ kỳ trước")[1]?.closest("tr")?.querySelectorAll("button")).toHaveLength(0);
  });
  it("renders only server-projected current assignments and never renders prior School promotion data", async () => {
    const today = new Date().toISOString().slice(0, 10); const day = (offset: number) => new Date(Date.now() + offset * 86400000).toISOString().slice(0, 10);
    const policy = { id: "policy", name: "Ưu đãi Trường A", versions: [{ id: "version", version: 1, status: "ACTIVE", discountType: "PERCENTAGE", discountValue: "10", priority: 1, stackingMode: "STACKABLE", effectiveFrom: today, effectiveTo: null, targets: [], assignments: [{ id: "current", studentId: "s1", studentCode: "HS001", studentName: "Bé An", effectiveFrom: today, effectiveTo: null, isCurrent: true, reason: "A", endReason: null }, { id: "future", studentId: "s2", studentCode: "HS002", studentName: "Bé Bình", effectiveFrom: day(1), effectiveTo: null, isCurrent: false, reason: "B", endReason: null }, { id: "ended", studentId: "s3", studentCode: "HS003", studentName: "Bé Chi", effectiveFrom: day(-2), effectiveTo: day(-1), isCurrent: false, reason: "C", endReason: "Hết" }] }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [policy] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText("1 đang áp dụng")).toBeTruthy(); expect(screen.getByText(/HS001 \/ Bé An:/)).toBeTruthy(); expect(screen.queryByText(/HS002 \/ Bé Bình:/)).toBeNull();
    view.rerender(<FinanceWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} />);
    expect(screen.queryByText("Ưu đãi Trường A / Phiên bản 1")).toBeNull(); expect(screen.queryByText(/HS001 \/ Bé An:/)).toBeNull();
  });
  it("keeps promotion validation in the promotion field-error scope", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST"
        ? new Response(JSON.stringify({ error: { message: "Mức giảm không hợp lệ.", fieldErrors: { discountValue: "Mức giảm phải lớn hơn 0." } } }), { status: 400 })
        : url.includes("promotion-students") ? response({ students: candidates.students }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.change(await screen.findByLabelText("Tên chính sách"), { target: { value: "Hỗ trợ" } });
    fireEvent.change(screen.getByLabelText("Mức giảm"), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu phiên bản ưu đãi" }));
    await screen.findByText("Mức giảm phải lớn hơn 0.", { selector: "#invoice-promotion-discountValue-error" });
    expect(screen.getByLabelText("Mức giảm")).toHaveProperty("id", "invoice-promotion-discountValue-field");
  });
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
  it("renders distinct server-returned promotion line values and assignment reasons without deriving totals", async () => {
    const preview = { run, fingerprint: "server-fingerprint", eligible: [{ studentId: run.selectedStudentIds[0], studentCode: "HS001", fullName: "Bé An", className: "Lá 1", lines: [{ receivableId: "meal", receivableName: "Tiền ăn", grossAmount: "100", discountAmount: "25", netAmount: "75", promotionEvaluation: { applications: [{ assignmentReason: "Con nhân viên", appliedDiscount: "25" }] } }, { receivableId: "tuition", receivableName: "Học phí", grossAmount: "200", discountAmount: "0", netAmount: "200", promotionEvaluation: { applications: [] } }] }], skips: [] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/preview") ? response(preview) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [run] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(screen.getByRole("button", { name: "Xem trước từ máy chủ" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(screen.getByRole("button", { name: "Tạo hóa đơn nháp" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận tạo hóa đơn nháp" }));
    expect(await screen.findByText("RUNNING: đã xử lý 50/1000; đủ điều kiện 50; bỏ qua 0.")).toBeTruthy();
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
  it("requires a close reason, sends the close command, and renders the returned read-only CLOSED run", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const closed = { ...generatedRun, status: "CLOSED" as const };
    let isClosed = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/close") ? (isClosed = true, response({ status: "COMPLETED", outcome: closed })) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [isClosed ? closed : generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
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
    const issuedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const closed = { ...issuedRun, status: "CLOSED" as const };
    let failRefresh = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/close") ? (failRefresh = true, new Response(null, { status: 503 })) : url.includes("/operations/") ? response({ status: "COMPLETED", outcome: closed }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? failRefresh ? new Response(null, { status: 503 }) : response({ runs: [issuedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(screen.getByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(screen.getByRole("button", { name: "Đóng đợt thu" }));
    fireEvent.change(screen.getByLabelText("Nhập chính xác tháng thu 2026-09 để xác nhận"), { target: { value: "2026-09" } });
    fireEvent.change(screen.getByLabelText("Lý do đóng đợt thu"), { target: { value: "Đã rà soát" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận đóng đợt thu" }));
    expect(await screen.findByRole("heading", { name: "Đợt thu đã đóng" })).toBe(document.activeElement);
  });
  it("disables close and explains the server-returned DRAFT invoice block", async () => {
    const draftRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [draftRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    await screen.findByText("Chưa thể đóng: còn hóa đơn nháp cần phát hành.");
    expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", true);
  });
  it("disables close while any ISSUED invoice still requires a receipt", async () => {
    const issuedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [issuedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    expect(screen.getByRole("button", { name: "Đóng đợt thu" })).toHaveProperty("disabled", true);
  });
  it("traps and restores receipt dialog focus, exposes server errors, and clears it after reconciled completion", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    const issued = { id: "invoice-a", status: "ISSUED", total: "100", billingMonth: "2026-09", revisesInvoiceId: "source", revisionReason: "Điều chỉnh", replacementInvoiceId: null, receipt: null, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7 } } };
    const closed = { ...issued, status: "CLOSED", receipt: { actualAmount: "90", outcome: "SHORTFALL", postedAt: "2026-09-20T00:00:00.000Z", difference: { signedAmount: "-10" } } };
    let receiptPosts = 0;
    vi.stubGlobal("fetch", vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "POST" && String(url).endsWith("/receipt") ? (++receiptPosts === 1 ? new Response(JSON.stringify({ error: { message: "Số thực nhận không hợp lệ.", fieldErrors: { actualAmount: "Chỉ dùng số nguyên VND." } } }), { status: 400 }) : new Response(null, { status: 503 })) :
      url.includes("/operations/") ? response({ status: "COMPLETED", outcome: closed }) :
      url.includes("/invoices/") ? response(issued) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog),
    )));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" }));
    fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    const trigger = await screen.findByRole("button", { name: "Ghi thực nhận và đóng hóa đơn" });
    fireEvent.click(trigger);
    const input = screen.getByLabelText("Số thực nhận (VND)");
    expect(document.activeElement).toBe(input);
    fireEvent.keyDown(input, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Hủy" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    const retryInput = screen.getByLabelText("Số thực nhận (VND)");
    fireEvent.change(retryInput, { target: { value: "90" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    expect(await screen.findByText("Chỉ dùng số nguyên VND.", { selector: "#invoice-invoice-actualAmount-error" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByText(/Thu thiếu/)).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("heading", { name: /Rà soát hóa đơn HS001/ });
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
  it("closes the Issue dialog, reloads the current-School Invoice, and shows the server review message", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const draft = { id: "invoice-a", status: "DRAFT", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line-a", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "0", netAmount: "100", promotionEvaluation: { applications: [{ assignmentReason: "Draft cũ", appliedDiscount: "0" }] }, promotionApplicationSnapshot: null, overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const refreshed = { ...draft, lines: [{ ...draft.lines[0], promotionEvaluation: { applications: [{ assignmentReason: "Draft mới từ máy chủ", appliedDiscount: "10" }] } }] };
    let invoiceReads = 0;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue") ? new Response(JSON.stringify({ error: { code: "PROMOTION_REVIEW_REQUIRED", message: "Máy chủ yêu cầu rà soát ưu đãi." } }), { status: 409 }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(++invoiceReads === 1 ? draft : refreshed) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Phát hành hóa đơn" }));
    fireEvent.change(await screen.findByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Máy chủ yêu cầu rà soát ưu đãi.")).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(await screen.findByText("Draft mới từ máy chủ")).toBeTruthy();
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("/invoices/invoice-a")).length).toBeGreaterThanOrEqual(2);
  });
  it("renders issued and cancelled promotion reasons only from application snapshots", async () => {
    const issued = { id: "invoice-a", status: "ISSUED", total: "100", billingMonth: "2026-09", student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", grossAmount: "100", discountAmount: "10", netAmount: "90", promotionEvaluation: { applications: [{ assignmentReason: "Draft provenance", appliedDiscount: "10" }] }, promotionApplicationSnapshot: [{ assignmentReason: "Issued snapshot", appliedDiscount: "10" }], overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }], issue: { obligationTotal: "90", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "90" }] };
    let cancelled = false;
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(cancelled ? { ...issued, status: "CANCELLED", lines: [{ ...issued.lines[0], promotionApplicationSnapshot: [{ assignmentReason: "Cancelled snapshot", appliedDiscount: "10" }] }] } : issued) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("heading", { name: /Rà soát hóa đơn HS001/ });
    expect(await screen.findByText("Issued snapshot")).toBeTruthy(); expect(screen.queryByText("Draft provenance")).toBeNull();
    cancelled = true; fireEvent.click(screen.getByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText("Cancelled snapshot")).toBeTruthy(); expect(screen.queryByText("Draft provenance")).toBeNull();
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
  it("requires a reason and named confirmation before preparing a server-returned revision draft", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "ISSUED", total: "100" }] };
    const issued = { id: "invoice-a", status: "ISSUED", total: "100", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const replacement = { ...issued, id: "replacement", status: "DRAFT", revisesInvoiceId: "invoice-a", revisionReason: "Sai khoản thu", lines: [] };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/revisions") ? response({ outcome: replacement }) : url.includes("/invoices/") ? response(issued) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); fireEvent.click(await screen.findByRole("button", { name: "Chuẩn bị bản điều chỉnh" }));
    const dialog = await screen.findByRole("dialog", { name: "Chuẩn bị bản điều chỉnh cho Bé An" });
    expect(document.activeElement).toBe(screen.getByLabelText("Lý do điều chỉnh"));
    const confirm = screen.getByRole("button", { name: "Xác nhận chuẩn bị bản điều chỉnh" }); expect(confirm).toHaveProperty("disabled", true);
    fireEvent.keyDown(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { key: "Tab" }); expect(document.activeElement).toBe(dialog.querySelector("textarea"));
    fireEvent.change(screen.getByLabelText("Lý do điều chỉnh"), { target: { value: "Sai khoản thu" } }); fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(confirm);
    expect(await screen.findByText(/trạng thái DRAFT/)).toBeTruthy();
    expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/revisions") && (options as RequestInit).body === JSON.stringify({ reason: "Sai khoản thu" }))).toBe(true);
  });
  it("traps revision-dialog focus, restores its trigger, issues the replacement route, and renders a cancelled source readonly", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "replacement", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "DRAFT", total: "100" }] };
    const replacement = { id: "replacement", status: "DRAFT", total: "100", billingMonth: "2026-09", revisesInvoiceId: "source", revisionReason: "Sai", replacementInvoiceId: null, student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [{ id: "line", receivableId: "r", receivableName: "Học phí", unitLabel: "tháng", unitPrice: "100", quantity: "1", amount: "100", overrideReason: null, source: null, sourceReason: null, sourceRecordedAt: null, sourceProvenance: null, sourceAudit: null }] };
    const issued = { ...replacement, status: "ISSUED", issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An La 1", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/issue-revision") ? response({ outcome: issued }) : url.includes("bank-accounts") ? response({ accounts: [{ id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }] }) : url.includes("/invoices/") ? response(replacement) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch); render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("heading", { name: /Rà soát hóa đơn HS001/ }); fireEvent.click(screen.getByRole("button", { name: "Phát hành bản thay thế" })); await screen.findByRole("dialog");
    fireEvent.change(screen.getByLabelText("Nhập chính xác tên học sinh Bé An để xác nhận"), { target: { value: "Bé An" } }); fireEvent.click(screen.getByRole("button", { name: "Xác nhận phát hành" }));
    expect(await screen.findByText("Nội dung chuyển khoản: Be An La 1")).toBeTruthy(); expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/issue-revision"))).toBe(true);
  });
  it("renders pending coverage reversal decisions and reconciles an uncertain School Admin approval", async () => {
    const pendingRequest = { id: "request-a", coverageId: "coverage-a", studentName: "Bé An", amount: "62", effectiveOn: "2026-10-10", reason: "Rút học", canDecide: true };
    let decided = false;
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(
      String(url).includes("/operations/") ? response({ status: "COMPLETED", outcome: { status: "POSTED", id: "reversal-a" } }) :
      options?.method === "POST" && String(url).includes("coverage-reversal-requests/request-a/decision") ? (decided = true, new Response(null, { status: 503 })) :
      String(url).includes("coverage-reversal-requests") ? response({ requests: decided ? [] : [pendingRequest] }) :
      String(url).includes("promotion-students") ? response({ students: [] }) : String(url).includes("promotion-policies") ? response({ policies: [] }) : String(url).includes("collection-run-candidates") ? response(candidates) : String(url).includes("collection-runs") ? response({ runs: [] }) : response(catalog),
    ));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText("Yêu cầu hoàn coverage chờ duyệt")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Duyệt" }));
    const dialog = await screen.findByRole("dialog", { name: "Duyệt hoàn coverage cho Bé An" });
    expect(dialog.textContent).toContain("62 VND");
    fireEvent.change(screen.getByLabelText("Lý do quyết định"), { target: { value: "Đủ điều kiện" } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận duyệt" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("coverage-reversal-requests/request-a/decision"))).toBe(true));
    await waitFor(() => expect(screen.queryByText("Yêu cầu hoàn coverage chờ duyệt")).toBeNull());
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/operations/"))).toBe(true);
  });
  it("uses the server direct preview student name for named confirmation before posting a reversal", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "90" }] };
    const invoice = { id: "invoice-a", status: "CLOSED", total: "90", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: { actualAmount: "90", outcome: "EXACT", postedAt: "2026-09-20T00:00:00.000Z", difference: null }, carries: [], coverageFacts: [{ coverageId: "coverage-a", receivableId: "meal", billingMonth: "2026-10", policyId: "policy", versionId: "version", originalPrice: "100", reduction: "10", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh", issuedAt: "2026-09-20T00:00:00.000Z" }], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "90", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    const preview = { coverageId: "coverage-a", effectiveOn: "2026-10-10", denominator: 26, remainingDays: 18, calculatedAmount: "62", availableAmount: "90", source: { studentName: "Bé An", reversalMode: "DIRECT", invoiceId: "invoice-a", receiptId: "receipt-a", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh" } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/coverage-reversals/preview") ? response(preview) : options?.method === "POST" && String(url).endsWith("/coverage-reversals") ? response({ outcome: { status: "POSTED", id: "reversal-a", amount: "62" } }) : url.includes("/invoices/") ? response(invoice) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("heading", { name: /Rà soát hóa đơn HS001/ });
    fireEvent.change(screen.getByLabelText("Coverage fact"), { target: { value: "coverage-a" } }); fireEvent.change(screen.getByLabelText("Ngày hiệu lực"), { target: { value: "2026-10-10" } }); fireEvent.click(screen.getByRole("button", { name: "Xem preview hoàn từ máy chủ" }));
    const confirm = await screen.findByRole("button", { name: "Xác nhận hoàn/reverse coverage" }); expect(confirm).toHaveProperty("disabled", true);
    expect(screen.getByText("Direct cần xác nhận tên học sinh.")).toBeTruthy(); fireEvent.change(screen.getAllByLabelText("Lý do").at(-1)!, { target: { value: "Rút học" } }); fireEvent.change(screen.getByLabelText("Nhập tên học sinh Bé An để xác nhận direct"), { target: { value: "Bé An" } }); expect(confirm).toHaveProperty("disabled", false); fireEvent.click(confirm);
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/coverage-reversals") && (options as RequestInit).body === JSON.stringify({ coverageId: "coverage-a", effectiveOn: "2026-10-10", reason: "Rút học", amount: null, confirmation: "Bé An" }))).toBe(true));
  });
  it("does not expose pending approval controls to the requesting actor", async () => {
    const request = { id: "request-a", coverageId: "coverage-a", studentName: "Bé An", amount: "62", effectiveOn: "2026-10-10", reason: "Rút học", canDecide: false };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("coverage-reversal-requests") ? response({ requests: [request] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    expect(await screen.findByText("Không có quyền quyết định")).toBeTruthy(); expect(screen.queryByRole("button", { name: "Duyệt" })).toBeNull(); expect(screen.queryByRole("button", { name: "Từ chối" })).toBeNull();
  });
  it("renders a closed replacement as settled through immutable transferred source receipt", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "replacement", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "100" }] };
    const replacement = { id: "replacement", status: "CLOSED", total: "100", billingMonth: "2026-09", revisesInvoiceId: "source", revisionReason: "Sửa", replacementInvoiceId: null, receipt: null, settlementTransfer: { sourceInvoiceId: "source", sourceReceiptId: "receipt-source", amount: "100", postedAt: "2026-09-20T00:00:00.000Z" }, carries: [], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "100", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "DIRECT" } } };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/invoices/") ? response(replacement) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" }));
    expect(await screen.findByText(/Đã settled qua Receipt nguồn chuyển tiếp: 100 VND/)).toBeTruthy(); expect(screen.getByText(/Invoice nguồn source, Receipt nguồn receipt-source/)).toBeTruthy(); expect(screen.queryByText("Chưa có trạng thái thanh toán trong phạm vi này.")).toBeNull();
  });
  it("submits School Admin approval request without direct named confirmation", async () => {
    const generatedRun = { ...run, status: "GENERATED" as const, invoices: [{ id: "invoice-a", studentId: run.selectedStudentIds[0], studentCode: "HS001", studentName: "Bé An", className: "Lá 1", status: "CLOSED", total: "90" }] };
    const invoice = { id: "invoice-a", status: "CLOSED", total: "90", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: { actualAmount: "90", outcome: "EXACT", postedAt: "2026-09-20T00:00:00.000Z", difference: null }, carries: [], coverageFacts: [{ coverageId: "coverage-a", receivableId: "meal", billingMonth: "2026-10", policyId: "policy", versionId: "version", originalPrice: "100", reduction: "10", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh", issuedAt: "2026-09-20T00:00:00.000Z" }], student: { code: "HS001", name: "Bé An", className: "Lá 1" }, lines: [], issue: { obligationTotal: "90", dueOn: "2026-09-28", bankAccount: { id: "bank", receivingBank: "A", accountNumber: "1", accountHolderName: "H" }, transferContent: "Be An", policy: { effectiveFrom: "2026-01-01", dueDaysAfterIssue: 7, taxTreatment: "NOT_APPLICABLE", debtScope: "CURRENT_SCHOOL_YEAR_ONLY", reversalMode: "SCHOOL_ADMIN_APPROVAL" } } };
    const preview = { coverageId: "coverage-a", effectiveOn: "2026-10-10", denominator: 26, remainingDays: 18, calculatedAmount: "62", availableAmount: "90", source: { studentName: "Bé An", reversalMode: "SCHOOL_ADMIN_APPROVAL", invoiceId: "invoice-a", receiptId: "receipt-a", serviceStart: "2026-10-01", serviceEnd: "2026-11-01", calendarEffectiveFrom: "2026-01-01", timezone: "Asia/Ho_Chi_Minh" } };
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" && String(url).endsWith("/coverage-reversals/preview") ? response(preview) : options?.method === "POST" && String(url).endsWith("/coverage-reversals") ? response({ outcome: { status: "PENDING", id: "request-a", amount: "62" } }) : url.includes("/invoices/") ? response(invoice) : url.includes("coverage-reversal-requests") ? response({ requests: [] }) : url.includes("promotion-students") ? response({ students: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-run-candidates") ? response(candidates) : url.includes("collection-runs") ? response({ runs: [generatedRun] }) : response(catalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở chi tiết" })); fireEvent.click(await screen.findByRole("button", { name: "Rà soát hóa đơn" })); await screen.findByRole("heading", { name: /Rà soát hóa đơn HS001/ }); fireEvent.change(screen.getByLabelText("Coverage fact"), { target: { value: "coverage-a" } }); fireEvent.change(screen.getByLabelText("Ngày hiệu lực"), { target: { value: "2026-10-10" } }); fireEvent.click(screen.getByRole("button", { name: "Xem preview hoàn từ máy chủ" }));
    const submit = await screen.findByRole("button", { name: "Gửi yêu cầu duyệt hoàn coverage" }); expect(screen.getByText("Workflow này sẽ gửi yêu cầu chờ School Admin khác duyệt.")).toBeTruthy(); expect(screen.queryByLabelText("Nhập tên học sinh Bé An để xác nhận direct")).toBeNull(); fireEvent.change(screen.getAllByLabelText("Lý do").at(-1)!, { target: { value: "Rút học" } }); expect(submit).toHaveProperty("disabled", false); fireEvent.click(submit);
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/coverage-reversals") && (options as RequestInit).body === JSON.stringify({ coverageId: "coverage-a", effectiveOn: "2026-10-10", reason: "Rút học", amount: null, confirmation: "" }))).toBe(true));
    expect(await screen.findByText("Yêu cầu hoàn coverage đã được gửi chờ School Admin duyệt.")).toBeTruthy();
  });
});
