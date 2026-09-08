---
title: 'Danh sách nhận xét hằng ngày của Giáo viên'
type: 'feature'
created: '2026-09-07'
status: 'done'
baseline_commit: 'e1b381f019f0b000c28a3839bdc648e55f24e38c'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Teacher đã có editor nhận xét theo từng trẻ nhưng trang lớp chỉ nêu tổng số `Đã nhận xét`, khiến Giáo viên không biết trẻ nào còn cần hoàn tất hoặc nhanh chóng quay lại current journal theo ngày/lớp đang chọn.

**Approach:** Bổ sung danh sách trạng thái nhận xét ngay trong class-day Teacher: tìm theo tên/mã trẻ, lọc `Tất cả`/`Chưa có nhận xét`/`Đã có nhận xét`, count/empty state và CTA đúng editor. Danh sách chỉ phản chiếu Student đã được server authorization; trạng thái chỉ đổi sau terminal journal reconciliation.

## Boundaries & Constraints

**Always:** Giữ Teacher mobile-first, class/date được phân công, privacy note, current journal per Student/date, same-day audited version, JPEG/PNG/WebP tối đa 10 MB/tệp và idempotency/reconciliation hiện có. Chỉ dùng hai trạng thái presentation `Chưa có nhận xét` và `Đã có nhận xét`; label `Đã có nhận xét` chỉ là current journal server-confirmed, không là state machine mới hay Parent-visible flag. CTA chưa có journal là `Viết nhận xét`; CTA current journal là `Xem/Sửa nhận xét`. Search chỉ lọc các row đã render/được cấp quyền; empty state giữ class/date và không diễn giải authorization/server error thành không có nhận xét. Sau terminal save, row cập nhật current status/time từ mock server result; pending/unknown không đổi list. Revoke phải tiếp tục xóa list/filter/editor/dialog/navigation/context theo safe-state hiện có.

**Ask First:** Đổi DailyJournal lifecycle/current-version, assignment/capability, Parent DTO/privacy/retention, journal media policy, date/class navigation, hoặc thêm publish/review/approval state.

**Never:** Không thêm Admin/Parent mutation, custom journal status, audit/version history, Teacher identity, attendance evidence, storage/media URL hoặc browser authorization. Không hiển thị local draft như Parent-visible/current journal, không bypass class/date/School scope qua search/filter/hash.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Class-day load | Teacher có class/date được phân công | List nêu lớp/ngày/count; mỗi trẻ có đúng trạng thái journal và CTA editor tương ứng. | Không có journal không suy diễn attendance hay authorization failure. |
| Search và filter | Teacher nhập tên/mã hoặc lọc trạng thái | Chỉ row được authorization và khớp điều kiện hiện; count/caption cập nhật. | Không khớp hiện empty state có class/date và action xóa filter. |
| Lưu nhận xét | Teacher gửi journal cho trẻ chưa có | Row vẫn `Chưa có nhận xét` đến khi terminal outcome; sau đó là `Đã có nhận xét` với thời điểm hệ thống xác nhận. | Pending/timeout khóa retry và giữ list cũ đến reconciliation. |
| Revoke | Binding/capability/assignment bị thu hồi | List, filter, editor, dialog và School context bị xóa trước safe state. | Hash cũ không khôi phục dữ liệu trẻ. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html:21-44` -- thêm journal list controls/status/count/empty và row metadata/CTA trong class-day; giữ editor/per-student privacy copy.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js:37-118,295-310` -- tái dùng terminal Operation/revoke; thêm Teacher journal filter/render và row update sau journal terminal result.
- `_bmad-output/implementation-artifacts/test-teacher-attendance-ux.mjs` -- mở rộng JSDOM coverage cho journal list/filter/empty/editor/reconciliation/revoke.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md:21,33` -- mô tả coverage list trạng thái journal nếu cần.

## Tasks & Acceptance

**Execution:**
- [x] `.../mockups/teacher/teacher.html` -- thêm journal list trong class-day với search/filter/count/empty/status/CTA -- giúp Teacher biết công việc còn lại theo ngày.
- [x] `.../mockups/prototype.js` -- render/lọc journal list và cập nhật row chỉ sau terminal journal outcome -- giữ server-authoritative mock behavior.
- [x] `_bmad-output/implementation-artifacts/test-teacher-attendance-ux.mjs` -- kiểm tra matrix journal list cùng revoke/evidence behavior có sẵn -- chống regression privacy/reconciliation.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- đồng bộ inventory Teacher -- ghi nhận danh sách tiến độ journal.

**Acceptance Criteria:**
- Given Teacher mở class-day được phân công, when quét danh sách nhận xét, then thấy class/date/count, `Chưa có nhận xét` hoặc `Đã có nhận xét`, và CTA editor đúng từng trẻ.
- Given Teacher tìm/lọc nhận xét, when không có match hoặc kết hợp điều kiện, then visible rows/count/empty state cùng phạm vi mà không lộ hoặc fetch Student ngoài class.
- Given Teacher lưu nhận xét, when outcome pending hay terminal, then list không optimistic update; chỉ terminal mock result mới đổi status/time/CTA.
- Given revoke bất kỳ lúc nào, when list/editor/dialog đang mở, then safe-state cleanup hiện có xóa toàn bộ journal list/filter/data và hash không khôi phục chúng.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: behavior hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/teacher/teacher.html` -- expected: HTML hợp lệ.
- `node _bmad-output/implementation-artifacts/test-teacher-attendance-ux.mjs` -- expected: attendance, journal list và revoke matrix pass.

**Manual checks:**
- Mở class-day ở mobile width, thử search/filter/empty/reset, save journal/reconcile, mở editor và revoke khi list/filter/editor/dialog đang mở.
