import { describe, expect, it, vi } from "vitest";
import { ParentsController } from "./parents.controller.js";

describe("ParentsController phone", () => {
  it("requires Parent cookie mutation protection and sets no-store on the minimum read and write", async () => {
    const parents = { parentPhone: vi.fn().mockResolvedValue({ phone: "090 123 4567" }), updateParentPhone: vi.fn().mockResolvedValue({ id: "operation", status: "COMPLETED", outcome: { phone: "090 123 4567" } }) };
    const auth = { session: vi.fn().mockReturnValue({ userIdentityId: "parent" }) };
    const controller = new ParentsController(auth as never, parents as never);
    const response = { setHeader: vi.fn() };
    const request = { headers: { cookie: "parent_session=session; parent_csrf=csrf", origin: "http://localhost:5174", "x-csrf-token": "csrf" } };
    await expect(controller.profile(request, "school", response)).resolves.toEqual({ data: { phone: "090 123 4567" } });
    await expect(controller.phone(request, "school", crypto.randomUUID(), crypto.randomUUID(), { phone: "090 123 4567" }, response)).resolves.toMatchObject({ data: { status: "COMPLETED" } });
    expect(parents.updateParentPhone).toHaveBeenCalledWith("parent", "school", expect.any(String), expect.any(String), { phone: "090 123 4567" });
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
    await expect(controller.phone({ headers: { cookie: "parent_session=session" } }, "school", crypto.randomUUID(), crypto.randomUUID(), { phone: "090" })).rejects.toMatchObject({ response: { code: "CSRF_INVALID" } });
  });
});

describe("ParentsController obligations", () => {
  it("returns only the Parent obligation projection with no-store for list and detail", async () => {
    const obligation = { id: "invoice", obligationCode: "OBL-202609-000001", outstanding: "100" };
    const parents = { obligations: vi.fn().mockResolvedValue(obligation) };
    const auth = { session: vi.fn().mockReturnValue({ userIdentityId: "parent" }) };
    const controller = new ParentsController(auth as never, parents as never);
    const response = { setHeader: vi.fn() };
    const request = { headers: { cookie: "parent_session=session" } };
    await expect(controller.obligations(request, "school", response)).resolves.toEqual({ data: obligation });
    await expect(controller.obligation(request, "school", "invoice", response)).resolves.toEqual({ data: obligation });
    expect(parents.obligations).toHaveBeenNthCalledWith(1, "parent", "school");
    expect(parents.obligations).toHaveBeenNthCalledWith(2, "parent", "school", "invoice");
    expect(response.setHeader).toHaveBeenCalledWith("Cache-Control", "private, no-store");
  });
});
