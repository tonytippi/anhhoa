import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReceiptQueueWorkspace } from "./receipt-queue-workspace";

const row = { id: "invoice-a", student: { code: "HS001", name: "Bé An" }, class: { id: "class-a", name: "Lá 1" }, schoolYearId: "year-a", billingMonth: "2026-09", issuedAt: "2026-09-01T00:00:00.000Z", outstanding: "120000", status: "ISSUED" as const };
const queue = { invoices: [row], filters: { schoolYearId: null, billingMonth: "2026-09", classIdSnapshot: null, student: null }, meta: { nextCursor: null } };
const detail = { id: "invoice-a", status: "ISSUED", outstanding: "120000", student: { code: "HS001", name: "Bé An" } };
const response = (data: unknown, status = 200) => new Response(JSON.stringify({ data }), { status });

afterEach(() => vi.unstubAllGlobals());

describe("ReceiptQueueWorkspace", () => {
  it("opens one server-authorized Invoice from an accessible row menu and only offers next after the refreshed queue", async () => {
    const fetch = vi.fn((url: string, options?: RequestInit) => {
      if (options?.method === "POST") return Promise.resolve(response({ status: "COMPLETED", outcome: { ...detail, status: "CLOSED", receipt: { actualAmount: "120000", outcome: "EXACT", difference: null } } }));
      if (url.includes("/classes")) return Promise.resolve(response({ classes: [{ id: "class-a", name: "Lá 1" }] }));
      if (url.includes("/receipt-queue/invoice-a")) return Promise.resolve(response(detail));
      return Promise.resolve(response(queue));
    });
    vi.stubGlobal("fetch", fetch); render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={vi.fn()} />);
    await screen.findByText("HS001 / Bé An");
    fireEvent.keyDown(screen.getByRole("button", { name: "Tùy chọn cho Bé An" }), { key: "ArrowDown" });
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ghi thực nhận" }));
    const dialog = await screen.findByRole("dialog", { name: "Ghi thực nhận cho Bé An" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Xác nhận ghi thực nhận" }));
    await screen.findByRole("heading", { name: "Kết quả ghi thực nhận" });
    expect(screen.queryByRole("button", { name: "Hóa đơn tiếp theo" })).toBeNull();
    await waitFor(() => expect(fetch.mock.calls.filter(([url]) => String(url).includes("receipt-queue?")).length).toBeGreaterThan(1));
  });
  it("clears protected state when Invoice detail is denied", async () => {
    const denied = vi.fn();
    vi.stubGlobal("fetch", vi.fn((url: string) => Promise.resolve(url.includes("/classes") ? response({ classes: [] }) : url.includes("/receipt-queue/invoice-a") ? response({}, 403) : response(queue))));
    render(<ReceiptQueueWorkspace schoolId="school-a" schoolName="Trường A" denied={denied} />);
    fireEvent.click(await screen.findByRole("button", { name: "Tùy chọn cho Bé An" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Ghi thực nhận" }));
    await waitFor(() => expect(denied).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
