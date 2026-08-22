---
title: 'Home hien thi Hoa don can thanh toan cua nhieu con'
type: 'feature'
created: '2026-08-22'
status: 'done'
baseline_revision: 'cace9a9494486ecf27e0516314d82c20fa2fb2b7'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '_bmad-output/implementation-artifacts/epic-6-context.md'
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** Parent PWA da co session va Parent read model, nhung Home van la placeholder nen Parent khong thay Hoa don `PENDING` cua cac con ngay sau khi dang nhap.

**Approach:** Dung Parent REST read model hien co de tai hoc sinh va Hoa don `PENDING`, render Home mobile-first theo tung hoc sinh voi switcher va cac trang thai loading, refresh, offline, empty; giu du lieu va session dung khi quyen cua mot hoc sinh bi revoke.

## Boundaries & Constraints

**Always:** Chi query va render `PENDING`; query keys Parent bat dau bang `parent`; protected data chi o React Query memory va `401` xoa client state roi ve Dang nhap. Home fetch du trang invoice phan trang va group theo invoice moi nhat, tie-break ten hoc sinh; card sap billing month moi nhat. Card/controls co keyboard va touch target toi thieu 44px, tong tien co VND va status co nhan chu.

**Block If:** Parent invoice API khong cung cap du lieu can thiet de phan biet hoc sinh, thang, tong VND va phuong thuc cho Home ma khong dung Admin API hay suy doan client.

**Never:** Khong import `apps/web`; khong them History/detail route, payment CTA/sheet, QR, deep link hay mutation invoice. Khong render `COMPLETED`, `DRAFT`, KPI, banner marketing hay card gia tren Home.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Multi-child pending | Parent co it nhat hai hoc sinh active va invoice `PENDING` | `Tat ca` mac dinh, group chi co hoc sinh co pending; moi card hien ten hoc sinh, thang, badge, tong VND va `Xem Hoa don` | Khong co loi |
| Student filter | Parent chon mot chip hoc sinh active | Invoice request loc dung `studentId`, UI chi hien group/card cua hoc sinh do | Giua filter hop le khi refresh thanh cong |
| Empty result | Khong co `PENDING` sau filter | Hien `Khong con Hoa don can thanh toan` va link `Xem lich su`, khong co card khac | Khong tao du lieu thay the |
| Revoke or expired session | Revalidation tra 401, hoac students khong con hoc sinh A trong khi B con active | 401 clear protected state va route login; revoke A xoa filter/group A, refresh B va giu session | Khong hien du lieu cache cua A sau revalidation |
| Offline or refresh | Browser offline hoac query refetch khi da co data | Offline banner mot lan; refresh giu card dang doc va hien indicator nho | Khong queue action hay coi cache la moi |

</intent-contract>

## Code Map

- `apps/parent-web/src/app.tsx` -- `Session` bootstrap Parent va placeholder Home hien tai; mo rong bang Home, query/revalidation va route noi bo ma khong doi session/logout contract.
- `apps/parent-web/src/api.ts` -- `request` credentialed va `clearClientSession`; them Parent DTO/query helper neu giup giu UI typed, khong dung Admin client.
- `apps/parent-web/src/styles.css` -- token Parent shell hien co; them layout mot cot, chips scroll ngang, group/card, skeleton, refresh va offline states.
- `apps/parent-web/src/app.test.tsx` -- regression login/logout hien co; them contract tests Home va revoke/session state.
- `apps/api/src/modules/parent-portal/parent-portal.service.ts` -- read contract da co cho `/parent/students` va `/parent/invoices`, list bounded page size va invoice DTO Parent; chi tham chieu, khong sua trong Story nay.

## Tasks & Acceptance

**Execution:**
- [x] `apps/parent-web/src/api.ts` -- khai bao DTO Parent read-only va helper tai students/invoices `PENDING`, bao gom toan bo trang de Home khong hien incomplete list.
- [x] `apps/parent-web/src/app.tsx` -- thay placeholder bang Home protected: switcher, group/card pending, filter, grouping/sort, empty/loading/refresh/offline va revalidation focus/foreground; clear state dung boundary `401` va revoke mot hoc sinh.
- [x] `apps/parent-web/src/styles.css` -- them presentation mobile-first va accessible states cho Home, khong thay doi visual language Parent da co.
- [x] `apps/parent-web/src/app.test.tsx` -- kiem thu Home multi-child/filter/order/card CASH/empty/loading va `401` clear protected surface.
- [x] `_bmad-output/implementation-artifacts/sprint-status.yaml` -- chuyen Story 6.3 sang `done` sau khi verification va review workflow thanh cong.

**Acceptance Criteria:**
- Given Parent dang nhap thanh cong, when Home tai, then route Trang chu co dung mot `h1` `Hoa don can thanh toan` va invoice `PENDING` duoc uu tien trong vung nhin thay dau tien.
- Given Parent co tu hai hoc sinh active, when Home hien thi, then switcher scroll ngang co `Tat ca` mac dinh va tung hoc sinh; o `Tat ca`, card luon ghi ro hoc sinh.
- Given nhieu hoc sinh va invoice pending, when data tai xong, then chi group hoc sinh co pending, group theo pending moi nhat roi ten hoc sinh va card trong group theo billing month moi nhat.
- Given card `TRANSFER` hop le hoac `CASH`, when Parent xem, then card hien thang, hoc sinh, `Can thanh toan`, tong VND va action `Xem Hoa don`; `CASH` hien huong dan tien mat va khong co transfer CTA.
- Given khong co pending, when Home tai xong, then empty state co copy va link lich su, khong co completed/draft/card gia.
- Given revoke mot hoc sinh trong khi con hoc sinh active khac, when app revalidate focus, foreground hoac protected view, then UI xoa hoc sinh revoke va giu session/du lieu con lai; 401 moi route login sau protected-state clear.

## Spec Change Log

Khong co thay doi spec sau planning.

## Design Notes

Home phai fetch het cac trang `PENDING` (page size API toi da 100) truoc khi ket luan group/order. API list da sap theo thoi diem tao moi nhat, nen phan tu pending dau tien cua moi group la khoa sap group; khong thay bang `billingMonth` vi khong tuong duong thoi diem tao.

## Verification

**Commands:**
- `pnpm --dir apps/parent-web test` -- expected: Parent shell va Home tests pass.
- `pnpm --dir apps/parent-web build` -- expected: Vite TypeScript build pass.
- `git diff --check` -- expected: khong co whitespace error.

## Review Triage Log

### 2026-08-22 - Review pass
- intent_gap: 0
- bad_spec: 0
- patch: 3 (medium 3)
- defer: 1 (medium 1)
- reject: 10
- addressed_findings:
  - `[medium] [patch]` Parent invoice DTO nay co `student.id`; Home group theo ID va loc lai theo active student de khong tron ten trung hoac hien du lieu cua hoc sinh bi revoke o `Tat ca`.
  - `[medium] [patch]` Them explicit non-401 error state va retry, thay vi hien empty state sai khi Parent API loi.
  - `[medium] [patch]` Loai bo refetch focus kep bang cach dung invalidate Parent queries duy nhat; tiep tuc revalidate focus va foreground.

## Auto Run Result

- Summary: Thay Parent Home placeholder bang danh sach Hoa don `PENDING` mobile-first, group theo hoc sinh, co switcher, empty/loading/refresh/offline state va clear protected state khi 401/revoke.
- Files changed: `apps/parent-web/src/app.tsx`, `api.ts`, `styles.css`, `app.test.tsx` cho Parent Home; `apps/api/src/modules/parent-portal/parent-portal.service.ts` va integration test them student ID toi thieu vao Parent invoice DTO; spec/context va sprint tracker ghi ket qua.
- Review findings: 3 patch medium da ap dung; 1 defer medium; 10 reject. Follow-up review recommendation: false (score 9, khong co high severity).
- Verification: `pnpm --dir apps/parent-web test` passed (8 tests); `pnpm --dir apps/parent-web build` passed; `pnpm --dir apps/api build` passed; `git diff --check` passed. Parent API integration suite khoi chay 115/116 tests roi Vitest/Nest worker crash, la loi runtime da duoc deferred tu Story 6.2.
- Residual risks: CTA `Xem Hoa don` chua co navigation vi invoice detail route thuoc Story 6.4; Parent API integration worker crash can duoc xu ly rieng truoc khi coi integration evidence la xanh.
