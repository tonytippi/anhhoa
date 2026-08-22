---
title: 'Chi tiet Hoa don va lich su thanh toan read-only'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: '6b418d6bb715b37c577530a3c80362ee86d5435c'
baseline_commit: '6b418d6bb715b37c577530a3c80362ee86d5435c'
review_loop_iteration: 0
followup_review_recommended: true
context:
  - '_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: []
deferred:
  - summary: >-
      Them Playwright E2E cho History va revoke Parent de bao phu browser flow cua Epic 6.
    evidence: |-
      Story 6.4 da co Parent PWA unit/UI regression tests, nhung epic context yeu cau Playwright bao phu Home/History, revoke va invoice states.
    location: >-
      apps/parent-web
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Parent PWA hien chi co Home `PENDING`; cac action `Xem Hoa don` va tab `Lich su` chua co route de Parent xem chi tiet read-only hoac cac Hoa don da hoan tat.

**Approach:** Mo rong Parent PWA doc API Parent da co de them detail cho `PENDING`/`COMPLETED` va History chi `COMPLETED`, giu URL filter, session/revoke boundary va giao dien mobile-first hien co.

## Boundaries & Constraints

**Always:** Chi dung Parent REST API va query key bat dau `parent`; detail chi render student snapshot, billing month, fee lines, total VND, payment method va status. History chi query `COMPLETED`, co pagination va filter student active/billing month dong bo query URL. Revalidate focus, foreground va protected view; `401` clear protected state truoc khi route login, revoke mot hoc sinh chi xoa detail/filter/data cua hoc sinh do neu con link active khac.

**Block If:** Parent API khong tra du lieu toi thieu cho detail/history ma khong can mo rong DTO read-only da dinh, hoac router/session hien co khong cho phep bao ve route ma khong lam lo protected state.

**Never:** Khong import `apps/web`, goi Admin endpoint, them mutation, audit/source Bank Account, payment payload, QR, VietQR, download, deep link, payment CTA/sheet hay hien `DRAFT`. Khong dung desktop table, sidebar hay cache protected REST response.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Invoice detail | Parent mo card `PENDING` hoac row `COMPLETED` duoc uy quyen | Mot `h1`, student snapshot, thang, dong phi, VND, phuong thuc va badge status read-only | `401` clear state va ve Dang nhap; deny/revoke khong hien du lieu cu |
| Cash pending | Detail invoice `PENDING` + `CASH` | Hien `Thanh toan tien mat tai nha truong` va khong co payment action | Khong query payment endpoint |
| Completed history | Parent mo `/history` va doi student/thang/trang | Chi row `COMPLETED`, filter student active va month trong URL, page theo API | Loi query hien retry state, khong coi la empty |
| Student revoke | Revalidation bo hoc sinh dang filter/detail | Xoa filter/row/detail cua hoc sinh do, giu session va hoc sinh active khac | Route Home/History an toan, khong hien cache revoked |

</intent-contract>

## Code Map

- `apps/parent-web/src/app.tsx` -- `App`, `Session`, `Home` va revalidation/session boundary hien co; them protected route detail/history, navigation tu card/tab va reuse `StudentSwitcher`, formatters, `ApiError`.
- `apps/parent-web/src/api.ts` -- `request`, Parent DTO va `pendingInvoices`; mo rong typed detail va completed list paginated/filter ma khong dung Admin client.
- `apps/parent-web/src/styles.css` -- Parent mobile shell/card/chip/nav va target 44px; them detail/history/filter/pager/status completed states theo token hien co.
- `apps/parent-web/src/app.test.tsx` -- regression Home/session hien co; them UI tests cho detail, CASH, History completed/filter URL/paging va 401/revoke.
- `apps/api/src/modules/parent-portal/parent-portal.controller.ts` -- contract `GET /parent/invoices` va `GET /parent/invoices/:invoiceId` da du Parent guard; khong sua endpoint.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- `invoices`, `invoice`, `serializeInvoice` da enforce authorization, pagination/filter, response minimization va denial opaque; chi tham chieu.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- doi Story 6.4 sang `done` va Epic 6 sang `done` sau verification/review thanh cong.

## Tasks & Acceptance

**Execution:**
- [x] `apps/parent-web/src/api.ts` -- them typed helpers detail va list `COMPLETED` co filter/page theo contract Parent API.
- [x] `apps/parent-web/src/app.tsx` -- them protected detail/History routes, navigation, URL state, pagination va revalidation/revoke handling, reuse authorization boundary.
- [x] `apps/parent-web/src/styles.css` -- them UI mobile-first accessible cho detail, History, filter va pager.
- [x] `apps/parent-web/src/app.test.tsx` -- bao phu matrix detail/history, status exclusion, URL filter/page, CASH, denial/401 va revoke.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- cap nhat Story 6.4 va Epic 6 khi workflow ket thuc.

**Acceptance Criteria:**
- Given Parent chon invoice duoc uy quyen, when detail tai, then chi hien thi snapshot Parent read-only va khong co admin, bank mutable hay edit controls.
- Given detail `PENDING` + `TRANSFER` hoac `CASH`, when render, then transfer khong co QR/payment CTA va CASH hien huong dan thanh toan tien mat.
- Given Parent mo Lich su, when filter/page thay doi, then chi `COMPLETED` hien thi va student/month context giu trong URL.
- Given Parent mat quyen khi o detail/History, when revalidation xong, then UI clear state cu; `401` ve login, revoke mot hoc sinh giu session cho cac hoc sinh con lai.
- Given Parent dung touch, keyboard hoac screen reader, when di chuyen Home/History/detail, then moi route chi co mot `h1`, status co text, VND doc duoc, nav ro tab hien tai va controls toi thieu 44px.

## Spec Change Log

Khong co thay doi spec sau planning.

## Review Triage Log

### 2026-08-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 2 (medium 2)
- defer: 1 (medium 1)
- reject: 11
- addressed_findings:
  - `[medium] [patch]` Chuan hoa `page`, `billingMonth` va `studentId` URL khong hop le truoc khi goi History API; dua trang vuot pham vi ve page server tra ve.
  - `[medium] [patch]` Chi render row `COMPLETED` cua hoc sinh con active de revoke khong de lo History cache cu trong luc revalidation.

## Design Notes

History phai de API loc `status=COMPLETED` va phan trang, khong tai toan bo rồi loc client. Chi chap nhan `studentId` dang nam trong danh sach students revalidated; query month chi gui khi dung dinh dang `YYYY-MM` de khop server validation.

## Verification

**Commands:**
- `pnpm --dir apps/parent-web test` -- expected: Parent shell, Home, detail va History tests pass.
- `pnpm --dir apps/parent-web build` -- expected: Vite TypeScript build pass.
- `pnpm --dir apps/api build` -- expected: Parent contract tiep tuc type-check pass.
- `git diff --check` -- expected: khong co whitespace error.

## Auto Run Result

- Summary: Them route Parent invoice detail read-only va History `COMPLETED` co filter student/thang, pagination URL, session/revoke revalidation va navigation mobile-first.
- Files changed: `apps/parent-web/src/api.ts` them typed Parent reads; `app.tsx`, `styles.css` them UI routes/states; `app.test.tsx` them regression coverage; sprint tracker va Story spec ghi ket qua.
- Review findings: 2 medium patch da ap dung; 1 medium defer (Playwright E2E coverage chua co); 11 finding khong ap dung hoac da duoc server contract bao ve. Follow-up review recommendation: true (medium 2, score 6).
- Verification: `pnpm --dir apps/parent-web test` passed (13 tests); `pnpm --dir apps/parent-web build` passed; `pnpm --dir apps/api build` passed; `git diff --check` passed.
- Residual risks: Parent PWA chi co unit/UI tests hien tai; Playwright E2E cho revoke va History la follow-up theo epic context. Parent API integration worker crash da duoc ghi nhan tu Story 6.2/6.3, khong nam trong diff nay.
