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
});
