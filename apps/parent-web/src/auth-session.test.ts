import { describe, expect, it, vi } from "vitest";
import {
  bootstrapSession,
  logout,
  parentGet,
  parentLeaveMutation,
  parentMedia,
  parentMutation,
  parentPost,
} from "./auth-session";

describe("Parent session safe state", () => {
  it("clears protected state for startup denial and logout even after a server failure", async () => {
    const clear = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401 }),
    );
    await expect(bootstrapSession(clear)).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalledOnce();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await expect(logout(clear)).resolves.toBeUndefined();
    expect(clear).toHaveBeenCalledTimes(2);
  });
  it("boots Parent context with credentialed no-store session request", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            audience: "parent",
            userIdentityId: "identity",
            email: "parent@example.com",
            schools: [],
          },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await bootstrapSession(vi.fn());
    expect(fetch).toHaveBeenCalledWith(
      "/api/parent/auth/session",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });
  it("uses credentialed no-store transport for protected projections and media", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ data: { value: true } })),
      );
    vi.stubGlobal("fetch", fetch);
    await expect(
      parentGet<{ value: boolean }>(
        "/api/parent/schools/school/students/student/attendance?from=2026-09-01&to=2026-09-01",
      ),
    ).resolves.toMatchObject({ kind: "ok", data: { value: true } });
    await parentMedia("/api/parent/schools/school/daily-journal-media/media");
    expect(fetch).toHaveBeenCalledWith(
      "/api/parent/schools/school/students/student/attendance?from=2026-09-01&to=2026-09-01",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/parent/schools/school/daily-journal-media/media",
      expect.objectContaining({ credentials: "include", cache: "no-store" }),
    );
  });
  it("reports intentional protected-read aborts without converting them into denial", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    );
    await expect(
      parentGet(
        "/api/parent/schools/school/students/student/attendance?from=2026-09-01&to=2026-09-01",
        controller.signal,
      ),
    ).resolves.toEqual({ kind: "aborted" });
    await expect(
      parentMedia(
        "/api/parent/schools/school/daily-journal-media/media",
        controller.signal,
      ),
    ).resolves.toEqual({ kind: "aborted" });
  });
  it("uses credentialed no-store CSRF transport for the inbox resolver", async () => {
    document.cookie = "parent_csrf=csrf-token";
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: { studentId: "student", date: "2026-09-27" },
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      parentPost("/api/parent/schools/school/inbox/event/open"),
    ).resolves.toMatchObject({ kind: "ok", data: { studentId: "student" } });
    expect(fetch).toHaveBeenCalledWith(
      "/api/parent/schools/school/inbox/event/open",
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "x-csrf-token": "csrf-token" },
      }),
    );
  });
  it("normalizes a completed leave Operation to its authoritative outcome", async () => {
    document.cookie = "parent_csrf=csrf-token";
    const leave = { id: "leave", studentId: "student", status: "CANCELLED" };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: { id: "operation", status: "COMPLETED", outcome: leave },
          }),
        ),
      ),
    );
    await expect(
      parentLeaveMutation(
        "/api/parent/schools/school/leave-requests/leave/cancel",
        "POST",
        {},
        "key",
        "operation",
      ),
    ).resolves.toEqual({ kind: "ok", data: leave });
  });
  it("keeps HTTP timeout and gateway mutation outcomes reconcilable", async () => {
    for (const status of [408, 429, 500, 502, 503, 504]) {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(null, { status })),
      );
      await expect(
        parentMutation(
          "/api/parent/schools/school/leave-requests",
          "POST",
          {},
          "key",
          "operation",
        ),
      ).resolves.toEqual({ kind: "unknown" });
    }
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(
      parentMutation(
        "/api/parent/schools/school/leave-requests",
        "POST",
        {},
        "key",
        "operation",
      ),
    ).resolves.toEqual({ kind: "unknown" });
  });
  it("uses the existing protected mutation transport for the phone-only PATCH command", async () => {
    document.cookie = "parent_csrf=csrf-token";
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: "operation", status: "COMPLETED", outcome: { phone: "090 123 4567" } } })));
    vi.stubGlobal("fetch", fetch);
    await expect(parentMutation("/api/parent/schools/school/profile/phone", "PATCH", { phone: "090 123 4567" }, "key", "operation")).resolves.toMatchObject({ kind: "ok" });
    expect(fetch).toHaveBeenCalledWith("/api/parent/schools/school/profile/phone", expect.objectContaining({ method: "PATCH", credentials: "include", cache: "no-store", headers: expect.objectContaining({ "idempotency-key": "key", "x-operation-id": "operation", "x-csrf-token": "csrf-token" }) }));
  });
});
