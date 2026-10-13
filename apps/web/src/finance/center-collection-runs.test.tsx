import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FinanceWorkspace, type FinanceSchoolFeatures } from "./finance-workspace";

// Sprint change 2026-10-12: a School whose collectionRunScope is CLASS bills each Class by a period Finance enters.
const centerFeatures: FinanceSchoolFeatures = { usesSchoolYears: false, collectionRunScope: "CLASS" };
const catalog = {
  groups: [],
  receivables: [{ id: "tuition", groupId: "group", kind: "FLEXIBLE", code: "TUITION", displayName: "Học phí unit", unitLabel: "unit", defaultUnitPrice: "3600000", status: "ACTIVE", available: true }],
  schoolYears: [{ id: "year-open", name: "Sao Mai", startsOn: "2026-01-01", endsOn: null, closedAt: null }],
};
const classRun = (patch: object = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  schoolYearId: "year-open",
  billingMonth: "2026-11",
  scope: "CLASS",
  classId: "class-movers",
  className: "Movers B",
  name: "Unit 6",
  periodStartsOn: "2026-11-09",
  periodEndsOn: "2027-01-02",
  status: "DRAFT",
  version: 1,
  templateLines: [],
  invoices: [],
  notices: [],
  ...patch,
});
const startersRun = classRun({ id: "33333333-3333-4333-8333-333333333333", billingMonth: "2026-09", classId: "class-starters", className: "Starters A", name: "Unit 3", periodStartsOn: "2026-09-28", periodEndsOn: "2026-11-21", status: "GENERATED" });
const runClasses = {
  classes: [
    { id: "class-flyers", name: "Flyers C", latestRun: null },
    { id: "class-movers", name: "Movers B", latestRun: { id: "11111111-1111-4111-8111-111111111111", name: "Unit 6", periodStartsOn: "2026-11-09", periodEndsOn: "2027-01-02" } },
    { id: "class-starters", name: "Starters A", latestRun: { id: "33333333-3333-4333-8333-333333333333", name: "Unit 3", periodStartsOn: "2026-09-28", periodEndsOn: "2026-11-21" } },
  ],
};
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const typeDate = (dialog: HTMLElement, label: string, value: string) =>
  fireEvent.change(within(dialog).getByText(label, { selector: "label" }).querySelector("input")!, { target: { value } });
const listFetch = (post: (body: any) => Response, classes: () => Response = () => response(runClasses)) =>
  vi.fn((url: string, options?: RequestInit) =>
    Promise.resolve(
      options?.method === "POST"
        ? post(JSON.parse(String(options.body)))
        : url.endsWith("/finance/collection-run-classes")
          ? classes()
          : url.includes("promotion-policies")
            ? response({ policies: [] })
            : url.includes("collection-runs")
              ? response({ runs: [classRun(), startersRun], meta: { nextCursor: null } })
              : response(catalog),
    ),
  );

afterEach(() => {
  cleanup();
  document.querySelectorAll("[data-base-ui-portal]").forEach((portal) => portal.remove());
  vi.unstubAllGlobals();
  sessionStorage.clear();
});

describe("FinanceWorkspace · collection runs of a class-scoped School", () => {
  it("lists runs by Class, name and period without any school-year column or selector", async () => {
    vi.stubGlobal("fetch", listFetch(() => response({})));
    render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" denied={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Danh sách đợt thu của Anh ngữ Sao Mai" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Lớp", "Tên đợt", "Kỳ", "Trạng thái", "Tùy chọn"]);
    const row = (await within(table).findByText("Movers B")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 4).map((cell) => cell.textContent)).toEqual(["Movers B", "Unit 6", "09/11/2026 – 02/01/2027", "Nháp"]);
    expect(within(table).getByText("Starters A").closest("tr")!.textContent).toContain("28/09/2026 – 21/11/2026");
    expect(screen.getByRole("button", { name: "Tùy chọn cho đợt thu Movers B · Unit 6" })).toBeTruthy();
    expect(screen.queryByRole("table", { name: "Đợt thu theo trường" })).toBeNull();
    expect(screen.queryByText("Năm học")).toBeNull();
    expect(screen.queryByRole("button", { name: "Tạo đợt thu" })).toBeNull();
  });

  it("opens a run from Class, name and dates, keeps the overlap refusal beside the dates, then opens the created run", async () => {
    const onOpenRun = vi.fn();
    let refuse = true;
    const fetch = listFetch(() =>
      refuse
        ? new Response(JSON.stringify({ error: { code: "COLLECTION_RUN_PERIOD_OVERLAP", message: "Kỳ này trùng với đợt Unit 3 (28/09/2026 – 21/11/2026) của lớp Starters A.", fieldErrors: { periodStartsOn: "Kỳ này trùng với đợt Unit 3 (28/09/2026 – 21/11/2026) của lớp Starters A." } } }), { status: 409 })
        : response({ status: "COMPLETED", outcome: classRun({ id: "44444444-4444-4444-8444-444444444444", classId: "class-starters", className: "Starters A", name: "Unit 4" }) }),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" onOpenRun={onOpenRun} denied={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở đợt thu" }));
    const dialog = screen.getByRole("dialog", { name: "Mở đợt thu" });
    expect(within(dialog).queryByText("Năm học")).toBeNull();
    expect(within(dialog).queryByText("Tháng thu")).toBeNull();
    const classSelect = within(dialog).getByLabelText("Lớp") as HTMLSelectElement;
    await waitFor(() => expect([...classSelect.options].map((option) => option.textContent)).toEqual(["Chọn lớp đang hoạt động", "Flyers C", "Movers B", "Starters A"]));
    expect(within(dialog).queryByText(/sao chép|tự thêm/)).toBeNull();
    fireEvent.change(classSelect, { target: { value: "class-flyers" } });
    expect(within(dialog).getByText("Khoản thu cố định áp dụng cho lớp được tự thêm; khoản thu khác thêm sau khi mở.")).toBeTruthy();
    fireEvent.change(classSelect, { target: { value: "class-starters" } });
    expect(within(dialog).getByText("Khoản thu cố định áp dụng cho lớp được tự thêm; khoản thu linh hoạt được sao chép từ đợt Unit 3 của lớp Starters A. Sửa được khi đợt còn Nháp.")).toBeTruthy();
    expect(within(dialog).queryByText(/Đợt đầu tiên/)).toBeNull();
    fireEvent.change(within(dialog).getByLabelText("Tên đợt"), { target: { value: "Unit 4" } });
    typeDate(dialog, "Từ ngày", "16/11/2026");
    typeDate(dialog, "Đến ngày", "09/01/2027");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận mở đợt thu" }));
    expect(await within(dialog).findByText("Kỳ này trùng với đợt Unit 3 (28/09/2026 – 21/11/2026) của lớp Starters A.", { selector: "#invoice-run-periodStartsOn-error" })).toBeTruthy();
    expect(document.getElementById("invoice-run-periodStartsOn-field")?.getAttribute("aria-invalid")).toBe("true");
    const posts = () => fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "POST");
    expect(posts()).toHaveLength(1);
    expect(String(posts()[0]![0])).toMatch(/\/finance\/collection-runs$/);
    expect(JSON.parse(String((posts()[0]![1] as RequestInit).body))).toEqual({ classId: "class-starters", name: "Unit 4", periodStartsOn: "2026-11-16", periodEndsOn: "2027-01-09" });
    expect(onOpenRun).not.toHaveBeenCalled();
    refuse = false;
    typeDate(dialog, "Từ ngày", "23/11/2026");
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận mở đợt thu" }));
    await waitFor(() => expect(onOpenRun).toHaveBeenCalledWith("44444444-4444-4444-8444-444444444444"));
    expect(JSON.parse(String((posts()[1]![1] as RequestInit).body)).periodStartsOn).toBe("2026-11-23");
    expect(screen.queryByRole("dialog", { name: "Mở đợt thu" })).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/roster/"))).toBe(false);
  });

  it("reports a class list that fails to load inside the dialog", async () => {
    const denied = vi.fn();
    vi.stubGlobal("fetch", listFetch(() => response({}), () => new Response(null, { status: 500 })));
    render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" denied={denied} />);
    fireEvent.click(await screen.findByRole("button", { name: "Mở đợt thu" }));
    expect(await within(screen.getByRole("dialog", { name: "Mở đợt thu" })).findByText("Không thể tải danh sách lớp đang hoạt động.")).toBeTruthy();
    expect(denied).not.toHaveBeenCalled();
  });

  it("shows a DRAFT class run by Class, name and period with services and only whole-class or named-Student lines", async () => {
    const run = classRun({ templateLines: [{ id: "line-a", receivableId: "tuition", receivableName: "Học phí unit", unitLabel: "unit", defaultUnitPrice: "3600000", quantity: "1", amount: "3600000", kind: "FLEXIBLE", scope: { type: "ALL", label: "Toàn bộ", classes: [], students: [] } }] });
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("/scope-options")
          ? response({ classes: [{ id: "class-movers", name: "Movers B" }], students: [{ id: "student-a", studentCode: "SM-031", fullName: "Nguyễn Gia Huy", className: "Movers B" }] })
          : url.includes("/extracurricular-classes")
            ? response({ billingMonth: "2026-11", classes: [{ id: "bus", name: "Đưa đón", receivableId: "bus-fee", receivableName: "Đưa đón", unitLabel: "unit", defaultUnitPrice: "800000", memberCount: 4, transferredCount: 0, excluded: false, receivableActive: true }] })
            : url.includes("promotion-policies")
              ? response({ policies: [] })
              : url.includes("collection-runs")
                ? response(run)
                : response(catalog),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" runId={run.id} onOpenRun={vi.fn()} onBackToRuns={vi.fn()} denied={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Movers B · Unit 6 · Nháp" })).toBeTruthy();
    expect(screen.getByText("Đợt thu · Lớp Movers B · Kỳ 09/11/2026 – 02/01/2027")).toBeTruthy();
    expect(screen.queryByText(/Năm học/)).toBeNull();
    expect(screen.queryByText(/Khoản cố định được tự thêm/)).toBeNull();
    expect(within(screen.getByRole("table", { name: "Khoản thu mẫu của đợt" })).getByText("Cả lớp")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Dịch vụ trong đợt" })).toBeTruthy();
    const services = await screen.findByRole("table", { name: "Dịch vụ tính vào đợt thu Movers B · Unit 6" });
    expect(within(services).getAllByRole("columnheader").map((cell) => cell.textContent).slice(0, 3)).toEqual(["Dịch vụ", "Khoản thu", "Số HS trong kỳ"]);
    expect(await within(services).findByText("Chỉ tính học sinh của lớp Movers B")).toBeTruthy();
    expect(screen.queryByText(/Lớp ngoại khóa/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm khoản thu" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm khoản thu" });
    expect(within(dialog).getAllByRole("radio").map((radio) => radio.closest("label")!.textContent)).toEqual(["Cả lớp", "Học sinh cụ thể"]);
    fireEvent.click(within(dialog).getByRole("radio", { name: "Học sinh cụ thể" }));
    expect(await within(dialog).findByRole("table", { name: "Học sinh · Movers B" })).toBeTruthy();
    expect(within(dialog).queryByText("Lớp chính thức")).toBeNull();
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/scope-options?officialClassId=class-movers"))).toBe(true));
  });

  it("names the earlier run to close, keeps Thêm học sinh, shows Trùng kỳ and has no settlement or prepaid-coverage UI", async () => {
    const run = { ...startersRun, previousOpenRun: { id: "run-unit-2", billingMonth: "2026-08", name: "Unit 2", periodStartsOn: "2026-08-03", periodEndsOn: "2026-09-26" }, invoices: [{ id: "invoice-a", studentId: "student-a", studentCode: "SM-047", studentName: "Vũ Khánh An", className: "Starters A", status: "DRAFT", total: "3600000", periodOverlap: true }, { id: "invoice-b", studentId: "student-b", studentCode: "SM-012", studentName: "Phạm Ngọc Hân", className: "Starters A", status: "DRAFT", total: "3600000", periodOverlap: false }], notices: [{ invoiceId: "invoice-b", studentId: "student-b", studentCode: "SM-012", studentName: "Phạm Ngọc Hân", className: "Starters A", kind: "NORMAL", status: "DRAFT", settledParts: 0, partCount: 1, total: "3600000", parts: [{ id: "invoice-b", channel: "PERSONAL", status: "DRAFT", total: "3600000", account: null }] }, { invoiceId: "invoice-a", studentId: "student-a", studentCode: "SM-047", studentName: "Vũ Khánh An", className: "Starters A", kind: "NORMAL", status: "DRAFT", settledParts: 0, partCount: 1, total: "3600000", parts: [{ id: "invoice-a", channel: "PERSONAL", status: "DRAFT", total: "3600000", account: null }] }] };
    const invoice = { id: "invoice-a", collectionRunId: run.id, status: "DRAFT", total: "3600000", billingMonth: "2026-09", revisesInvoiceId: null, revisionReason: null, replacementInvoiceId: null, receipt: null, carries: [], student: { code: "SM-047", name: "Vũ Khánh An", className: "Starters A" }, lines: [{ id: "line-a", receivableId: "tuition", receivableName: "Học phí unit", unitLabel: "unit", unitPrice: "3600000", quantity: "1", amount: "3600000", grossAmount: "3600000", discountAmount: "0", netAmount: "3600000", overrideReason: null, sourceBadge: { kind: "TEMPLATE_FLEXIBLE", label: "Linh hoạt · Toàn bộ", flags: [{ code: "PERIOD_OVERLAP", label: "Trùng kỳ" }], detail: "đã có trên hóa đơn của đợt thu Starters B · Unit 3" } }] };
    const onOpenRun = vi.fn();
    const fetch = vi.fn((url: string) =>
      Promise.resolve(
        url.includes("/invoices/")
          ? response(invoice)
          : url.includes("/prior-debts")
            ? response({ total: "3600000", debts: [{ sourceInvoiceId: "invoice-old", student: { id: "student-a", code: "SM-047", name: "Vũ Khánh An" }, className: "Starters B", billingMonth: "2026-06", periodLabel: "Starters B · Unit 1", channel: "PERSONAL", account: null, outstanding: "3600000", obligationCode: null }] })
            : url.includes("/addable-students")
              ? response({ students: [{ id: "student-b", studentCode: "SM-058", fullName: "Hoàng Tuệ Lâm" }], meta: { nextCursor: null } })
              : url.includes("promotion-policies")
                ? response({ policies: [] })
                : url.includes("collection-runs")
                  ? response(run)
                  : response(catalog),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const view = render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" runId={run.id} onOpenRun={onOpenRun} onBackToRuns={vi.fn()} onOpenInvoice={vi.fn()} denied={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Starters A · Unit 3 · Đã tạo hóa đơn" })).toBeTruthy();
    const notice = screen.getByText(/Chưa thể phát hành hóa đơn của đợt này/);
    expect(notice.textContent).toContain("cần đóng đợt Unit 2 (03/08/2026 – 26/09/2026) của lớp Starters A trước.");
    const invoices = screen.getByRole("table", { name: "Hóa đơn hiện có trong đợt thu" });
    expect(within(within(invoices).getByText(/SM-047/).closest("tr")!).getByText("Trùng kỳ").className).toContain("warning");
    expect(within(within(invoices).getByText(/SM-012/).closest("tr")!).queryByText("Trùng kỳ")).toBeNull();
    const debts = await screen.findByRole("table", { name: "Công nợ kỳ trước chưa thu" });
    expect(within(debts).getAllByRole("columnheader")[2]!.textContent).toBe("Kỳ");
    expect(within(debts).getByText("Starters B · Unit 1")).toBeTruthy();
    expect(within(debts).queryByText("06/2026")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mở đợt thu Unit 2" }));
    expect(onOpenRun).toHaveBeenCalledWith("run-unit-2");
    expect(screen.getByRole("button", { name: "Thêm học sinh" })).toBeTruthy();
    expect(screen.queryByText("Cần quyết toán")).toBeNull();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/settlements"))).toBe(false);
    view.rerender(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" runId={run.id} invoiceId="invoice-a" onOpenRun={onOpenRun} onBackToRuns={vi.fn()} onOpenInvoice={vi.fn()} denied={vi.fn()} />);
    const line = (await screen.findByText("Học phí unit")).closest("tr")!;
    expect(within(line).getByText("Trùng kỳ").className).toContain("warning");
    expect(line.textContent).toContain("đã có trên hóa đơn của đợt thu Starters B · Unit 3");
    expect(screen.getByText(/Đợt thu Starters A · Unit 3 ·/)).toBeTruthy();
    expect(screen.queryByText("Quản lý ưu đãi nộp trước")).toBeNull();
  });

  it("keeps the Trùng kỳ row badge on the locked table of a CLOSED run", async () => {
    const part = (id: string, studentId: string, code: string, name: string, periodOverlap: boolean) => ({ id, studentId, studentCode: code, studentName: name, className: "Starters A", status: "CLOSED", total: "3600000", periodOverlap });
    const notice = (id: string, studentId: string, code: string, name: string) => ({ invoiceId: id, studentId, studentCode: code, studentName: name, className: "Starters A", kind: "NORMAL", status: "COMPLETED", settledParts: 1, partCount: 1, total: "3600000", parts: [{ id, channel: "PERSONAL", status: "CLOSED", total: "3600000", account: null }] });
    const run = { ...startersRun, status: "CLOSED", invoices: [part("invoice-a", "student-a", "SM-047", "Vũ Khánh An", true), part("invoice-b", "student-b", "SM-012", "Phạm Ngọc Hân", false)], notices: [notice("invoice-a", "student-a", "SM-047", "Vũ Khánh An"), notice("invoice-b", "student-b", "SM-012", "Phạm Ngọc Hân")] };
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-runs") ? response(run) : response(catalog))));
    render(<FinanceWorkspace schoolId="school-c" schoolName="Anh ngữ Sao Mai" features={centerFeatures} page="collection-runs" runId={run.id} onOpenRun={vi.fn()} onBackToRuns={vi.fn()} denied={vi.fn()} />);
    const locked = await screen.findByRole("table", { name: "Hóa đơn đã khóa theo đợt thu" });
    expect(within(within(locked).getByText(/SM-047/).closest("tr")!).getByText("Trùng kỳ").className).toContain("warning");
    expect(within(within(locked).getByText(/SM-012/).closest("tr")!).queryByText("Trùng kỳ")).toBeNull();
  });
});

describe("FinanceWorkspace · collection runs of a School-scoped School stay as before", () => {
  const monthRun = { id: "11111111-1111-4111-8111-111111111111", schoolYearId: "year-a", billingMonth: "2026-09", scope: "SCHOOL", classId: null, className: null, name: "Tháng 09/2026", periodStartsOn: "2026-09-01", periodEndsOn: "2026-09-30", status: "DRAFT", version: 2, templateLines: [], invoices: [], notices: [] };
  const monthCatalog = { groups: [], receivables: [], schoolYears: [{ id: "year-a", name: "Năm học 2026-2027", startsOn: "2026-09-01", endsOn: "2027-06-01", closedAt: null }] };

  it("keeps the month list, the year and month dialog and the monthly request body", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => Promise.resolve(options?.method === "POST" ? response({ status: "COMPLETED", outcome: monthRun }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-runs") ? response({ runs: [monthRun], meta: { nextCursor: null } }) : response(monthCatalog)));
    vi.stubGlobal("fetch", fetch);
    const onOpenRun = vi.fn();
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="collection-runs" onOpenRun={onOpenRun} denied={vi.fn()} />);
    const table = await screen.findByRole("table", { name: "Đợt thu theo trường" });
    expect(within(table).getAllByRole("columnheader").map((cell) => cell.textContent)).toEqual(["Tháng", "Năm học", "Trạng thái", "Tùy chọn"]);
    const row = (await within(table).findByText("09/2026")).closest("tr")!;
    expect(within(row).getAllByRole("cell").slice(0, 3).map((cell) => cell.textContent)).toEqual(["09/2026", "Năm học 2026-2027", "Nháp"]);
    expect(screen.getByRole("button", { name: "Tùy chọn cho đợt thu 2026-09" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Mở đợt thu" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Tạo đợt thu" }));
    const dialog = screen.getByRole("dialog", { name: "Tạo hoặc mở đợt thu" });
    expect(within(dialog).queryByLabelText("Lớp")).toBeNull();
    expect(within(dialog).queryByLabelText("Tên đợt")).toBeNull();
    await waitFor(() => expect((within(dialog).getByLabelText("Năm học") as HTMLSelectElement).value).toBe("year-a"));
    fireEvent.change(within(dialog).getByLabelText("Tháng thu"), { target: { value: "2026-10" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận tạo hoặc mở" }));
    await waitFor(() => expect(onOpenRun).toHaveBeenCalledWith(monthRun.id));
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ schoolYearId: "year-a", billingMonth: "2026-10" });
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/roster/"))).toBe(false);
  });

  it("keeps the monthly run detail, its three line scopes, the extracurricular block and the settlement lookup", async () => {
    const draft = vi.fn((url: string) => Promise.resolve(url.includes("/scope-options") ? response({ classes: [{ id: "class-a", name: "Lá 1" }], students: [] }) : url.includes("/extracurricular-classes") ? response({ billingMonth: "2026-09", classes: [] }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-runs") ? response(monthRun) : response(monthCatalog)));
    vi.stubGlobal("fetch", draft);
    const view = render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="collection-runs" runId={monthRun.id} onOpenRun={vi.fn()} onBackToRuns={vi.fn()} denied={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Đợt thu tháng 09/2026 · Nháp" })).toBeTruthy();
    expect(screen.getByText(/Đợt thu · Năm học 2026-2027/)).toBeTruthy();
    expect(screen.getByText(/Khoản cố định được tự thêm khi mở đợt thu/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Lớp ngoại khóa trong đợt" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Lớp ngoại khóa tính vào đợt thu tháng 09/2026" })).toBeTruthy();
    expect(screen.queryByText(/Dịch vụ/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Thêm khoản thu" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm khoản thu" });
    expect(within(dialog).getAllByRole("radio").map((radio) => radio.closest("label")!.textContent)).toEqual(["Toàn bộ", "Lớp chính thức", "Học sinh cụ thể"]);
    await waitFor(() => expect(draft.mock.calls.some(([url]) => String(url).endsWith("/scope-options"))).toBe(true));
    view.unmount();
    const generated = { ...monthRun, status: "GENERATED", previousOpenRun: { id: "run-08", billingMonth: "2026-08", name: "Tháng 08/2026" } };
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes("/settlements") ? response({ students: [] }) : url.includes("/prior-debts") ? response({ total: "100", debts: [{ sourceInvoiceId: "invoice-old", student: { id: "student-a", code: "HS001", name: "Bé An" }, className: "Lá 1", billingMonth: "2026-08", periodLabel: "Tháng 08/2026", channel: "PERSONAL", account: null, outstanding: "100", obligationCode: null }] }) : url.includes("/addable-students") ? response({ students: [], meta: { nextCursor: null } }) : url.includes("promotion-policies") ? response({ policies: [] }) : url.includes("collection-runs") ? response(generated) : response(monthCatalog)));
    vi.stubGlobal("fetch", fetch);
    render(<FinanceWorkspace schoolId="school-a" schoolName="Trường A" page="collection-runs" runId={monthRun.id} onOpenRun={vi.fn()} onBackToRuns={vi.fn()} denied={vi.fn()} />);
    expect(await screen.findByRole("heading", { name: "Đợt thu tháng 09/2026 · Đã tạo hóa đơn" })).toBeTruthy();
    expect(screen.getByText(/Đợt thu tháng 08\/2026 chưa đóng\. Cần đóng đợt đó trước\s+khi phát hành hóa đơn đợt này\./)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Mở đợt thu 08/2026" })).toBeTruthy();
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("/settlements"))).toBe(true));
    const debts = await screen.findByRole("table", { name: "Công nợ kỳ trước chưa thu" });
    expect(within(debts).getAllByRole("columnheader")[2]!.textContent).toBe("Tháng");
    expect(within(debts).getByText("08/2026")).toBeTruthy();
    expect(within(debts).queryByText("Tháng 08/2026")).toBeNull();
    expect(screen.queryByText("Trùng kỳ")).toBeNull();
  });
});
