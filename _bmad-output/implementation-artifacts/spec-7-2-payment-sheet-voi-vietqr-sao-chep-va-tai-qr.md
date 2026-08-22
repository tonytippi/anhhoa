---
title: 'Payment sheet voi VietQR, sao chep va tai QR'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '2c6e45e1e7af8d942f8d3b2430193a7da7ab3c37'
baseline_commit: '2c6e45e1e7af8d942f8d3b2430193a7da7ab3c37'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Parent PWA da xem duoc Hoa don chuyen khoan, nhung chua co be mat an toan de lay payment snapshot da duoc API uy quyen, quet VietQR, sao chep tung truong, hoac tai PNG.

**Approach:** Them payment sheet read-only tren Parent PWA, chi mo sau khi payment endpoint xac nhan eligibility; hien thi QR server-authoritative, cac fallback copy va download PNG, khong thay doi Hoa don.

## Boundaries & Constraints

**Always:** CTA chi hien cho invoice `PENDING` + `TRANSFER`; sheet chi dung payload tu `GET /api/parent/invoices/:invoiceId/payment`, giu payload trong memory va xoa/dong ngay khi `401`, revoke hoac eligibility mat. Dialog co name/description, focus trap, return focus, Esc tren desktop, live feedback va target toi thieu 44px. QR alt text gom ten Hoc sinh va so tien; moi truong payment co control copy rieng. PNG phai duoc tai qua payment route voi `Accept: image/png` va cookie session. Footer luon hien `Dang cho nha truong xac nhan`.

**Block If:** Payment JSON/PNG contract cua Story 7.1 khong con tra duoc snapshot locked hoac khong con phan biet eligibility tu loi session, vi client khong duoc tu suy dien du lieu thanh toan.

**Never:** Khong tao QR tu account/source model o client, cache payment/protected REST data, them Parent confirmation hay mutation invoice, hien thanh toan thanh cong, hoac them bank deep link/supported-bank logic (Story 7.3).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mo sheet | CTA cua `PENDING` + `TRANSFER`, payment JSON eligible | Sheet hien student/month/status/total, VietQR va 5 copy fields tu API | Sheet chi mo sau JSON thanh cong |
| Copy field | Parent chon mot control copy | Gia tri dung cua truong duoc gui clipboard, co live feedback | Clipboard loi hien loi inline, focus giu tren control |
| Tai PNG | Parent chon `Tai ma QR` | GET cookie-auth voi `Accept: image/png`, download filename API cap | Loi download giu sheet/copy fields, hien loi inline va cho retry |
| Eligibility mat | Revalidate/payment tra `COMPLETED`, `DRAFT`, non-transfer, snapshot invalid, revoke hoac `401` | Xoa payment query/payload, dong sheet, refresh invoice surfaces | `COMPLETED` thong bao nha truong da xac nhan; truong hop khac thong bao huong dan khong con kha dung; `401` theo luong logout hien co |

</intent-contract>

## Code Map

- `apps/parent-web/src/app.tsx` -- `HomeContent`, `InvoiceReadOnly`, session revalidation va invoice queries; them CTA, state/payment query, sheet lifecycle va invalidation ma khong thay doi route protection hien co.
- `apps/parent-web/src/api.ts` -- `request` parse JSON cookie-auth; them typed payment JSON reader va PNG blob download reader tach rieng de khong parse binary bang JSON.
- `apps/parent-web/src/styles.css` -- token Parent va controls 44px hien co; them backdrop, mobile bottom-sheet/desktop dialog, QR/copy rows va inline status theo visual system Parent.
- `apps/parent-web/src/app.test.tsx` -- Vitest/Testing Library fetch mocks; them coverage payment sheet, clipboard, PNG download failure/success, accessibility close va eligibility/revoke cleanup.
- `apps/api/src/modules/parent-portal/parent-portal.controller.ts` -- read-only contract da co: explicit `Accept: image/png` tra attachment/no-store, con lai JSON; khong sua API cho Story nay.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- payment DTO `{ data, vietQr }` da chi projection tu snapshot locked; client khong duoc bo sung source data.

## Tasks & Acceptance

**Execution:**
- `apps/parent-web/src/api.ts` -- khai bao payment DTO va them GET JSON/PNG helpers cookie-auth, bao toan API error de UI phan biet authorization/eligibility va binary download.
- `apps/parent-web/src/app.tsx` -- them CTA `Chuyen tien` o card/detail transfer pending, payment dialog va query chi enabled khi mo; render QR tu `vietQr`, nam truong snapshot, copy/download feedback, focus management va cleanup/revalidation theo state transition.
- `apps/parent-web/src/styles.css` -- style sheet responsive mobile-first, dialog semantic controls va accessible feedback theo token Parent.
- `apps/parent-web/src/app.test.tsx` -- kiem thu happy path, nam copy controls, PNG request/download va failure retry, dialog keyboard/focus, 401 va invoice eligibility/revoke cleanup; chung minh khong co payment confirmation/mutation UI.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyen Story 7.2 sang `done` chi sau implementation, verification va review thanh cong.

**Acceptance Criteria:**
- Given Parent chon `Chuyen tien` tren Hoa don `PENDING` + `TRANSFER`, when API xac nhan payment eligible, then payment bottom sheet hien snapshot server-authoritative va VietQR, khong dung du lieu source o client.
- Given sheet mo voi payload hop le, when Parent dung touch, keyboard hoac screen reader, then co nam copy controls, QR alt text, dialog focus behavior va footer `Dang cho nha truong xac nhan` ma khong co action xac nhan thanh toan.
- Given Parent tai PNG, when API thanh cong hoac that bai, then request dung `Accept: image/png` va cookie-auth; thanh cong tai file ma khong doi invoice, con that bai giu sheet/copy fallback va cho retry.
- Given sheet dang mo va payment khong con eligible hoac Parent bi revoke, when revalidation phat hien thay doi, then payload bi xoa, sheet dong va invoice surfaces refresh voi thong bao dung; `401` xoa protected state va ve login.

## Spec Change Log

Khong co thay doi spec sau planning.

## Review Triage Log

### 2026-08-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 10 (medium 7, low 3)
- defer: 0
- reject: 7
- addressed_findings:
  - `[medium] [patch]` Chi render payment dialog sau khi payment JSON xac nhan eligibility; CTA hien pending state accessible trong luc kiem tra.
  - `[medium] [patch]` Tach loi transient cua payment JSON thanh inline retry thay vi dong sheet nhu eligibility denial.
  - `[medium] [patch]` Xoa payment query khi component unmount; denial dong sheet, return focus va revalidate Parent queries.
  - `[medium] [patch]` PNG download chong click lap, xu ly denial/401 theo authorization state thay vi loi retryable.
  - `[medium] [patch]` Tao/remove anchor va revoke blob URL trong `finally` de download on dinh va khong ro ri memory.
  - `[medium] [patch]` Mo rong focus trap cho focusable controls, them focusin guard va accessible title/description luon ton tai.
  - `[low] [patch]` Them regression tests cho eligibility pending/retry, PNG duplicate/denial va cleanup sheet.

## Design Notes

Payment query la authorization check tai thoi diem mo, khong phai du lieu de client tu quyet dinh eligibility. Download PNG dung fetch/blob tach khoi JSON wrapper de giu `Accept` va error handling chinh xac. Dialog tu implement theo pattern focus cua Admin nhung giu layout/token Parent tach biet.

## Verification

**Commands:**
- `pnpm --dir apps/parent-web test` -- expected: Parent PWA unit/UI tests, bao gom payment sheet, pass.
- `pnpm --dir apps/parent-web typecheck` -- expected: Parent TypeScript type-check pass.
- `pnpm --dir apps/parent-web build` -- expected: Parent Vite PWA build pass.
- `git diff --check` -- expected: khong co whitespace error.

## Auto Run Result

- Summary: Them payment sheet read-only cho Hoa don `PENDING` + `TRANSFER`, lay snapshot/VietQR tu Parent payment endpoint, sao chep 5 truong va tai PNG an toan.
- Files changed: Parent API client them typed payment JSON/PNG readers; Parent app them CTA, dialog accessible, QR, copy, download va cleanup eligibility; styles them sheet responsive; tests them payment regressions; dependency `qrcode.react` va lockfile cap nhat; sprint tracker ghi completion.
- Review findings: 10 patch da ap dung (medium 7, low 3); 0 defer; 7 reject. Follow-up review recommendation: true (medium 7, low 3, score 24).
- Verification: `pnpm --dir apps/parent-web test` passed (1 file, 19 tests); `pnpm --dir apps/parent-web typecheck` passed; `pnpm --dir apps/parent-web build` passed; `git diff --check` passed.
- Residual risks: Payment API hien tra opaque denial, nen UI chi hien thong diep unavailable cho eligibility denial khong co status invoice moi; revalidation Parent surface se lay trang thai chinh xac tu API.
