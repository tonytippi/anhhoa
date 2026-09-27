---
title: 'Tách Finance thành ba trang độc lập'
type: 'refactor'
created: '2026-09-27'
status: 'done'
baseline_commit: 'b402c894029dd5c67f0df678f8fe82408fee3236'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Trang Finance hiện gộp catalog khoản thu, cấu hình ưu đãi và quy trình Đợt thu vào một workspace lớn. Điều này trái với information architecture đã duyệt: ba destination table-first độc lập, làm tải dữ liệu và trạng thái của các nghiệp vụ không liên quan bị ghép với nhau.

**Approach:** Tách Finance thành ba trang sidebar server-authorized: `Khoản thu`, `Ưu đãi`, `Đợt thu`. Mỗi trang chỉ tải và sở hữu state/workflow thuộc domain của mình; Đợt thu vẫn là nơi chứa preview, generate và Invoice review deep-flow.

## Boundaries & Constraints

**Always:** Giữ API là nguồn duy nhất cho quyền, VND, preview, lifecycle, snapshot, audit và Operation. Navigation chỉ hiện khi API cấp `FINANCE_MANAGE`; deep link không được render dữ liệu trước khi context/navigaton được xác thực. Mỗi trang vẫn table-first, heading được focus khi route đổi, row action ở cột `Tùy chọn`, dialog trap/restore focus và switch guard chặn School change khi form dirty hoặc Operation pending. `Đợt thu` giữ server-authorized run/invoice order, preview -> READY -> generate reconciliation, Invoice review/issue/revision contextual; không tự tính hoặc cache giá/ưu đãi giữa các route.

**Ask First:** Tách Invoice review thành sidebar route riêng; đổi endpoint/API contract, capability, finance lifecycle, operation storage/reconciliation contract, schema/migration, hoặc đưa coverage refund/reversal sang trang Ưu đãi.

**Never:** Không giữ trang tổng hợp `Finance` như một destination chức năng, không tạo client-only navigation, không nới authorization qua route slug, không làm mất pending Operation khi đổi trang, không tự mang dữ liệu School cũ sang trang/School mới, và không đổi settlement/carry/coverage/refund correctness.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Finance capability | Context có `FINANCE_MANAGE` | Sidebar có riêng `Khoản thu`, `Ưu đãi`, `Đợt thu`, cùng `Thu tiền` và `Báo cáo`; mỗi link mở đúng workspace. | Thiếu navigation grant hoặc capability thì deep link fallback safe, không render Finance cũ. |
| Tải trang độc lập | Mở một trong ba route với School hợp lệ | Chỉ request dữ liệu trang đó; Khoản thu không tải policies/runs, Ưu đãi không tải runs, Đợt thu không tải policy assignment list ngoài dữ liệu server cần cho workflow. | Lỗi một trang chỉ hiển thị error của trang đó; School switch/revoke xóa state bảo vệ. |
| Thao tác chưa chắc chắn | Mutation Finance timeout/PENDING, sau đó đổi trang hoặc đổi School | Operation ID được giữ và reconciliation tiếp tục/được gọi từ switch guard; retry chỉ sau terminal outcome. | Không discard hoặc submit lặp; route/School stale không được dùng để reconcile. |
| Luồng Đợt thu | User mở run GENERATED rồi review Invoice | Detail, invoice queue và previous/next giữ server-returned originating order trong cùng Đợt thu. | Filter, denied Invoice hoặc School switch xóa detail/queue cũ trước safe state. |

</frozen-after-approval>

## Code Map

- `apps/api/src/modules/authorization/authorization.service.ts:26-37` -- nguồn navigation server-authorized; thay entry `finance` bằng `receivables`, `promotions`, `collection-runs`, giữ receipt queue/report.
- `apps/api/src/modules/authorization/authorization.service.test.ts` -- assertion navigation theo `FINANCE_MANAGE` cần kiểm tra đủ IDs/labels mới và capability gate.
- `apps/web/src/school-context.tsx:12-37, 246-252` -- allow-list route, rendering sidebar, workspace mount và School switch status; thêm ba View/routes và không để route cũ bypass grant.
- `apps/web/src/school-context.test.tsx` -- kiểm thử context navigation, protected deep link, heading focus và status guard khi tách destinations.
- `apps/web/src/finance/finance-workspace.tsx` -- nguồn implementation đang gộp. Tách catalog, promotion và CollectionRun UI/state/fetch theo ba workspace; chỉ trích shared request/CSRF/idempotency/reconciliation logic khi không làm lệch hành vi.
- `apps/web/src/finance/finance-workspace.test.tsx` -- regression suite hiện bao phủ cả ba domain; chia test theo workspace mới, giữ accessibility, stale School, validation, row menu và reconciliation assertions.
- `apps/web/e2e/finance-release-gate.spec.ts` -- release flow phải đi qua sidebar Khoản thu -> Ưu đãi -> Đợt thu, vẫn bảo toàn cross-School clear và timeout reconciliation proof.
- `apps/web/src/finance/receipt-queue-workspace.tsx`, `finance-reports-workspace.tsx` -- destinations độc lập sẵn có; giữ props/status behavior hiện hành.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/src/modules/authorization/authorization.service.ts`, `authorization.service.test.ts` -- cấp và kiểm tra ba navigation Finance riêng -- client chỉ có thể render destination server trả về.
- [x] `apps/web/src/school-context.tsx`, `school-context.test.tsx` -- thêm routes/side bar/mount cho `receivables`, `promotions`, `collection-runs`; gỡ destination tổng hợp và duy trì switch guard/status -- điều hướng an toàn, accessible, đúng capability.
- [x] `apps/web/src/finance/finance-workspace.tsx` cùng các workspace/shared helper mới cần thiết -- trích ba surface theo ownership dữ liệu và workflow -- cô lập load/error/state nhưng tái sử dụng command/reconcile chuẩn.
- [x] `apps/web/src/finance/*workspace.test.tsx` -- tách và cập nhật unit tests -- chứng minh catalog, policy assignment/version và run/invoice flow không còn phụ thuộc bề mặt chung.
- [x] `apps/web/e2e/finance-release-gate.spec.ts` -- điều hướng explicit qua ba sidebar destination -- giữ release evidence cross-School và Operation.

**Acceptance Criteria:**
- Given actor có `FINANCE_MANAGE`, when context tải, then sidebar render ba link `Khoản thu`, `Ưu đãi`, `Đợt thu` được API cấp và mỗi link có `aria-current` đúng route.
- Given actor mở từng destination, when dữ liệu tải, then chỉ dữ liệu/workflow của destination đó được render và failure của domain khác không chặn trang đang mở.
- Given actor không còn capability hoặc navigation item, when mở URL của một Finance route, then protected Finance state bị xóa và app về destination authorized an toàn.
- Given form hoặc Operation pending ở bất kỳ trang Finance nào, when actor đổi School, then switch guard dùng đúng dirty/pending status và reconciliation không tạo retry hay cross-School request.
- Given actor dùng Đợt thu, when đi từ run tới Invoice DRAFT và chọn previous/next, then thứ tự chỉ dựa trên server list của run và không thành sidebar item độc lập.

## Design Notes

Ba trang khớp mockup đã duyệt: `receivable-configuration.html`, `promotion-configuration.html`, `invoice-generation.html`. Không chuyển coverage reversal sang Ưu đãi vì mockup/contract hiện chỉ xác định policy/version/assignment cho destination đó; giữ behavior này ở contextual Finance flow cho đến khi có quyết định riêng.

## Verification

**Commands:**
- `pnpm --filter @passionedu/api test -- authorization.service.test.ts` -- expected: navigation Finance mới chỉ xuất hiện khi có capability.
- `pnpm --filter @passionedu/web test -- school-context.test.tsx finance` -- expected: routes, page isolation, dialogs, pending reconciliation và stale-state assertions pass.
- `pnpm --filter @passionedu/web test:e2e -- finance-release-gate.spec.ts` -- expected: sidebar flow, cross-School clear và release-gate Finance pass.
- `pnpm --filter @passionedu/web typecheck` -- expected: không còn reference route/workspace Finance tổng hợp.
- `git diff --check` -- expected: không có whitespace error.
