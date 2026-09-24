---
title: 'Đồng bộ mockup Finance Admin MVP Pha 1'
type: 'refactor'
created: '2026-09-24'
status: 'in-review'
review_loop_iteration: 0
baseline_revision: 'eba10e0ae76199ad7821a7a02cd7a72237448cfd'
baseline_commit: 'eba10e0ae76199ad7821a7a02cd7a72237448cfd'
context:
  - '_bmad-output/planning-artifacts/epics-passionedu.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/epic-5-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hai mockup Finance đang trộn Finance Admin MVP với service enrollment, PromotionPolicy, actual Receipt, settlement carry va reporting. Admin cần có hai bề mặt rõ ràng để cấu hình khoản thu và lập/phát hành đợt thu trước khi Parent hoặc Teacher app là dependency.

**Approach:** Đồng bộ Epic 5, Experience Spine, mockup coverage và hai mockup Admin về Pha 1: `Khoản thu` chỉ quản lý catalog; `Đợt thu` chỉ mở, chọn Student, preview, generate, review và issue. Giữ placeholder/deep-link cho review Invoice theo ngữ cảnh Đợt thu, nhưng không biểu diễn functionality settlement chưa có.

## Boundaries & Constraints

**Always:** School và SchoolYear đang chọn phải hiển thị; `FINANCE_MANAGE`, server-authoritative preview/generate/VND, immutable Invoice khi issue, CSRF/idempotency/Operation reconciliation và dirty School-switch guard không đổi. Hai destination là `Khoản thu` và `Đợt thu`; Invoice review là contextual deep destination, không phải sidebar item.

**Ask First:** Đưa service enrollment, bulk assignment, ChargeRule automation, PromotionPolicy, actual Receipt, KPI `Đã nhận`/`Còn thiếu`, SettlementDifference/carry hoặc reporting vào Pha 1; thay đổi lifecycle/amount computation hay quy tắc authorization.

**Never:** Không để mockup Pha 1 hướng dẫn Admin tự tính eligibility, fee, total, actual receipt, outstanding, settlement outcome hay carry trên browser. Không để tab dịch vụ/ưu đãi, KPI settlement, hoặc copy tự động xử lý chênh lệch xuất hiện như action có sẵn. Không sửa canonical PRD, Architecture Spine, SPEC hoặc Epic 6.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|---------------------------|----------------|
| Mở Khoản thu Pha 1 | Finance-authorized actor, School context | Heading/caption chỉ rõ School/SchoolYear; bảng catalog và action tạo/chỉnh sửa/ngừng áp dụng | Không render dịch vụ/ưu đãi như control hiện hành |
| Mở Đợt thu Pha 1 | Finance-authorized actor, SchoolYear | Landing table-first, filter, tạo/mở run và deep-link detail/Invoice review theo context | Không hiển thị thực thu, còn thiếu, carry hay Receipt action |
| Timeout hoặc context đổi | Form run/catalog dirty hay Operation chưa chắc chắn | Copy yêu cầu reconcile Operation, guard giữ context an toàn | Không tuyên bố local success hoặc render School cũ |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/epics-passionedu.md:225-239,853-997` -- Epic 5 canonical scope và AC cần nêu hai destination Pha 1/release-gate UI.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:28,65-66,127-139,242-250` -- behavior Finance, lifecycle và flow cần phân biệt Pha 1 với settlement sau MVP.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:18-20` -- inventory build input cần mô tả bề mặt Pha 1.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` -- mockup Khoản thu phải bỏ tabs/dữ liệu service, ưu đãi và scope automation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html` -- mockup Đợt thu phải bỏ actual-receipt/carry/KPI settlement và input scope/receivable client-owned.

## Tasks & Acceptance

**Execution:**
- [x] `epics-passionedu.md` -- ghi rõ Pha 1 có hai Finance Admin destinations và release-gate UI -- nối catalog/run workflow mà không đổi domain scope.
- [x] `EXPERIENCE.md`, `MOCKUP-COVERAGE.md` -- xác định layout, deep-link và unavailable surface của Pha 1 -- mockup không thành contract cho enhancement.
- [x] `mockups/admin/receivable-configuration.html` -- rút về catalog table-first -- loại service/policy automation control chưa có server contract.
- [x] `mockups/admin/invoice-generation.html` -- rút về CollectionRun landing/create dialog và contextual review -- loại settlement KPI, carry notice và client-owned scope/receivable selection.
- [x] `test-rendered-mockup-contracts.mjs` -- bổ sung static assertion cho Pha 1 boundary nếu suite đã kiểm mockup -- ngăn regression UX contract.

**Acceptance Criteria:**
- Given Finance mở hai mockup Pha 1, when quét sidebar, heading, action và table, then thấy rõ `Khoản thu` hoặc `Đợt thu`, School/SchoolYear và các action thuộc Finance Admin MVP; Invoice review chỉ vào từ Đợt thu.
- Given mockup Pha 1, when chưa có Epic 6 settlement implementation, then không có `Đã nhận`, `Còn thiếu`, Receipt, carry, actual amount hay hướng dẫn tự xử lý chênh lệch; server là authority của mọi VND và lifecycle.
- Given Finance đang tạo catalog/run hoặc reconcile Operation, when đổi School, timeout hay lifecycle conflict, then UX yêu cầu giữ context/đối soát server và không hiển thị kết quả local hoặc School cũ.

## Design Notes

Pha 1 dùng cùng visual language table-first của mockup: heading ngắn, primary action cạnh heading, filter trước bảng và dialog một cấp. `Khoản thu` không cần tab nếu chỉ một capability hiện có; `Đợt thu` chỉ mở một monthly run, sau đó detail quản lý Student/preview/invoice theo server response.

## Verification

**Commands:**
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript mockup hợp lệ.
- `pnpm test:mockups` -- expected: static Finance mockup contract pass.
- `git diff --check` -- expected: không có whitespace error.

**Manual checks:**
- Mở hai HTML trực tiếp, kiểm tra shell route, heading, table-first layout, mobile horizontal scroll và không còn control/copy settlement, service hay ưu đãi.
