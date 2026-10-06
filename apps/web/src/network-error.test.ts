import { describe, expect, it, vi } from "vitest";
import { installNetworkErrorMessage, networkErrorMessage } from "./network-error";

describe("installNetworkErrorMessage", () => {
  it("rethrows an unreachable-server TypeError in Vietnamese and leaves other outcomes alone", async () => {
    const abort = new DOMException("aborted", "AbortError");
    const response = new Response("{}");
    const target = { fetch: vi.fn().mockRejectedValueOnce(new TypeError("Failed to fetch")).mockRejectedValueOnce(abort).mockResolvedValueOnce(response) };
    installNetworkErrorMessage(target as never);
    await expect(target.fetch("/api")).rejects.toMatchObject({ name: "TypeError", message: networkErrorMessage });
    await expect(target.fetch("/api")).rejects.toBe(abort);
    await expect(target.fetch("/api")).resolves.toBe(response);
  });
});
