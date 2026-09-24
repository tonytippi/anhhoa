import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RosterWorkspace } from "./roster-workspace";

const year = { id: "year-a", name: "Năm 2026", startsOn: "2026-01-01", endsOn: "2027-01-01", isActive: true };
const classroom = { id: "class-a", schoolYearId: "year-a", name: "Lớp Mầm", status: "ACTIVE", activeStudentCount: 1 };
const row = { id: "student-a", studentCode: "S1", fullName: "Bé An", hasPhoto: false, enrollment: { id: "enrollment-a", lifecycle: "ENROLLED", effectiveFrom: "2026-01-01", classroom: { id: "class-a", name: "Lớp Mầm" } }, relatives: { mother: "Mai Trần", father: "Minh Trần", otherRelativeCount: 2 } };
const list = (data = [row], meta = { page: 1, pageSize: 25, totalItems: 27, totalPages: 2 }) => ({ data, meta });
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const pagedResponse = (page: unknown = list()) => new Response(JSON.stringify(page));
const parentRow = { id: "parent-a", fullName: "Mai Trần", phone: "0900", email: null, children: [{ linkId: "link-a", studentName: "Bé An", className: "Lớp Mầm", relationshipLabel: "Mẹ" }] };
const parentPage = (data = [parentRow], meta = { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 }) => ({ data, meta });
const fetcher = (overrides: Record<string, unknown> = {}) => vi.fn((url: string, options?: RequestInit) => {
  if (options?.method === "POST") return Promise.resolve(response({ id: "operation" }));
  if (url.includes("/school-years/year-a/students?")) return Promise.resolve(pagedResponse(list()));
  if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
  if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
  if (url.endsWith("/staff") || url.endsWith("/positions") || url.endsWith("/staff-assignments")) return Promise.resolve(response([]));
  if (url.endsWith("/students/student-a")) return Promise.resolve(response({ ...row, enrollments: [{ ...row.enrollment, endedOn: null }] }));
  if (url.endsWith("/students/student-a/parents")) return Promise.resolve(response([{ id: "link-a", relationshipLabel: "Mẹ", status: "ACTIVE", parent: { fullName: "Mai Trần", email: "mai@example.com", phone: "0900", bound: false } }]));
  return Promise.resolve(response(overrides[url] ?? []));
});

afterEach(() => vi.unstubAllGlobals());

describe("RosterWorkspace paged read model", () => {
  it("renders an independent paged parent table without loading student rows", async () => {
    const fetch = vi.fn((url: string) => {
      if (url.includes("/school-years/year-a/parents?")) return Promise.resolve(pagedResponse({ data: [parentRow], meta: { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 } }));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      if (url.endsWith("/classes") || url.endsWith("/staff-assignments") || url.endsWith("/staff") || url.endsWith("/positions")) return Promise.resolve(response([]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="parents" />);
    expect(await screen.findByText("Mai Trần")).toBeTruthy();
    expect(screen.getByText("Bé An · Lớp Mầm")).toBeTruthy();
    expect(screen.getByText("-")).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).includes("/students?"))).toBe(false);
  });
  it("pages and searches parents without allowing an older page response to overwrite the query", async () => {
    let resolvePageTwo!: (value: Response) => void;
    const pageTwo = new Promise<Response>((resolve) => { resolvePageTwo = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.includes("/parents?") && url.includes("page=2")) return pageTwo;
      if (url.includes("/parents?") && url.includes("q=")) return Promise.resolve(pagedResponse(parentPage([{ ...parentRow, id: "parent-b", fullName: "Bình Lê" }])));
      if (url.includes("/parents?")) return Promise.resolve(pagedResponse(parentPage([parentRow], { page: 1, pageSize: 25, totalItems: 26, totalPages: 2 })));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="parents" />);
    await screen.findByText("Mai Trần");
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "Bình" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText("Bình Lê")).toBeTruthy();
    resolvePageTwo(pagedResponse(parentPage([{ ...parentRow, fullName: "Cũ" }], { page: 2, pageSize: 25, totalItems: 26, totalPages: 2 })));
    await waitFor(() => expect(screen.queryByText("Cũ")).toBeNull());
  });
  it("shows parent empty and error states without treating an error as empty", async () => {
    const emptyFetch = vi.fn((url: string) => url.includes("/parents?") ? Promise.resolve(pagedResponse(parentPage([]))) : url.endsWith("/school-years") ? Promise.resolve(response([year])) : Promise.resolve(response([])));
    vi.stubGlobal("fetch", emptyFetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="parents" />);
    expect(await screen.findByText("Chưa có phụ huynh liên kết trong năm học này")).toBeTruthy();
    const errorFetch = vi.fn((url: string) => url.includes("/parents?") ? Promise.resolve(new Response(null, { status: 500 })) : url.endsWith("/school-years") ? Promise.resolve(response([year])) : Promise.resolve(response([])));
    vi.stubGlobal("fetch", errorFetch);
    view.rerender(<RosterWorkspace schoolId="school-b" schoolName="Trường B" denied={vi.fn()} section="parents" />);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByText("Chưa có phụ huynh liên kết trong năm học này")).toBeNull();
  });
  it("opens, traps, dismisses, and restores focus for parent detail", async () => {
    const fetch = vi.fn((url: string) => url.includes("/parents?") ? Promise.resolve(pagedResponse(parentPage())) : url.endsWith("/school-years") ? Promise.resolve(response([year])) : Promise.resolve(response([])));
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="parents" />);
    const menu = await screen.findByRole("button", { name: "Tùy chọn cho Mai Trần" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    const action = await screen.findByRole("menuitem", { name: "Xem chi tiết phụ huynh" });
    fireEvent.click(action);
    const dialog = await screen.findByRole("dialog", { name: "Hồ sơ Mai Trần" });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Đóng" }));
    fireEvent.keyDown(dialog, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Hồ sơ Mai Trần" })).toBeNull());
    expect(document.activeElement).toBe(menu);
  });
  it("renders only the returned page and relationship projections without detail requests", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    expect(await screen.findByText("Bé An")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("Mai Trần")).toBeTruthy();
    expect(screen.getByText("Minh Trần")).toBeTruthy();
    expect(screen.getByText("+2 người thân khác")).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/students/student-a/parents"))).toBe(false);
  });

  it("clears rows and applies a new page query without allowing stale results to replace it", async () => {
    let resolveSecond!: (response: Response) => void;
    const second = new Promise<Response>((resolve) => { resolveSecond = resolve; });
    const fetch = vi.fn((url: string) => {
      if (url.includes("page=1") && !url.includes("q=")) return Promise.resolve(pagedResponse(list()));
      if (url.includes("page=2")) return second;
      if (url.includes("q=")) return Promise.resolve(pagedResponse(list([{ ...row, id: "student-c", fullName: "Bé Cường" }], { page: 1, pageSize: 25, totalItems: 1, totalPages: 1 })));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    await screen.findByText("Bé An");
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    fireEvent.change(screen.getByLabelText("Tìm kiếm"), { target: { value: "Bình" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(await screen.findByText("Bé Cường")).toBeTruthy();
    resolveSecond(pagedResponse(list([{ ...row, id: "student-b", fullName: "Bé Bình" }], { page: 2, pageSize: 25, totalItems: 27, totalPages: 2 })));
    await waitFor(() => expect(screen.queryByText("Bé Bình")).toBeNull());
  });

  it("refreshes the active query only when explicitly requested", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    await screen.findByText("Bé An");
    const before = fetch.mock.calls.filter(([url]) => String(url).includes("/students?")).length;
    fireEvent.click(screen.getByRole("button", { name: "Làm mới danh sách" }));
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes("/students?")).length).toBe(before + 1));
  });

  it("loads parent detail only after opening the focused student panel", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tùy chọn cho Bé An" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Xem hồ sơ" }));
    expect(await screen.findByRole("dialog", { name: "Hồ sơ Bé An" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/students/student-a/parents"))).toBe(true);
    expect(screen.getByText(/mai@example\.com/)).toBeTruthy();
  });

  it("posts a relationship-labelled link only from the focused form", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tùy chọn cho Bé An" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Quản lý liên kết người thân" }));
    await screen.findByRole("dialog", { name: "Hồ sơ Bé An" });
    fireEvent.change(screen.getByLabelText("Họ và tên người thân"), { target: { value: "Bà Trần" } });
    fireEvent.change(screen.getByLabelText("Email người thân"), { target: { value: "ba@example.com" } });
    fireEvent.change(screen.getByLabelText("Số điện thoại người thân"), { target: { value: "0900000000" } });
    fireEvent.change(screen.getByLabelText("Quan hệ"), { target: { value: "Bà ngoại" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    await waitFor(() => expect(fetch.mock.calls.some(([url, options]) => String(url).endsWith("/students/student-a/parents") && options?.method === "POST" && options.body === JSON.stringify({ fullName: "Bà Trần", email: "ba@example.com", phone: "0900000000", relationshipLabel: "Bà ngoại" }))).toBe(true));
  });

  it("resets relationship form state and errors when opening another student detail", async () => {
    const rowB = { ...row, id: "student-b", fullName: "Bé Bình" };
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(new Response(JSON.stringify({ error: { message: "Dữ liệu không hợp lệ.", fieldErrors: { relationshipLabel: "Quan hệ cần từ 1 đến 50 ký tự." } } }), { status: 400 }));
      if (url.includes("/school-years/year-a/students?")) return Promise.resolve(pagedResponse(list([row, rowB])));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
      if (url.endsWith("/staff") || url.endsWith("/positions") || url.endsWith("/staff-assignments")) return Promise.resolve(response([]));
      if (url.endsWith("/students/student-a") || url.endsWith("/students/student-b")) return Promise.resolve(response({ ...(url.endsWith("student-a") ? row : rowB), enrollments: [{ ...row.enrollment, endedOn: null }] }));
      if (url.endsWith("/parents")) return Promise.resolve(response([]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    const menus = await screen.findAllByRole("button", { name: /Tùy chọn cho/ });
    fireEvent.click(menus[0]!); fireEvent.click(screen.getByRole("menuitem", { name: "Xem hồ sơ" }));
    await screen.findByRole("dialog", { name: "Hồ sơ Bé An" });
    fireEvent.change(screen.getByLabelText("Quan hệ"), { target: { value: "Bà ngoại" } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo liên kết" }));
    expect(await screen.findByText("Quan hệ cần từ 1 đến 50 ký tự.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    fireEvent.click(menus[1]!); fireEvent.click(screen.getByRole("menuitem", { name: "Xem hồ sơ" }));
    await screen.findByRole("dialog", { name: "Hồ sơ Bé Bình" });
    expect((screen.getByLabelText("Quan hệ") as HTMLInputElement).value).toBe("");
    expect(screen.queryByText("Quan hệ cần từ 1 đến 50 ký tự.")).toBeNull();
  });

  it("drops delayed detail A after B is opened and restores focus after closing B", async () => {
    let resolveA!: (response: Response) => void;
    const detailA = new Promise<Response>((resolve) => { resolveA = resolve; });
    const rowB = { ...row, id: "student-b", fullName: "Bé Bình" };
    const fetch = vi.fn((url: string) => {
      if (url.includes("/school-years/year-a/students?")) return Promise.resolve(pagedResponse(list([row, rowB])));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
      if (url.endsWith("/staff") || url.endsWith("/positions") || url.endsWith("/staff-assignments")) return Promise.resolve(response([]));
      if (url.endsWith("/students/student-a")) return detailA;
      if (url.endsWith("/students/student-a/parents")) return Promise.resolve(response([]));
      if (url.endsWith("/students/student-b")) return Promise.resolve(response({ ...rowB, enrollments: [{ ...rowB.enrollment, endedOn: null }] }));
      if (url.endsWith("/students/student-b/parents")) return Promise.resolve(response([]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    const menus = await screen.findAllByRole("button", { name: /Tùy chọn cho/ });
    fireEvent.click(menus[0]!); fireEvent.click(screen.getByRole("menuitem", { name: "Xem hồ sơ" }));
    fireEvent.click(menus[1]!); fireEvent.click(screen.getByRole("menuitem", { name: "Xem hồ sơ" }));
    expect(await screen.findByRole("dialog", { name: "Hồ sơ Bé Bình" })).toBeTruthy();
    resolveA(response({ ...row, enrollments: [{ ...row.enrollment, endedOn: null }] }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Hồ sơ Bé An" })).toBeNull());
    const close = screen.getByRole("button", { name: "Đóng" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).not.toBeNull());
  });

  it("opens, navigates, and dismisses the final action menu with the keyboard", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    const menu = await screen.findByRole("button", { name: "Tùy chọn cho Bé An" });
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    const actions = screen.getByRole("menu");
    const profile = screen.getByRole("menuitem", { name: "Xem hồ sơ" });
    const links = screen.getByRole("menuitem", { name: "Quản lý liên kết người thân" });
    await waitFor(() => expect(document.activeElement).toBe(profile));
    fireEvent.keyDown(profile, { key: "ArrowDown" });
    expect(document.activeElement).toBe(links);
    fireEvent.keyDown(links, { key: "ArrowUp" });
    expect(document.activeElement).toBe(profile);
    fireEvent.keyDown(actions, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
    expect(document.activeElement).toBe(menu);
  });

  it("clears a stale row menu when roster scope changes", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    const view = render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    fireEvent.click(await screen.findByRole("button", { name: "Tùy chọn cho Bé An" }));
    expect(screen.getByRole("menu")).toBeTruthy();
    view.rerender(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="parents" />);
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("bounds pager pages and provides previous and next controls", async () => {
    const fetch = vi.fn((url: string) => {
      if (url.includes("/school-years/year-a/students?")) return Promise.resolve(pagedResponse(list([row], { page: 50, pageSize: 25, totalItems: 2500, totalPages: 100 })));
      if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
      if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
      return Promise.resolve(response([]));
    });
    vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    expect(await screen.findByRole("button", { name: "Trước" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sau" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^\d+$/ })).toHaveLength(5);
  });
});
