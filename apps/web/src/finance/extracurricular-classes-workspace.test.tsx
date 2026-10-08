import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExtracurricularClassesWorkspace } from "./extracurricular-classes-workspace";

const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const klass = (overrides = {}) => ({ id: "class-a1", schoolYearId: "year", name: "Tiếng Anh A1 (T2-T4)", receivableId: "english", separateAttendance: false, status: "ACTIVE", receivableName: "Tiếng Anh bản ngữ", unitLabel: "tháng", defaultUnitPrice: "600000", sharedWith: ["Tiếng Anh A2 (T3-T5)"], currentMembers: 18, ...overrides });
const list = { schoolYears: [{ id: "year", name: "2026-2027", startsOn: "2026-08-01", endsOn: "2027-08-01", closedAt: null }], classes: [klass(), klass({ id: "class-a2", name: "Tiếng Anh A2 (T3-T5)", sharedWith: ["Tiếng Anh A1 (T2-T4)"], currentMembers: 15 }), klass({ id: "draw", name: "Vẽ thiếu nhi", receivableId: "drawing", receivableName: "Năng khiếu vẽ", defaultUnitPrice: "400000", sharedWith: [], currentMembers: 12, status: "INACTIVE" })], receivables: [{ id: "english", displayName: "Tiếng Anh bản ngữ", unitLabel: "tháng", defaultUnitPrice: "600000", status: "ACTIVE", sharedWith: ["Tiếng Anh A1 (T2-T4)", "Tiếng Anh A2 (T3-T5)"] }, { id: "drawing", displayName: "Năng khiếu vẽ", unitLabel: "tháng", defaultUnitPrice: "400000", status: "ACTIVE", sharedWith: [] }, { id: "old", displayName: "Võ cũ", unitLabel: "tháng", defaultUnitPrice: "1", status: "INACTIVE", sharedWith: [] }] };
const member = (overrides = {}) => ({ id: "m1", enrollmentId: "e1", studentCode: "AH-121", fullName: "Bé Tuấn Huy", officialClassId: "c1", officialClassName: "Chồi 3B", effectiveFrom: "2026-09-01", effectiveTo: null, open: true, state: "ACTIVE", flags: [], transferNote: null, ...overrides });
const detail = (overrides = {}) => ({ class: { ...klass(), schoolYearName: "2026-2027" }, month: { month: "2026-10", current: 2, counted: 4, midMonth: 2 }, officialClasses: [{ id: "c1", name: "Chồi 3B" }], total: 4, members: [member(), member({ id: "m2", enrollmentId: "e2", studentCode: "AH-104", fullName: "Bé Minh Anh", effectiveTo: "2026-10-15", open: false, flags: ["LEFT_IN_MONTH"], transferNote: "Chuyển sang Tiếng Anh A2 (T3-T5) từ 16/10/2026" }), member({ id: "m3", enrollmentId: "e3", studentCode: "AH-133", fullName: "Bé An Nhiên", effectiveFrom: "2026-10-14", flags: ["JOINED_IN_MONTH"] }), member({ id: "m4", enrollmentId: "e4", studentCode: "AH-090", fullName: "Bé Khôi Nguyên", effectiveTo: "2026-09-30", open: false, state: "ENDED" })], ...overrides });
const candidates = { officialClasses: [{ id: "c1", name: "Chồi 3B" }], candidates: [{ enrollmentId: "e10", studentCode: "AH-140", fullName: "Bé Bảo Châu", officialClassName: "Chồi 3B", member: false }, { enrollmentId: "e11", studentCode: "AH-056", fullName: "Bé Gia Hân", officialClassName: "Chồi 3B", member: true }] };

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); sessionStorage.clear(); });
const props = (search = "", extra = {}) => ({ schoolId: "school-a", schoolName: "Trường Ánh Hoa", search, onSearchChange: vi.fn(), denied: vi.fn(), ...extra });
const route = (handlers: Record<string, (url: string, options?: RequestInit) => unknown>) => vi.fn((url: string, options?: RequestInit) => {
  const key = Object.keys(handlers).find((item) => String(url).includes(item));
  return Promise.resolve(key ? handlers[key]!(String(url), options) : response({}));
});

describe("ExtracurricularClassesWorkspace", () => {
  it("lists classes with shared receivable, current members and status, and filters through the server", async () => {
    const fetch = route({ "extracurricular-classes": () => response(list) });
    vi.stubGlobal("fetch", fetch);
    const properties = props();
    render(<ExtracurricularClassesWorkspace {...properties} />);
    expect(await screen.findByRole("heading", { name: "Lớp ngoại khóa · Trường Ánh Hoa", level: 1 })).toBeTruthy();
    const table = screen.getByRole("table", { name: /Lớp ngoại khóa · Trường Ánh Hoa/ });
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toEqual(["Lớp ngoại khóa", "Khoản thu", "Học sinh hiện tại", "Trạng thái", "Tùy chọn"]);
    const rows = within(table).getAllByRole("row");
    expect(within(rows[1]!).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["Tiếng Anh A1 (T2-T4)", "Tiếng Anh bản ngữ · 600.000 đ/thángDùng chung với Tiếng Anh A2 (T3-T5)", "18 học sinh", "Đang hoạt động", "Xem thành viên"]);
    expect(within(rows[3]!).getAllByRole("cell")[3]!.textContent).toBe("Ngừng hoạt động");
    expect(screen.getByText("Hướng dẫn").closest("details")!.open).toBe(false);
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "ACTIVE" } });
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "anh" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("status=ACTIVE") && String(url).includes("q=anh"))).toBe(true));
    fireEvent.click(within(rows[1]!).getByRole("link", { name: "Xem thành viên" }));
    expect(properties.onSearchChange).toHaveBeenCalledWith("?class=class-a1");
  });

  it("creates a class from an active EXTRACURRICULAR receivable with an idempotent server command", async () => {
    const fetch = route({ "extracurricular-classes": (_url, options) => (options?.method === "POST" ? response({ status: "COMPLETED", outcome: { id: "new" } }) : response(list)) });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    const trigger = await screen.findByRole("button", { name: "Thêm lớp ngoại khóa" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Thêm lớp ngoại khóa" });
    expect(dialog.classList.contains("dialog-wide")).toBe(true);
    expect(document.activeElement).toBe(within(dialog).getByLabelText("Tên lớp"));
    const receivable = within(dialog).getByLabelText("Khoản thu") as HTMLSelectElement;
    expect(Array.from(receivable.options).map((option) => option.textContent)).toEqual(["Chọn khoản thu Ngoại khóa", "Tiếng Anh bản ngữ · 600.000 đ/tháng", "Năng khiếu vẽ · 400.000 đ/tháng"]);
    fireEvent.change(receivable, { target: { value: "english" } });
    expect(within(dialog).getByText("Dùng chung với: Tiếng Anh A1 (T2-T4), Tiếng Anh A2 (T3-T5).")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Tên lớp"), { target: { value: "Tiếng Anh A3" } });
    fireEvent.click(within(dialog).getByLabelText("Điểm danh riêng"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ name: "Tiếng Anh A3", schoolYearId: "year", receivableId: "english", separateAttendance: true });
    const headers = (post[1] as RequestInit).headers as Record<string, string>;
    expect(headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(headers["x-operation-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(document.activeElement).toBe(trigger);
  });

  it("shows server validation inside the create dialog without closing it", async () => {
    vi.stubGlobal("fetch", route({ "extracurricular-classes": (_url, options) => (options?.method === "POST" ? new Response(JSON.stringify({ error: { message: "Tên lớp ngoại khóa đã tồn tại trong năm học.", fieldErrors: { name: "Tên lớp ngoại khóa đã tồn tại trong năm học." } } }), { status: 400 }) : response(list)) }));
    render(<ExtracurricularClassesWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm lớp ngoại khóa" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm lớp ngoại khóa" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    expect((await within(dialog).findAllByText("Tên lớp ngoại khóa đã tồn tại trong năm học.")).length).toBeGreaterThan(0);
    expect(within(dialog).getByLabelText("Tên lớp").getAttribute("aria-invalid")).toBe("true");
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows the class detail with month counts, mid-month flags and transfer notes", async () => {
    const fetch = route({ "extracurricular-classes/class-a1": () => response(detail()) });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    expect(await screen.findByRole("heading", { name: "Tiếng Anh A1 (T2-T4)", level: 1 })).toBeTruthy();
    expect(screen.getByText("Tháng 10/2026").parentElement!.textContent).toBe("Tháng 10/2026Đang tham gia: 2Tính trong tháng: 4Vào/nghỉ trong tháng: 2");
    expect(screen.getByText(/Dùng chung với Tiếng Anh A2 \(T3-T5\)/)).toBeTruthy();
    const table = screen.getByRole("table", { name: /Thành viên · hiển thị/ });
    const text = (name: string) => within(within(table).getByText(name).closest("tr")!).getAllByRole("cell").map((cell) => cell.textContent);
    expect(text("Bé Minh Anh")).toEqual(["", "AH-104", "Bé Minh AnhChuyển sang Tiếng Anh A2 (T3-T5) từ 16/10/2026", "Chồi 3B", "01/09/2026", "15/10/2026", "Kết thúc trong tháng"]);
    expect(text("Bé An Nhiên")[6]).toBe("Vào giữa tháng");
    expect(text("Bé Tuấn Huy")[6]).toBe("Đang tham gia");
    expect(text("Bé Khôi Nguyên")[6]).toBe("Đã kết thúc");
    expect(screen.getByRole("button", { name: "Kết thúc tham gia" })).toHaveProperty("disabled", true);
    expect(screen.queryByRole("checkbox", { name: "Chọn Bé Khôi Nguyên" })).toBeNull();
    expect(screen.getByText("Hướng dẫn").closest("details")!.open).toBe(false);
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "ALL" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("status=ALL"))).toBe(true));
  });

  it("adds Students in bulk from an official class picker with one shared reason", async () => {
    const fetch = route({
      "/candidates": () => response(candidates),
      "extracurricular-classes/class-a1": (_url, options) => (options?.method === "POST" ? response({ status: "COMPLETED", outcome: {} }) : response(detail())),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm học sinh" }));
    const dialog = await screen.findByRole("dialog", { name: "Thêm học sinh · Tiếng Anh A1 (T2-T4)" });
    await within(dialog).findByText("Bé Bảo Châu");
    expect(within(dialog).getByRole("checkbox", { name: "Chọn Bé Gia Hân" })).toHaveProperty("disabled", true);
    expect(within(dialog).getByText("Đã thuộc lớp này")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm học sinh đã chọn" }));
    expect(await within(dialog).findByText("Chọn ít nhất một học sinh trước khi thêm.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Lớp chính thức"), { target: { value: "c1" } });
    await waitFor(() => expect(fetch.mock.calls.some(([url]) => String(url).includes("/candidates") && String(url).includes("officialClassId=c1"))).toBe(true));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Chọn tất cả học sinh có thể thêm" }));
    expect(within(dialog).getByText("Đã chọn 1 học sinh.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Hiệu lực từ"), { target: { value: "2026-10-01" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Đăng ký học kỳ 1" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Thêm học sinh đã chọn" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    expect(String(post[0]).endsWith("/extracurricular-classes/class-a1/memberships")).toBe(true);
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ enrollmentIds: ["e10"], effectiveFrom: "2026-10-01", reason: "Đăng ký học kỳ 1" });
  });

  it("ends selected memberships in bulk and keeps the dialog open with the server overlap message on refusal", async () => {
    let refuse = true;
    const fetch = route({ "extracurricular-classes/class-a1": (_url, options) => (options?.method === "POST" ? (refuse ? new Response(JSON.stringify({ error: { message: "Thành viên đã có ngày kết thúc: AH-104.", fieldErrors: {} } }), { status: 409 }) : response({ status: "COMPLETED", outcome: {} })) : response(detail())) });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    fireEvent.click(await screen.findByRole("checkbox", { name: "Chọn Bé Tuấn Huy" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Chọn Bé An Nhiên" }));
    expect(screen.getByText("Đã chọn 2 học sinh.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Kết thúc tham gia" }));
    const dialog = await screen.findByRole("dialog", { name: "Kết thúc tham gia · Tiếng Anh A1 (T2-T4)" });
    expect(within(dialog).getByText("Kết thúc tham gia cho 2 học sinh đã chọn với cùng ngày kết thúc và lý do.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Ngày kết thúc"), { target: { value: "2026-10-31" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Phụ huynh xin nghỉ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Kết thúc tham gia" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Thành viên đã có ngày kết thúc: AH-104.");
    expect(screen.getByRole("dialog", { name: /Kết thúc tham gia/ })).toBeTruthy();
    refuse = false;
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Kết thúc tham gia" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const posts = fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "POST");
    expect(posts.every(([url]) => String(url).endsWith("/memberships/end"))).toBe(true);
    expect(JSON.parse(String((posts.at(-1)![1] as RequestInit).body))).toEqual({ membershipIds: ["m1", "m3"], effectiveTo: "2026-10-31", reason: "Phụ huynh xin nghỉ" });
    expect(new Set(posts.map(([, options]) => ((options as RequestInit).headers as Record<string, string>)["x-operation-id"])).size).toBe(2);
  });

  it("deactivates a class with a reason and disables membership actions while inactive", async () => {
    const fetch = route({ "extracurricular-classes/class-a1": (_url, options) => (options?.method === "POST" ? response({ status: "COMPLETED", outcome: {} }) : response(detail())) });
    vi.stubGlobal("fetch", fetch);
    const view = render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Ngừng hoạt động" }));
    const dialog = screen.getByRole("dialog", { name: "Ngừng hoạt động Tiếng Anh A1 (T2-T4)" });
    expect(within(dialog).getByText("Lớp sẽ không được tính vào đợt thu mới. Thành viên và lịch sử vẫn được giữ để đối soát.")).toBeTruthy();
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Hết khóa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Ngừng hoạt động" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    expect(String(post[0]).endsWith("/extracurricular-classes/class-a1/lifecycle")).toBe(true);
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual({ status: "INACTIVE", reason: "Hết khóa" });
    view.unmount();
    vi.stubGlobal("fetch", route({ "extracurricular-classes/class-a1": () => response(detail({ class: { ...klass({ status: "INACTIVE" }), schoolYearName: "2026-2027" } })) }));
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    expect(await screen.findByRole("button", { name: "Kích hoạt lại" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm học sinh" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("checkbox", { name: "Chọn Bé Tuấn Huy" })).toHaveProperty("disabled", true);
  });

  it("reconciles an uncertain command by Operation id before reporting success", async () => {
    let polls = 0;
    const fetch = route({
      "/operations/": () => (++polls < 2 ? response({ status: "PENDING" }) : response({ status: "COMPLETED", outcome: {} })),
      "extracurricular-classes": (_url, options) => (options?.method === "POST" ? new Response(null, { status: 503 }) : response(list)),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm lớp ngoại khóa" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Khoản thu"), { target: { value: "drawing" } });
    fireEvent.change(within(dialog).getByLabelText("Tên lớp"), { target: { value: "Vẽ 2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull(), { timeout: 4000 });
    const post = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "POST")!;
    const operationId = ((post[1] as RequestInit).headers as Record<string, string>)["x-operation-id"];
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith(`/finance/operations/${operationId}`))).toBe(true);
    expect(fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "POST")).toHaveLength(1);
  });

  const fillCreate = async () => {
    fireEvent.click(await screen.findByRole("button", { name: "Thêm lớp ngoại khóa" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm lớp ngoại khóa" });
    fireEvent.change(within(dialog).getByLabelText("Khoản thu"), { target: { value: "drawing" } });
    fireEvent.change(within(dialog).getByLabelText("Tên lớp"), { target: { value: "Vẽ 2" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    return dialog;
  };
  const posts = (fetch: ReturnType<typeof vi.fn>) => fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "POST");
  const headerOf = (call: unknown[], name: string) => ((call[1] as RequestInit).headers as Record<string, string>)[name];

  it("keeps commands disabled after reconciliation is exhausted and reconciles the same Operation without a new key", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let known = false;
    const fetch = route({
      "/operations/": () => (known ? response({ status: "COMPLETED", outcome: {} }) : new Response(null, { status: 404 })),
      "extracurricular-classes": (_url, options) => (options?.method === "POST" ? new Response(null, { status: 503 }) : response(list)),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    const dialog = await fillCreate();
    await vi.advanceTimersByTimeAsync(750 * 9);
    expect(await screen.findByText(/Chưa thể xác nhận Operation/)).toBeTruthy();
    expect(posts(fetch)).toHaveLength(1);
    const operationId = headerOf(posts(fetch)[0]!, "x-operation-id");
    expect(JSON.parse(sessionStorage.getItem("passionedu.app.pending-extracurricular-operation")!)).toMatchObject({ id: operationId, key: headerOf(posts(fetch)[0]!, "idempotency-key"), body: { name: "Vẽ 2" } });
    // Every command stays blocked: the dialog submit is disabled and so is the page action.
    expect(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" })).toHaveProperty("disabled", true);
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    expect(screen.getByRole("button", { name: "Thêm lớp ngoại khóa" })).toHaveProperty("disabled", true);
    expect(posts(fetch)).toHaveLength(1);
    // The server now knows the Operation: "Đối soát lại" reads that same Operation and mints nothing new.
    known = true;
    fireEvent.click(screen.getByRole("button", { name: "Đối soát lại" }));
    await vi.advanceTimersByTimeAsync(2000);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(posts(fetch)).toHaveLength(1);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith(`/finance/operations/${operationId}`))).toBe(true);
    expect(sessionStorage.getItem("passionedu.app.pending-extracurricular-operation")).toBeNull();
    expect(screen.queryByRole("button", { name: "Đối soát lại" })).toBeNull();
  });

  it("re-sends the stored request under the same key only when the server never saw the Operation", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    let attempts = 0;
    const fetch = route({
      "/operations/": () => new Response(null, { status: 404 }),
      "extracurricular-classes": (_url, options) => (options?.method === "POST" ? (++attempts === 1 ? new Response(null, { status: 503 }) : response({ status: "COMPLETED", outcome: {} })) : response(list)),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    await fillCreate();
    await vi.advanceTimersByTimeAsync(750 * 9);
    fireEvent.click(await screen.findByRole("button", { name: "Đối soát lại" }));
    await vi.advanceTimersByTimeAsync(500);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const sent = posts(fetch);
    expect(sent).toHaveLength(2);
    expect(headerOf(sent[1]!, "idempotency-key")).toBe(headerOf(sent[0]!, "idempotency-key"));
    expect(headerOf(sent[1]!, "x-operation-id")).toBe(headerOf(sent[0]!, "x-operation-id"));
    expect(sent[1]![1]).toMatchObject({ body: (sent[0]![1] as RequestInit).body });
  });

  it("restores a persisted pending Operation after a reload and blocks new commands until it is reconciled", async () => {
    sessionStorage.setItem("passionedu.app.pending-extracurricular-operation", JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", key: "22222222-2222-4222-8222-222222222222", path: "/api/app/schools/school-a/finance/extracurricular-classes", body: { name: "Vẽ 2" }, schoolId: "school-a" }));
    const fetch = route({ "/operations/": () => response({ status: "COMPLETED", outcome: {} }), "extracurricular-classes": () => response(list) });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    expect(await screen.findByRole("button", { name: "Đối soát lại" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Thêm lớp ngoại khóa" })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: "Đối soát lại" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Đối soát lại" })).toBeNull());
    expect(screen.getByRole("button", { name: "Thêm lớp ngoại khóa" })).toHaveProperty("disabled", false);
    expect(posts(fetch)).toHaveLength(0);
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/operations/11111111-1111-4111-8111-111111111111"))).toBe(true);
  });

  it("ignores out-of-order list responses", async () => {
    const pendingResponses: Array<(value: Response) => void> = [];
    const fetch = vi.fn((url: string) => (String(url).includes("q=") ? new Promise<Response>((resolve) => pendingResponses.push(resolve)) : Promise.resolve(response(list))));
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    await screen.findByText("Vẽ thiếu nhi");
    for (const query of ["a", "b"]) {
      fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: query } });
      fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
      await waitFor(() => expect(pendingResponses.length).toBe(query === "a" ? 1 : 2));
    }
    pendingResponses[1]!(response({ ...list, classes: [klass({ id: "new", name: "Kết quả mới nhất" })] }));
    await screen.findByText("Kết quả mới nhất");
    pendingResponses[0]!(response({ ...list, classes: [klass({ id: "old", name: "Kết quả cũ chậm" })] }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Kết quả cũ chậm")).toBeNull();
    expect(screen.getByText("Kết quả mới nhất")).toBeTruthy();
  });

  it("ignores a detail response for a class that is no longer open and a late picker response", async () => {
    const resolvers: Record<string, (value: Response) => void> = {};
    const fetch = vi.fn((url: string) => new Promise<Response>((resolve) => { resolvers[String(url).includes("/candidates") ? "candidates" : String(url).includes("class-b") ? "b" : "a"] = resolve; }));
    vi.stubGlobal("fetch", fetch);
    const view = render(<ExtracurricularClassesWorkspace {...props("?class=class-a")} />);
    await waitFor(() => expect(resolvers.a).toBeTruthy());
    view.rerender(<ExtracurricularClassesWorkspace {...props("?class=class-b")} />);
    await waitFor(() => expect(resolvers.b).toBeTruthy());
    resolvers.b!(response(detail({ class: { ...klass({ id: "class-b", name: "Lớp B" }), schoolYearName: "2026-2027" } })));
    expect(await screen.findByRole("heading", { name: "Lớp B", level: 1 })).toBeTruthy();
    resolvers.a!(response(detail({ class: { ...klass({ id: "class-a", name: "Lớp A chậm" }), schoolYearName: "2026-2027" } })));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("heading", { name: /Lớp A chậm/ })).toBeNull();
    expect(screen.getByRole("heading", { name: "Lớp B", level: 1 })).toBeTruthy();
    // Picker: a late response for an older filter does not replace the newer one.
    fireEvent.click(screen.getByRole("button", { name: "Thêm học sinh" }));
    await waitFor(() => expect(resolvers.candidates).toBeTruthy());
    const first = resolvers.candidates!;
    delete resolvers.candidates;
    fireEvent.change(within(await screen.findByRole("dialog")).getByLabelText("Tìm học sinh"), { target: { value: "bảo" } });
    await waitFor(() => expect(resolvers.candidates).toBeTruthy());
    resolvers.candidates!(response({ ...candidates, candidates: [{ ...candidates.candidates[0]!, fullName: "Bé Mới Nhất" }] }));
    await screen.findByText("Bé Mới Nhất");
    first(response({ ...candidates, candidates: [{ ...candidates.candidates[0]!, fullName: "Bé Cũ Chậm" }] }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText("Bé Cũ Chậm")).toBeNull();
  });

  it("shows and edits Điểm danh riêng, sending only that change with a reason", async () => {
    const fetch = route({
      "extracurricular-classes/class-a1": (_url, options) => (options?.method === "PUT" ? response({ status: "COMPLETED", outcome: {} }) : response(detail({ class: { ...klass({ separateAttendance: true }), schoolYearName: "2026-2027" } }))),
      "extracurricular-classes?": () => response({ ...list, classes: [klass({ separateAttendance: true })] }),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    expect((await screen.findByRole("heading", { name: "Tiếng Anh A1 (T2-T4)", level: 1 })).parentElement!.textContent).toContain("Năm học 2026-2027 · Điểm danh riêng");
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa" }));
    const dialog = screen.getByRole("dialog", { name: "Chỉnh sửa · Tiếng Anh A1 (T2-T4)" });
    const checkbox = within(dialog).getByLabelText("Điểm danh riêng") as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    fireEvent.click(checkbox);
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Học trong giờ" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(fetch.mock.calls.some(([, options]) => (options as RequestInit | undefined)?.method === "PUT" && JSON.parse(String((options as RequestInit).body)).separateAttendance === false)).toBe(true));
    const put = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "PUT")!;
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ separateAttendance: false, reason: "Học trong giờ" });
  });

  it("edits the class name and Receivable in one dialog with a required reason through an idempotent PUT", async () => {
    let refuse = true;
    const fetch = route({
      "extracurricular-classes/class-a1": (_url, options) => (options?.method === "PUT" ? (refuse ? new Response(JSON.stringify({ error: { message: "Tên lớp ngoại khóa đã tồn tại trong năm học.", fieldErrors: { name: "Tên lớp ngoại khóa đã tồn tại trong năm học." } } }), { status: 400 }) : response({ status: "COMPLETED", outcome: {} })) : response(detail())),
      "extracurricular-classes?": () => response(list),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    const trigger = await screen.findByRole("button", { name: "Chỉnh sửa" });
    expect(trigger.nextElementSibling!.textContent).toBe("Ngừng hoạt động");
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Chỉnh sửa · Tiếng Anh A1 (T2-T4)" });
    await waitFor(() => expect(within(dialog).getAllByRole("option").map((option) => option.textContent)).toEqual(["Tiếng Anh bản ngữ · 600.000 đ/tháng", "Năng khiếu vẽ · 400.000 đ/tháng"]));
    expect(within(dialog).getByLabelText("Khoản thu")).toHaveProperty("value", "english");
    expect(within(dialog).getByText("Dùng chung với: Tiếng Anh A2 (T3-T5).")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Lưu thay đổi" })).toHaveProperty("disabled", true);
    expect(dialog.classList.contains("dialog-wide")).toBe(true);
    expect(within(dialog).getByLabelText("Tên lớp")).toHaveProperty("value", "Tiếng Anh A1 (T2-T4)");
    fireEvent.change(within(dialog).getByLabelText("Tên lớp"), { target: { value: "Tiếng Anh nâng cao" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Đổi chương trình" } });
    fireEvent.change(within(dialog).getByLabelText("Khoản thu"), { target: { value: "drawing" } });
    expect(within(dialog).getByText("Chỉ khoản thu Ngoại khóa đang áp dụng.")).toBeTruthy();
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    expect((await within(dialog).findAllByText("Tên lớp ngoại khóa đã tồn tại trong năm học.")).length).toBeGreaterThan(0);
    expect(screen.getByRole("dialog", { name: /Chỉnh sửa/ })).toBeTruthy();
    refuse = false;
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const puts = fetch.mock.calls.filter(([, options]) => (options as RequestInit | undefined)?.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(String(puts[1]![0]).endsWith("/extracurricular-classes/class-a1")).toBe(true);
    expect(JSON.parse(String((puts[1]![1] as RequestInit).body))).toEqual({ name: "Tiếng Anh nâng cao", receivableId: "drawing", reason: "Đổi chương trình" });
    expect(headerOf(puts[1]!, "idempotency-key")).toMatch(/^[0-9a-f-]{36}$/);
    expect(headerOf(puts[1]!, "idempotency-key")).not.toBe(headerOf(puts[0]!, "idempotency-key"));
    expect(document.activeElement).toBe(trigger);
  });

  it("opens the Khoản thu edit dialog from Sửa giá, lists the classes using it and sends only changed fields", async () => {
    const catalog = { groups: [], receivables: [{ id: "english", groupId: "g3", kind: "EXTRACURRICULAR", kindLocked: true, extracurricularClassCount: 2, extracurricularClassNames: ["Tiếng Anh A1 (T2-T4)", "Tiếng Anh A2 (T3-T5)"], code: null, displayName: "Tiếng Anh bản ngữ", unitLabel: "tháng", defaultUnitPrice: "600000", refundUnitPrice: "0", taxCategory: "NOT_DECLARED", status: "ACTIVE" }] };
    const fetch = route({
      "/finance/receivables/english": () => response({ status: "COMPLETED", outcome: {} }),
      "/finance/receivables": () => response(catalog),
      "extracurricular-classes/class-a1": () => response(detail()),
    });
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props("?class=class-a1")} />);
    fireEvent.click(await screen.findByRole("button", { name: "Sửa giá" }));
    const dialog = screen.getByRole("dialog", { name: /Chỉnh sửa · Tiếng Anh bản ngữ/ });
    expect(await within(dialog).findByText("Đang dùng cho 2 lớp ngoại khóa: Tiếng Anh A1 (T2-T4), Tiếng Anh A2 (T3-T5).")).toBeTruthy();
    expect(within(dialog).getByLabelText("Giá / đơn vị (chưa VAT)")).toHaveProperty("value", "600000");
    expect(within(dialog).getByRole("group", { name: "Nhóm khoản thu" })).toHaveProperty("disabled", true);
    expect(within(dialog).getByRole("button", { name: "Lưu thay đổi" })).toHaveProperty("disabled", true);
    fireEvent.change(within(dialog).getByLabelText("Giá / đơn vị (chưa VAT)"), { target: { value: "650000" } });
    fireEvent.change(within(dialog).getByLabelText("Lý do"), { target: { value: "Tăng giá năm học mới" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu thay đổi" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    const put = fetch.mock.calls.find(([, options]) => (options as RequestInit | undefined)?.method === "PUT")!;
    expect(String(put[0]).endsWith("/finance/receivables/english")).toBe(true);
    expect(JSON.parse(String((put[1] as RequestInit).body))).toEqual({ defaultUnitPrice: "650000", reason: "Tăng giá năm học mới" });
    expect(fetch.mock.calls.filter(([url]) => String(url).includes("extracurricular-classes/class-a1")).length).toBeGreaterThan(1);
  });

  it("submits the first open SchoolYear when the dialog was opened before the list finished loading", async () => {
    let resolveList!: (value: Response) => void;
    const fetch = vi.fn((_url: string, options?: RequestInit) => (options?.method === "POST" ? Promise.resolve(response({ status: "COMPLETED", outcome: {} })) : new Promise<Response>((resolve) => { resolveList = resolve; })));
    vi.stubGlobal("fetch", fetch);
    render(<ExtracurricularClassesWorkspace {...props()} />);
    fireEvent.click(await screen.findByRole("button", { name: "Thêm lớp ngoại khóa" }));
    const dialog = screen.getByRole("dialog", { name: "Thêm lớp ngoại khóa" });
    resolveList(response(list));
    await within(dialog).findByRole("option", { name: "Năng khiếu vẽ · 400.000 đ/tháng" });
    fireEvent.change(within(dialog).getByLabelText("Khoản thu"), { target: { value: "drawing" } });
    fireEvent.change(within(dialog).getByLabelText("Tên lớp"), { target: { value: "Vẽ 3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Lưu lớp ngoại khóa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(JSON.parse(String((posts(fetch)[0]![1] as RequestInit).body))).toEqual({ name: "Vẽ 3", schoolYearId: "year", receivableId: "drawing", separateAttendance: false });
  });
});
