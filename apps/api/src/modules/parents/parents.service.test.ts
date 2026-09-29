import { describe, expect, it, vi } from "vitest";
import { ParentsService } from "./parents.service.js";

const school = "11111111-1111-4111-8111-111111111111";
const operation = "22222222-2222-4222-8222-222222222222";
const key = "33333333-3333-4333-8333-333333333333";

function service(overrides: Record<string, unknown> = {}) {
  const tx = {
    $queryRaw: vi.fn(),
    parentProfile: { findFirst: vi.fn().mockResolvedValue({ id: "parent", phone: "090 000 0000" }), update: vi.fn() },
    studentParent: { findFirst: vi.fn().mockResolvedValue({ id: "link" }) },
    operation: { create: vi.fn().mockResolvedValue({ id: operation }), update: vi.fn().mockResolvedValue({ id: operation, status: "COMPLETED", outcome: { phone: "090 123 4567" } }) },
    auditRecord: { create: vi.fn() },
  };
  const prisma = {
    parentProfile: tx.parentProfile,
    studentParent: tx.studentParent,
    operation: { findFirst: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(async (work) => work(tx)),
    ...overrides,
  };
  return { prisma, tx, parents: new ParentsService(prisma as never, {} as never) };
}

describe("ParentsService phone", () => {
  it("trims and updates only the bound Parent phone with a School-scoped Operation and audit", async () => {
    const { parents, tx } = service();
    await expect(parents.updateParentPhone("identity", school, key, operation, { phone: " 090 123 4567 " })).resolves.toEqual({ id: operation, status: "COMPLETED", outcome: { phone: "090 123 4567" } });
    expect(tx.parentProfile.update).toHaveBeenCalledWith({ where: { id: "parent" }, data: { phone: "090 123 4567" } });
    expect(tx.auditRecord.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ schoolId: school, action: "PARENT_PHONE_UPDATED", provenance: expect.objectContaining({ oldPhone: "090 000 0000", newPhone: "090 123 4567", operationId: operation }) }) }));
  });
  it("rejects malformed or surplus profile fields before creating an Operation", async () => {
    const { parents, prisma } = service();
    await expect(parents.updateParentPhone("identity", school, key, operation, { phone: "bad", email: "forbidden@example.com" })).rejects.toMatchObject({ response: { fieldErrors: { phone: expect.any(String) } } });
    expect((prisma as any).$transaction).not.toHaveBeenCalled();
  });
  it("replays equal fingerprints and conflicts changed idempotency reuse", async () => {
    const existing = { id: operation, status: "COMPLETED", fingerprint: expect.anything, outcome: { phone: "090 123 4567" } };
    const { parents, prisma } = service({ operation: { findFirst: vi.fn().mockResolvedValue({ ...existing, fingerprint: undefined }) } });
    const crypto = await import("node:crypto");
    (prisma as any).operation.findFirst.mockResolvedValue({ ...existing, fingerprint: crypto.createHash("sha256").update(JSON.stringify({ phone: "090 123 4567" })).digest("hex") });
    await expect(parents.updateParentPhone("identity", school, key, operation, { phone: "090 123 4567" })).resolves.toMatchObject({ id: operation });
    (prisma as any).operation.findFirst.mockResolvedValue({ ...existing, fingerprint: "other" });
    await expect(parents.updateParentPhone("identity", school, key, operation, { phone: "090 123 4567" })).rejects.toMatchObject({ response: { code: "IDEMPOTENCY_CONFLICT" } });
  });
});
