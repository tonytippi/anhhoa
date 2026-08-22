---
title: 'Mo deep link ngan hang co fallback'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '1a38b11a051262abfd57aa5ba9757566136c7d73'
baseline_commit: '1a38b11a051262abfd57aa5ba9757566136c7d73'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-7-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Payment sheet da co VietQR, copy va PNG fallback, nhung Parent chua co cach mo app ngan hang khi server da xac nhan cau hinh tuong thich.

**Approach:** API doc cau hinh deep-link tuy chon, chi phat action tu locked payment snapshot khi cau hinh hop le; payment sheet chi hien CTA server-cap va giu nguyen QR/copy khi app ngan hang khong mo duoc.

## Boundaries & Constraints

**Always:** URI chi do API tao tu payment snapshot locked. Cau hinh phai co schema, version, expiry/revalidation, owner/cadence va support matrix; thieu, invalid, het han hoac unsupported thi tat deep-link ma khong chan bootstrap. Payment action la GET read-only, khong thay doi Hoa don hay bao thanh toan thanh cong. Client khong hard-code bank, URI template, support logic hay payment payload; CTA chi hien khi API tra action.

**Block If:** Khong co cach bieu dien cau hinh server ma van kiem tra duoc template, version, expiry/revalidation, owner/cadence va support matrix truoc khi tao URI.

**Never:** Khong them Parent payment confirmation, mutation invoice, bank list/template o `apps/parent-web`, hoac an VietQR/PNG/copy fallback khi deep link bi chan, app chua cai hay Parent quay lai PWA.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Config supported | Template hop le cho bank snapshot, con han va supported | Payment JSON co action deep-link server tao; sheet hien `Mo app ngan hang` | Khong mutation invoice |
| Config absent/invalid | Bien config thieu, JSON/schema/template/meta invalid, het han hay unsupported | API van bootstrap va bo qua deep-link action | VietQR, PNG va copy fields van day du |
| Mo app that bai | Browser chan URI, app chua cai hoac Parent quay lai PWA | Sheet giu mo, focus khong roi va hien fallback ngan gon | Bao quet QR hoac sao chep thong tin, khong bao thanh cong |
| Eligibility mat | Payment endpoint/revalidation tu choi | Dong sheet, xoa payload va refresh Parent data theo flow 7.2 | `401` xoa protected state va ve login |

</intent-contract>

## Code Map

- `apps/api/src/common/config/auth-config.ts` -- `AuthConfig` va `loadAuthConfig()` la ranh gioi parse environment; mo rong deep-link config optional fail-closed thay vi lam loi API bootstrap.
- `apps/api/src/common/config/auth-config.test.ts` -- regression cho config deep-link supported/invalid/expired va trang thai disable an toan.
- `apps/api/.env.example` -- mo ta bien deep-link JSON khong chua gia tri that.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- `paymentSnapshot()` la projection snapshot locked; `payment()` can them optional action server-generated, khong doc BankAccount/Student/Class mutable.
- `apps/api/src/modules/parent-portal/parent-portal.controller.test.ts` va `parent-portal.integration.test.ts` -- giu JSON/PNG contract va kiem tra action khong lam mutation/khong lo khi khong eligible.
- `apps/parent-web/src/api.ts` -- `ParentPaymentResponse` nhan action opaque tu server, khong them support detection o client.
- `apps/parent-web/src/app.tsx` -- `PaymentSheet()` la dialog co focus trap/copy/download; render CTA theo action va fallback feedback khi deep link khong mo duoc hay Parent quay lai.
- `apps/parent-web/src/app.test.tsx` -- tests sheet hien/an CTA va fallback, khang dinh QR/copy con kha dung va khong co completion UI.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyen Story 7.3 sang `done` sau khi verify va review.

## Tasks & Acceptance

**Execution:**
- `apps/api/src/common/config/auth-config.ts`, `apps/api/.env.example`, `apps/api/src/common/config/auth-config.test.ts` -- them parser config deep-link optional, validate metadata/support/template va fail closed de cau hinh loi chi vo hieu hoa CTA.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` va API tests -- inject config, tao action URI tu snapshot locked theo template da validate, mo rong JSON payment ma khong anh huong PNG, authorization hay lifecycle.
- `apps/parent-web/src/api.ts`, `apps/parent-web/src/app.tsx`, `apps/parent-web/src/app.test.tsx` -- render action server-provided, mo URI theo browser va bao fallback inline tren return/failure, giu dialog/QR/copy/download va accessibility hien co.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- danh dau Story 7.3 `done` sau implementation, verification va review thanh cong.

**Acceptance Criteria:**
- Given payment snapshot co bank deep-link config hop le va supported, when Parent mo payment sheet, then API tra URI duoc tao tu locked snapshot va UI hien `Mo app ngan hang` ma khong co bank/template hard-code o client.
- Given config thieu, invalid, expired, unowned, untested hoac unsupported, when API khoi dong va Parent lay payment, then API van phuc vu payment fallback nhung khong tra deep-link action.
- Given Parent chon deep-link va browser/app khong mo duoc hoac quay lai PWA, when sheet van active, then sheet hien fallback cu the, giu focus/QR/PNG/copy fields va khong bao thanh toan thanh cong.
- Given Parent dung deep-link, when API va Parent web tests chay, then tests chung minh action khong mutation invoice va eligibility/authorization denial van khong lo payment payload.

## Spec Change Log

Khong co thay doi spec sau planning.

## Review Triage Log

### 2026-08-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (medium 2, low 1)
- defer: 0
- reject: 11
- addressed_findings:
  - `[medium] [patch]` Chan URI `javascript:` va `data:`, va tu choi revalidation date sau expiry.
  - `[medium] [patch]` Render CTA bang React thay vi thao tac DOM truc tiep; chi hien fallback khi browser nem loi hoac Parent quay lai PWA.
  - `[low] [patch]` Tach feedback deep-link khoi copy/download va bo sung test fallback sau focus return.

## Design Notes

Config duoc dong goi trong mot bien JSON optional de cac quy tac support matrix va metadata duoc validate tai server, nhung absence hay malformed value chi tat enhancement. URI template su dung placeholder snapshot co whitelist, encode tung gia tri truoc khi noi, va client nhan mot URI opaque.

## Verification

**Commands:**
- `pnpm --dir apps/api test -- --runInBand` -- expected: config va Parent portal tests pass.
- `pnpm --dir apps/api typecheck` -- expected: API TypeScript type-check pass.
- `pnpm --dir apps/parent-web test` -- expected: Parent payment sheet regression tests pass.
- `pnpm --dir apps/parent-web typecheck` -- expected: Parent TypeScript type-check pass.
- `pnpm --dir apps/parent-web build` -- expected: Parent Vite PWA build pass.
- `git diff --check` -- expected: khong co whitespace error.

## Auto Run Result

- Summary: Them bank deep-link tuy chon, fail-closed va server-generated tu payment snapshot locked; Parent PWA chi hien CTA khi API tra action va luon giu VietQR, PNG, copy fallback.
- Files changed: API config va env example them config JSON optional; Parent portal them action URI; Parent PWA them CTA/fallback; API va PWA tests bao phu config, snapshot URI va fallback; sprint tracker danh dau Story 7.3 hoan thanh.
- Review findings: 3 patch da ap dung (medium 2, low 1); 0 defer; 11 reject. Follow-up review recommendation: true (medium 2, low 1, score 7).
- Verification: `pnpm --dir apps/api test` passed (28 files, 128 tests); `pnpm --dir apps/api typecheck` passed; `pnpm --dir apps/parent-web test` passed (20 tests); `pnpm --dir apps/parent-web typecheck` passed; `pnpm --dir apps/parent-web build` passed; `git diff --check` passed.
- Residual risks: Browser khong cho phep xac dinh dong bo app ngan hang da mo thanh cong; fallback chi hien khi navigation bi loi dong bo hoac Parent quay lai cua so PWA, va flow QR/copy van la fallback bat buoc.
