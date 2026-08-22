---
title: 'Cung cap payment snapshot va VietQR cho Parent'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'a3f602bec192be203a3eca2276e748e06b736ea1'
baseline_commit: 'a3f602bec192be203a3eca2276e748e06b736ea1'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Hoa don chuyen khoan hien chi khoa mot phan snapshot va QR o Admin DTO. Parent chua co API an toan de nhan huong dan chuyen khoan hoac tai ma VietQR tu du lieu da khoa.

**Approach:** Hoan chinh va validate payment snapshot ngay trong transition `DRAFT -> PENDING`, sau do them Parent payment read endpoint chi dung snapshot nay cho JSON DTO va PNG VietQR, voi authorization va eligibility hien co.

## Boundaries & Constraints

**Always:** Luu va validate atomically tong VND, bank code, so tai khoan, chu tai khoan, noi dung chuyen khoan va invoice student/class snapshots truoc khi `TRANSFER` chuyen `PENDING`. Parent payment route chi cho Parent `ACTIVE` co `StudentParent.ACTIVE` voi invoice `PENDING` + `TRANSFER` co snapshot day du; khong doc join BankAccount, Student hay Class de lap response. `Accept: image/png` dung cung guard, tra `Cache-Control: no-store` va filename `anh-hoa-<invoiceId>.png`. Tat ca payment reads la read-only va khong thay doi lifecycle.

**Block If:** QR PNG khong the duoc sinh bang dependency da co hoac dependency da khai bao ma khong them mot dich vu ben ngoai hay mot runtime native khong duoc architecture cho phep.

**Never:** Khong them Parent UI/payment sheet, deep link, Parent confirmation, mutation invoice, cache payment response, Admin endpoint moi, hoac fallback doc payment data tu source mutable. Khong tiet lo payload hay su ton tai invoice khong duoc uy quyen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Lock snapshot | `DRAFT` `TRANSFER` co bank active va du lieu day du | Chuyen `PENDING` va ghi full snapshot, gom transfer content, trong cung transaction | Du lieu bat buoc blank/invalid tu choi transition, khong co partial snapshot |
| Payment DTO | Parent active, link active, invoice `PENDING` `TRANSFER` snapshot hop le | `GET /api/parent/invoices/:invoiceId/payment` tra DTO toi thieu chi tu invoice snapshot va VietQR data | UUID/authorization/eligibility bi tu choi opaque, khong tra payload |
| PNG | Cung invoice eligible, `Accept: image/png` | Tra PNG VietQR, `Content-Disposition: attachment; filename="anh-hoa-<invoiceId>.png"`, `Cache-Control: no-store` | Loi tao PNG tra error chuan; khong fallback sang mutable source |
| Eligibility mat | `DRAFT`, `COMPLETED`, `CASH`, snapshot thieu/invalid, revoke | Payment route khong tra JSON hay PNG | Khong lo student/invoice data; invoice quay `DRAFT`/`COMPLETED` bi tu choi ngay |

</intent-contract>

## Code Map

- `apps/api/prisma/schema.prisma` -- `Invoice` giu money/student/class snapshot va payment snapshot; them persisted transfer-content snapshot neu can cho immutable payment contract.
- `apps/api/prisma/migrations/20260819140000_add_invoice_payment_snapshots/migration.sql` -- migration gan nhat cua payment snapshot; dung lam mau cho migration additive va backfill an toan.
- `apps/api/src/modules/invoices/invoices.service.ts` -- `moveToPending`, `snapshotPayment`, `transferContent`, `safeMoney`, `serializeDetail`; mot noi duy nhat validate va khoa snapshot `TRANSFER`.
- `apps/api/src/modules/invoices/invoices.integration.test.ts` -- regression PostgreSQL cho snapshot retention, transition ve `DRAFT` va mutable sources.
- `apps/api/src/modules/invoices/invoices.service.test.ts` -- unit coverage validation transition va snapshot malformed.
- `apps/api/src/modules/parent-portal/parent-portal.controller.ts` -- Parent guarded read routes; them content negotiation cho payment route, khong dung Admin guard/controller.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- `invoice`/`assertStudent` va projection Parent hien co; them authorized payment projection/eligibility/serialization chi tu invoice snapshot.
- `apps/api/src/modules/parent-portal/parent-portal.integration.test.ts` -- PostgreSQL contract Parent, authorization opaque va DTO minimization; them payment JSON/PNG/denial coverage.
- `apps/api/src/modules/parent-portal/parent-portal.controller.test.ts` -- bao ve ParentSessionGuard va response route contract.
- `apps/api/package.json` -- kiem tra dependency QR PNG JavaScript thuan; chi them dependency neu can thiet de API tao PNG server-side.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- doi Story 7.1 sang `done` sau review/verification thanh cong.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` va migration moi -- them snapshot `transferContent` immutable va migration/backfill phu hop de data persisted khop contract.
- [x] `apps/api/src/modules/invoices/invoices.service.ts` -- validate day du transfer snapshot va ghi atomically khi `DRAFT -> PENDING`; giu lifecycle va snapshot retention hien co.
- [x] `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- them payment query/DTO/eligibility tu invoice snapshot va VietQR payload/PNG, khong join source mutable.
- [x] `apps/api/src/modules/parent-portal/parent-portal.controller.ts` -- them `GET /parent/invoices/:invoiceId/payment`, negotiate JSON/PNG va headers download/no-store.
- [x] `apps/api/src/modules/invoices/invoices.service.test.ts` va `invoices.integration.test.ts` -- bao phu snapshot complete/invalid va retention sau mutable source change.
- [x] `apps/api/src/modules/parent-portal/parent-portal.controller.test.ts` va `parent-portal.integration.test.ts` -- bao phu Parent guard, JSON/PNG headers, invoice state/method/snapshot/authorization denial va no mutation.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- cap nhat Story 7.1 khi workflow ket thuc.

**Acceptance Criteria:**
- Given Admin chuyen invoice `DRAFT` `TRANSFER` sang `PENDING`, when bat ky payment field bat buoc invalid, then transition bi tu choi va khong co partial payment snapshot.
- Given Parent active duoc uy quyen voi invoice eligible, when goi payment route, then DTO toi thieu va VietQR chi duoc lap tu locked invoice snapshot.
- Given Parent gui `Accept: image/png` cho cung invoice, when endpoint thanh cong, then API tra PNG voi filename va `no-store` chinh xac ma khong mutation invoice.
- Given invoice ineligible hoac Parent mat authorization, when goi JSON hay PNG payment route, then khong tra payment payload hay tiet lo tai nguyen.
- Given student, class hoac Bank Account source thay doi sau khi pending, when Parent tai payment data, then payment data van phan anh snapshot da khoa.

## Spec Change Log

Khong co thay doi spec sau planning.

## Review Triage Log

### 2026-08-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 6 (medium 6)
- defer: 0
- reject: 14
- addressed_findings:
  - `[medium] [patch]` Chi chon PNG khi `Accept: image/png`; default va wildcard tra JSON, co `Vary: Accept` va JSON giu `vietQr` server-generated.
  - `[medium] [patch]` Snapshot bank khong ho tro VietQR duoc coi la ineligible opaque denial; QR PNG duoc `await` trong error boundary.
  - `[medium] [patch]` Trim va persist gia tri bank da validate; tu choi student/class snapshot blank truoc khi transition `PENDING`.
  - `[medium] [patch]` Han che backfill vao transfer snapshot `PENDING` day du va bank VietQR hop le, khong ghi de du lieu da co.
  - `[medium] [patch]` Them coverage payment/paymentPng cho DRAFT, COMPLETED, CASH, snapshot malformed, bank unsupported, invoice hoc sinh khac, unknown va revoke.
  - `[medium] [patch]` Them regression cho snapshot lifecycle da khoa khi Student, Class va Bank Account nguon thay doi/inactive va controller content negotiation.

## Design Notes

`transferContent` phai duoc persisted trong invoice thay vi suy ra luc Parent request, de contract khong phu thuoc cach dat ten hoc sinh/lop hay logic source trong tuong lai. Payment projection can select truc tiep invoice fields va kiem tra eligibility truoc khi serialize, de denial khong tao Parent DTO mot phan.

## Verification

**Commands:**
- `pnpm --dir apps/api test -- src/modules/invoices/invoices.service.test.ts src/modules/parent-portal/parent-portal.controller.test.ts` -- expected: unit/controller contracts pass.
- `pnpm --dir apps/api test:integration` -- expected: PostgreSQL invoice va Parent payment contracts pass.
- `pnpm --dir apps/api typecheck` -- expected: API TypeScript type-check pass.
- `git diff --check` -- expected: khong co whitespace error.

## Auto Run Result

- Summary: Khoa them immutable transfer content khi Hoa don `TRANSFER` chuyen `PENDING`; cung cap Parent payment JSON va VietQR PNG chi tu invoice snapshot da khoa.
- Files changed: Prisma schema/migration bo sung transfer-content snapshot; invoice lifecycle validate va normalize snapshot; Parent portal them payment JSON/PNG route va authorization eligibility; API dependencies va tests cap nhat; sprint tracker va workflow artifacts ghi completion.
- Review findings: 6 medium patch da ap dung; 0 defer; 14 reject. Follow-up review recommendation: true (medium 6, score 18).
- Verification: `pnpm --dir apps/api test -- src/modules/invoices/invoices.service.test.ts src/modules/parent-portal/parent-portal.controller.test.ts` passed (28 files, 120 tests); `pnpm --dir apps/api typecheck` passed; `pnpm --dir apps/api test:integration` passed (9 files, 52 tests); `git diff --check` passed.
- Residual risks: Controller contract test la direct controller test do Nest HTTP bootstrap tung lam Vitest worker dung trong moi truong nay; PostgreSQL integration van xac nhan lifecycle, authorization, JSON payload va PNG generation o service boundary.
