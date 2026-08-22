---
title: 'Story 5.2: Admin cap va thu hoi quyen Parent theo tung Hoc sinh'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '4e72569d160c0b69b50028438db85916257e8ae1'
baseline_commit: '4e72569d160c0b69b50028438db85916257e8ae1'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Admin chua co API va be mat tren chi tiet Hoc sinh de xem, cap, hay thu hoi lien ket Parent retained cua Story 5.1.

**Approach:** Them REST surface idempotent va man hinh chi tiet Hoc sinh dung lai lifecycle `ParentsService`, pattern auth/CSRF/operations hien co, va xu ly timeout bang doi soat operation.

## Boundaries & Constraints

**Always:** Chi hien thi link Parent cua Hoc sinh dang xem; grant chuan hoa email va validate toan bo danh sach truoc mot transaction; revoke chi `ACTIVE -> REVOKED`; mutation Admin bat buoc auth, origin, double-submit CSRF va UUID `Idempotency-Key`; replay cung key/cung request tra ket qua cu, key dung cho request khac tra conflict.

**Block If:** Pattern transaction cua `OperationsService` khong the ket hop voi batch grant ma van dam bao khong co thay doi mot phan.

**Never:** Hard-delete Parent/Student/link; them Parent OAuth/session/read API; hien thi Parent/Hoc sinh khong lien quan; tao UUID mutation moi khi operation timeout chua co terminal result; thay doi invoice lifecycle.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grant batch | Admin gui mot hoac nhieu email hop le cho Hoc sinh ton tai | Mot transaction tao/reactivate/giu active tung link va tra outcome theo email | Email invalid tu choi truoc khi link nao thay doi |
| Replay mutation | Cung Admin, route, key va request da complete | Tra response da luu, khong tao/sua link lan nua | Key khac request hoac route tra idempotency conflict |
| Thu hoi | Admin xac nhan link ACTIVE | Link thanh REVOKED, giu Parent va lich su revoke | Link khong active/khong ton tai tra loi domain phu hop |
| Timeout UI | POST co the da gui nhung client timeout | Giu trigger khoa, doi soat `GET /operations/:id`, chi retry khi server xac nhan chua ap dung | Khong gui lai bang UUID moi trong trang thai khong ro |

</intent-contract>

## Code Map

- `apps/api/src/modules/parents/parents.service.ts` -- lifecycle grant/reactivate/revoke serializable cua Story 5.1; mo rong batch/read/mutation idempotent, khong lap lai domain rules o controller.
- `apps/api/src/modules/parents/parents.module.ts` -- dang export service chua co HTTP surface; dang ky controller va `OperationsModule` dependency.
- `apps/api/src/modules/operations/operations.service.ts` -- fingerprint, acquire/replay va complete theo Admin+route trong transaction.
- `apps/api/src/modules/classes/classes.controller.ts` va `classes.service.ts` -- mau validate UUID header, `CurrentAdmin`, retry Prisma conflict va response operation.
- `apps/api/src/common/middleware/csrf.middleware.ts` va `common/guards/session-auth.guard.ts` -- global mutation protection va Admin auth, phai duoc ke thua khong bypass.
- `apps/api/src/modules/parents/parents.integration.test.ts` -- PostgreSQL fixture/lifecycle tests can mo rong cho batch va idempotency.
- `apps/web/src/features/students/page.tsx` va `api.ts` -- danh sach Hoc sinh hien co; them navigation/detail query client theo convention feature.
- `apps/web/src/features/classes/detail-page.tsx` va `api.ts` -- mau detail, dialog accessible, operation timeout reconciliation va sessionStorage reuse.
- `apps/web/src/app/app.tsx` -- router hash dang ky route `/hoc-sinh/:id`.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/parents/parents.dto.ts`, `parents.controller.ts`, `parents.service.ts`, `parents.module.ts` -- cung cap list scoped, batch grant va revoke Admin idempotent -- tao surface REST an toan dung lifecycle retained.
- [x] `apps/api/src/modules/parents/parents.integration.test.ts` va controller test moi -- bao phu atomic validation, outcomes, replay/conflict va security mutation -- ngan regression contract API.
- [x] `apps/web/src/features/students/api.ts`, `detail-page.tsx`, `detail-page.test.tsx`, `page.tsx`, `app/app.tsx` -- them route/detail, list Parent scoped, grant form, revoke modal va recovery timeout -- hoan tat be mat Admin accessible.
- [x] `apps/web/e2e/students.spec.ts` -- kiem thu luong Admin tren browser va header mutation -- bao ve integration CSRF/idempotency.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- danh dau Story 5.2 done sau khi verification/review dat -- dong bo tracker.

**Acceptance Criteria:**
- Given Admin mo chi tiet Hoc sinh, when Parent section tai thanh cong, then chi email Parent lien ket va status `ACTIVE`/`REVOKED` cua Hoc sinh do hien thi.
- Given Admin gui batch email hop le, when grant hoan tat, then mot transaction tra outcome created/reactivated/active theo tung email va link co hieu luc ngay.
- Given batch co email invalid, when API validate request, then tra error shape chuan truoc khi bat ky lien ket nao doi.
- Given Admin thu hoi link ACTIVE, when modal co email va Hoc sinh duoc xac nhan, then UI khoa dialog trong luc gui va API luu link REVOKED ma khong xoa du lieu.
- Given grant/revoke mutation thieu origin, CSRF, UUID idempotency hoac auth, when request den API, then request bi tu choi; given retry hop le cung key/request, then ket qua da luu duoc replay.
- Given client timeout sau mutation, when operation chua terminal, then UI doi soat cung operation id va khong retry bang request moi.

## Spec Change Log

## Review Triage Log

### 2026-08-22 — Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 2)
- defer: 0
- reject: 15
- addressed_findings:
  - `[medium] [patch]` Giu va doi soat operation UUID cho moi loi transport/server khong xac dinh; luu du context mutation, khong ghi de pending khac, va tu choi gui neu sessionStorage khong luu duoc.
  - `[medium] [patch]` Them parser response Parent/mutation chat, trang thai/empty state de hieu, Link router, va test revoke + reconcile; mo rong integration revoke replay/conflict/Admin not found.

## Design Notes

Batch validation can dien ra truoc transaction de bao dam email sai khong tao mutation mot phan. Chi sau khi danh sach hop le, service transaction dung `OperationsService` va lifecycle `grant`/`revoke`; response luu operation phai la JSON serializable DTO, khong tra Prisma object tho.

## Verification

**Commands:**
- `pnpm --filter api prisma:generate` -- expected: Prisma client generate thanh cong.
- `pnpm --filter api test:integration` -- expected: Parents API va integration suite pass.
- `pnpm --filter api build` -- expected: Nest API compile/typecheck thanh cong.
- `pnpm --filter web test` -- expected: unit tests cua detail Parent va suite web pass.
- `pnpm --filter web build` -- expected: Vite production build thanh cong.

## Auto Run Result

- Summary: Da them REST va UI quan ly lien ket Parent theo tung Hoc sinh, bao gom batch grant, revoke retained, idempotency va timeout reconciliation.
- Files changed:
  - `apps/api/src/modules/parents/parents.controller.ts`, `parents.dto.ts`, `parents.module.ts`, `parents.service.ts` -- Parent REST surface scoped va lifecycle mutation idempotent.
  - `apps/api/src/modules/parents/parents.integration.test.ts` -- grant/revoke transaction va idempotency contracts.
  - `apps/web/src/features/students/api.ts`, `detail-page.tsx`, `detail-page.test.tsx`, `page.tsx`, `app/app.tsx` -- Student detail Parent surface, client parsing va recovery mutation.
  - `apps/web/e2e/students.spec.ts` -- browser flow grant voi CSRF/idempotency.
  - `_bmad-output/implementation-artifacts/sprint-status.yaml` -- Story 5.2 done.
- Review findings: 2 medium patches da ap dung; 0 deferred; 15 rejected vi la test-depth/scale hardening ngoai can thiet cua Story hoac da duoc bao phu boi contract/pattern co san.
- Follow-up review recommendation: true (patched high: 0; patched medium: 2; patched low: 0; score: 6).
- Verification: `pnpm --filter api prisma:generate`, `pnpm --filter api test:integration` (8 files, 44 tests), `pnpm --filter api build`, `pnpm --filter web test`, `pnpm --filter web build`, va `pnpm --filter web test:e2e -- students.spec.ts` (28 tests) deu pass. `git diff --check` pass.
- Residual risks: E2E wrapper hien chay toan bo Playwright suite thay vi chi file duoc truyen; proxy warning cua cac test mock song song khong lam suite that bai.

## Suggested Review Order

**Mutation Idempotent**

- Batch grant va revoke dung chung transaction operation de replay an toan.
  [`parents.service.ts:15`](../../apps/api/src/modules/parents/parents.service.ts#L15)

- HTTP surface nested giu scope theo hoc sinh va bat buoc UUID key.
  [`parents.controller.ts:14`](../../apps/api/src/modules/parents/parents.controller.ts#L14)

**Admin Detail Surface**

- Detail khoa mutation chua ro va doi soat dung operation UUID da luu.
  [`detail-page.tsx:14`](../../apps/web/src/features/students/detail-page.tsx#L14)

- API client tach query scoped va mutation co idempotency header.
  [`api.ts:35`](../../apps/web/src/features/students/api.ts#L35)

- Route detail duoc mo tu danh sach hoc sinh hien co.
  [`app.tsx:56`](../../apps/web/src/app/app.tsx#L56)

**Regression Coverage**

- PostgreSQL tests chung minh validation truoc mutation va replay khong duplicate.
  [`parents.integration.test.ts:80`](../../apps/api/src/modules/parents/parents.integration.test.ts#L80)

- Browser test kiem tra grant detail cung CSRF va idempotency header.
  [`students.spec.ts:37`](../../apps/web/e2e/students.spec.ts#L37)
