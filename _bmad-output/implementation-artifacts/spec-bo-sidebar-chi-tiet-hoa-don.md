---
title: 'Bỏ Invoice detail khỏi sidebar Finance'
type: 'refactor'
created: '2026-09-11'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2cefeee5f1378cde8ef02620349d930fb06f6d58'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sidebar Admin đang mở trực tiếp `invoice-detail-review.html` ở fixture của Bé An qua hai mục `Rà soát hóa đơn` và `Thu tiền / Công nợ`. Invoice detail không có Invoice/Student selection nên đây là destination sai ngữ cảnh và khiến một trang detail bị hiểu nhầm là workspace.

**Approach:** Sidebar Finance chỉ đi tới workspace cấp danh sách `Đợt thu`; operator chọn run, Student rồi Invoice trước khi mở Invoice detail hoặc thao tác thu tiền. Giữ Invoice detail là deep destination theo selection, đồng thời bảo đảm mockup có một Invoice đã phát hành còn phải thu để receipt flow không mất entry hợp lệ.

## Boundaries & Constraints

**Always:** Giữ `CollectionRun → Student → Invoice/projection` là mental model; sidebar chỉ mở workspace cấp danh sách; Invoice/Receipt luôn có Student và Invoice context trước khi render; giữ server-authoritative, exact-settlement và disclosure audit; UI không hiển thị `PREPAID` là run/flow riêng trên Đợt thu.

**Ask First:** Hỏi trước khi thêm một workspace Finance mới, đổi canonical Finance lifecycle, hay chuyển một task settlement thành action không bắt đầu từ Student/Invoice đã chọn.

**Never:** Không xóa `invoice-detail-review.html`; không để bất cứ sidebar item nào trỏ trực tiếp đến `invoice-detail-review.html` hay `#draft/#issued/#receipt`; không sửa implementation specs đã `done` để viết lại lịch sử; không thêm backend/schema/API.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở Finance từ sidebar | Operator chọn mục Finance | Vào `invoice-generation.html`, landing list các Đợt thu; không render một Student fixture | N/A |
| Review Invoice nháp | Operator mở một Student có Invoice `DRAFT` từ run detail | Link có context dẫn đến `invoice-detail-review.html#draft`; detail cho phép review/issue theo quyền | Server lifecycle conflict refreshes detail; không local override |
| Ghi nhận thu | Operator mở Student có Invoice `ISSUED` còn thiếu | Row action dẫn tới `#receipt` từ selected Invoice; receipt giữ exact amount/single-Student facts | Validation chặn partial, excess, mixed-Student, unallocated posting |
| Invoice đã thu đủ | Operator mở Student có `PAID` Invoice | Chỉ đọc Invoice snapshot; không hiện CTA thu tiền | Không phát sinh một settlement action nữa |
| Học sinh được coverage | Student không tạo Invoice | Projection chỉ đọc; không có Invoice/receipt link | Giải thích ngắn trong projection disclosure |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js:10-32` -- nguồn tập trung của sidebar Finance; hiện chứa hai direct-detail destinations cần bỏ/gộp.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html:18-38` -- landing CollectionRun và bảng Student; giữ deep Invoice links, thêm fixture/action cho Invoice `ISSUED` còn thiếu nếu cần.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html:12-46` -- Invoice detail state fixtures; phải còn reachable chỉ từ selected row, không là sidebar route.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:369-377,527-571` -- hash state Invoice và mở/đóng CollectionRun detail; không đổi lifecycle hash trừ khi bắt buộc cho deep-link context.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:20-21` -- inventory cần phân biệt workspace sidebar và contextual detail.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md:27-28,61-64,128-131` -- canonical IA/lifecycle contract để làm rõ sidebar-vs-detail.
- `_bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs:55-97` -- static Finance contract tests; thêm assertion sidebar không direct-link detail và settlement deep link hợp lệ.

## Tasks & Acceptance

**Execution:**
- [x] `mockups/admin/admin-shell.js` -- thay ba navigation entry Finance cũ bằng các workspace list hợp lý; không còn route/sidebar entry cho invoice detail hay receipt fixture -- ngăn destination thiếu context.
- [x] `mockups/admin/invoice-generation.html` -- giữ bảng detail theo Student là cửa vào Invoice; thêm fixture Invoice `ISSUED` còn outstanding với row action `Thu tiền`, trong khi `PAID` chỉ có `Hóa đơn` và projection vẫn chỉ đọc -- giữ receipt bắt đầu từ selection thực tế.
- [x] `mockups/admin/invoice-detail-review.html` -- đổi route declaration để không tự nhận là sidebar route, thêm Back contextual về Đợt thu nếu chưa có, và loại link/staging copy nộp trước stale -- detail độc lập nhưng không standalone workspace.
- [x] `MOCKUP-COVERAGE.md` và `EXPERIENCE.md` -- ghi rõ sidebar mở list workspace; Invoice review và receipt chỉ xuất hiện sau Student/Invoice selection -- bảo toàn IA canonical.
- [x] `test-rendered-mockup-contracts.mjs` -- cover sidebar destination, valid deep links và absence của direct Invoice-detail sidebar link -- ngăn regression static.

**Acceptance Criteria:**
- Given operator chọn bất kỳ mục Tài chính nào trên sidebar, when route mở, then destination là một workspace list/configuration chứ không là Invoice của một Student fixture.
- Given operator mở Đợt thu rồi chọn Student có Invoice nháp, when chọn `Hóa đơn`, then Invoice draft detail mở và sidebar không coi detail là một top-level route.
- Given Student có Invoice đã phát hành còn thiếu, when chọn `Thu tiền`, then receipt detail mở với invoice/student exact-settlement context; given Invoice đã thu đủ, then row không có CTA thu tiền.
- Given Student không có Invoice vì coverage, when mở row projection, then không có Invoice zero-value hoặc action settlement.
- Given static contract checks chạy, when mockup navigation/deep links được kiểm tra, then direct sidebar links tới `invoice-detail-review.html` bị reject và các Finance lifecycle checks hiện có vẫn pass.

## Design Notes

Finance sidebar là cửa vào workspace, không là một record. `invoice-generation.html` giữ active navigation `runs` khi operator drill down nội bộ; khi sang Invoice detail không cần active sidebar item vì navigation không khẳng định một detail là module độc lập. Receipt không là một sidebar destination: nó là task tiếp theo của Student/Invoice `ISSUED` đã chọn.

## Verification

**Commands:**
- `node _bmad-output/implementation-artifacts/test-rendered-mockup-contracts.mjs` -- expected: Finance navigation, Invoice deep links và các contract mockup đều pass.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js` -- expected: JavaScript syntax hợp lệ.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript syntax hợp lệ.
- `git diff --check` -- expected: không có whitespace error.

## Suggested Review Order

**Finance entry and drill-down**

- Sidebar opens a list workspace, never a fixture Invoice or Receipt.
  [`admin-shell.js:16`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/admin-shell.js#L16)

- Student rows are the only entry to contextual Invoice and Receipt work.
  [`invoice-generation.html:33`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-generation.html#L33)

- Detail states retain selected Student context and a route back to Đợt thu.
  [`invoice-detail-review.html:12`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/invoice-detail-review.html#L12)

**Lifecycle and documentation**

- Hash router explicitly recognizes the read-only paid Invoice state.
  [`prototype.js:369`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js#L369)

- UX contract distinguishes sidebar workspaces from contextual Invoice/Receipt destinations.
  [`EXPERIENCE.md:61`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L61)

- Coverage inventory records the same Finance entry and deep-detail boundary.
  [`MOCKUP-COVERAGE.md:20`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L20)

**Regression protection**

- Static checks reject direct sidebar detail links and verify selected-row actions.
  [`test-rendered-mockup-contracts.mjs:55`](test-rendered-mockup-contracts.mjs#L55)
