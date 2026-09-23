import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RosterWorkspace } from "./roster-workspace";

const year = { id: "year-a", name: "Năm 2026", startsOn: "2026-01-01", endsOn: "2027-01-01", isActive: true };
const classroom = { id: "class-a", schoolYearId: "year-a", name: "Lớp Mầm", status: "ACTIVE", activeStudentCount: 1 };
const row = { id: "student-a", studentCode: "S1", fullName: "Bé An", hasPhoto: false, enrollment: { id: "enrollment-a", lifecycle: "ENROLLED", effectiveFrom: "2026-01-01", classroom: { id: "class-a", name: "Lớp Mầm" } }, parentSummary: { fullName: "Mai Trần", status: "ACTIVE", linkCount: 2 } };
const list = (data = [row], meta = { page: 1, pageSize: 25, totalItems: 27, totalPages: 2 }) => ({ data, meta });
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });
const pagedResponse = (page = list()) => new Response(JSON.stringify(page));
const fetcher = (overrides: Record<string, unknown> = {}) => vi.fn((url: string, options?: RequestInit) => {
  if (options?.method === "POST") return Promise.resolve(response({ id: "operation" }));
  if (url.includes("/school-years/year-a/students?")) return Promise.resolve(pagedResponse(list()));
  if (url.endsWith("/school-years")) return Promise.resolve(response([year]));
  if (url.endsWith("/classes")) return Promise.resolve(response([classroom]));
  if (url.endsWith("/staff") || url.endsWith("/positions") || url.endsWith("/staff-assignments")) return Promise.resolve(response([]));
  if (url.endsWith("/students/student-a")) return Promise.resolve(response({ ...row, enrollments: [{ ...row.enrollment, endedOn: null }] }));
  if (url.endsWith("/students/student-a/parents")) return Promise.resolve(response([{ id: "link-a", status: "ACTIVE", parent: { fullName: "Mai Trần", email: "mai@example.com", phone: "0900", bound: false } }]));
  return Promise.resolve(response(overrides[url] ?? []));
});

afterEach(() => vi.unstubAllGlobals());

describe("RosterWorkspace paged read model", () => {
  it("renders only the returned page, metadata caption, and compact parent summary without detail requests", async () => {
    const fetch = fetcher(); vi.stubGlobal("fetch", fetch);
    render(<RosterWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} section="students" />);
    expect(await screen.findByText("Bé An")).toBeTruthy();
    expect(screen.getByText(/Trang 1/)).toBeTruthy();
    expect(screen.getByText("Mai Trần · Đang hiệu lực · 2 liên kết")).toBeTruthy();
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
    fireEvent.click(await screen.findByRole("button", { name: "Xem hồ sơ" }));
    expect(await screen.findByRole("dialog", { name: "Hồ sơ Bé An" })).toBeTruthy();
    expect(fetch.mock.calls.some(([url]) => String(url).endsWith("/students/student-a/parents"))).toBe(true);
    expect(screen.getByText(/mai@example\.com/)).toBeTruthy();
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
    const buttons = await screen.findAllByRole("button", { name: "Xem hồ sơ" });
    fireEvent.click(buttons[0]!); fireEvent.click(buttons[1]!);
    expect(await screen.findByRole("dialog", { name: "Hồ sơ Bé Bình" })).toBeTruthy();
    resolveA(response({ ...row, enrollments: [{ ...row.enrollment, endedOn: null }] }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Hồ sơ Bé An" })).toBeNull());
    const close = screen.getByRole("button", { name: "Đóng" });
    expect(document.activeElement).toBe(close);
    fireEvent.keyDown(close, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(buttons[1]!));
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
