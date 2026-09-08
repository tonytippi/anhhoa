---
title: 'Chuẩn hóa UX mockup Danh bộ'
type: 'refactor'
created: '2026-09-07'
status: 'done'
baseline_commit: '44a74e9ccd9f7cfb1e38e3df5b3c7b319388510c'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sáu mockup Danh bộ đã mô tả đúng nhiều boundary nghiệp vụ nhưng bề mặt mặc định còn lộ lifecycle/mã kỹ thuật, h1 thiếu ngữ cảnh Trường, list chưa có filter URL/pagination thực và một số action/validation/school-switch guard không có hành vi mô phỏng tương ứng.

**Approach:** Chuẩn hóa cụm mockup Danh bộ thành các màn hình quản trị tiếng Việt ngắn, table-first và dùng shared Admin shell. List và form có ngữ cảnh Trường/năm học rõ, filter/search/sort/page có thể review qua URL, còn các thao tác nhạy cảm dùng server-result/reconciliation mock an toàn mà không thay đổi policy hay model nghiệp vụ.

## Boundaries & Constraints

**Always:** Giữ sáu static HTML direct-open, `data-admin-route="roster"`, relative assets hiện có, shared shell, fixture Trường Ánh Hoa/năm học 2026-2027 và table responsive. Mỗi route dùng một `h1` có Trường Ánh Hoa; mặc định chỉ dùng nhãn Việt nghiệp vụ ngắn, không hiện `AH-*`, enum/lifecycle English, API hoặc implementation term. Mã/fact audit chỉ trong disclosure `Thông tin đối soát` khi cần. Danh sách Danh bộ phải có form controls accessible, URL state cho tìm/lọc/sắp xếp/trang, caption, trạng thái chữ và pagination rõ. Giữ Student tách Enrollment, mã Student server-sinh/bất biến, interval/lịch sử, một SchoolYear active, Class thuộc SchoolYear, Parent profile/invitation tách StudentParent link, Staff profile/assignment tách login/grant, và transition preview/server result/history nguồn.

**Ask First:** Đổi enrollment lifecycle, SchoolYear/Class effective-date rule, Parent authorization, Staff membership/grant/capability, transition/close-year policy, API hoặc dữ liệu fixture nền.

**Never:** Không dùng browser state làm bằng chứng School authorization; không tạo mã học sinh, local placeholder hoặc hard-delete lịch sử; không ngụ ý Parent/Staff có login, role hay capability do profile/link/assignment; không force-move record bị preview loại; không retry trước khi Operation có kết quả; không đưa attendance, handover hoặc finance mutation vào Danh bộ.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Danh sách Danh bộ | Admin tìm/lọc/sắp xếp học sinh theo năm, lớp, trạng thái hoặc trang | URL và bảng cùng phản ánh filter; title/caption nêu Trường và phạm vi đang xem. | Không có bản ghi hiển thị empty state theo ngữ cảnh, không suy luận lifecycle hay tạo record cục bộ. |
| Năm học/lớp | Form có xung đột active hoặc effective date | Giữ giá trị đã nhập, error summary focus được và liên kết tới trường lỗi. | Không báo thành công/local placeholder trước kết quả server. |
| Parent và Staff | Xem profile/link/assignment chờ xử lý, đã hiệu lực hoặc bị thu hồi | Bảng phân biệt lời mời/profile với quyền liên kết; profile và phân công không ngụ ý quyền đăng nhập. | Thiếu grant/capability chỉ nêu trạng thái server-returned, không hiện action không có quyền. |
| Chuyển danh bộ | Preview có bản ghi chuyển được và bản ghi loại | Bảng nêu kết quả bằng tiếng Việt, record bị loại không có action; confirm có named confirmation. | Timeout/pending khóa thao tác, đối soát outcome rồi mới render kết quả/history hoặc cho retry. |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster.html` -- landing list: thay filter presentation/mã/lifecycle bằng form URL state, table theo kết quả và pagination.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/school-year-classes.html` -- thêm heading context, copy Việt và error summary/link/focus có hành vi.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/student-enrollment.html` -- giữ Student/Enrollment/history, đổi lifecycle/mã mặc định sang fact nghiệp vụ/disclosure.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/student-parent-links.html` -- phân biệt profile/invitation với StudentParent link, Việt hóa status và giữ revoke reconciliation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/staff-assignments.html` -- giữ profile/assignment hiệu lực, thêm read state grant/binding/capability và copy Việt.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/roster-transition.html` -- Việt hóa preview/result, named confirmation và reuse Operation lock/reconciliation.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- thêm dirty-form listener, filter render, confirm/error focus behavior chỉ dùng chung cho mockup.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md` -- đồng bộ mô tả status/entry behavior; `_bmad-output/implementation-artifacts/test-roster-ux.mjs` -- behavioral matrix test DOM shim.

## Tasks & Acceptance

**Execution:**
- [x] Sáu file `.../admin/roster/*.html` -- chuẩn hóa heading, Vietnamese-first copy, disclosure, table/route states và action semantics -- làm cụm Danh bộ nhất quán/reviewable.
- [x] `.../mockups/prototype.js` -- hỗ trợ dirty form, error focus/link, confirm và roster URL/render behavior -- thực thi các trạng thái mockup đã hiển thị.
- [x] `.../mockups/MOCKUP-COVERAGE.md` -- sửa inventory/status wording -- mô tả đúng contract roster mới.
- [x] `_bmad-output/implementation-artifacts/test-roster-ux.mjs` -- kiểm tra matrix list/filter/empty, error focus, switch guard và transition pending/terminal outcome -- tránh regression chỉ bằng kiểm tra chuỗi.

**Acceptance Criteria:**
- Given Admin mở bất kỳ route Danh bộ nào, when quét h1, status, table và action, then thấy Trường Ánh Hoa, nhãn Việt ngắn và không có mã/lifecycle English mặc định.
- Given Admin điều khiển list Danh bộ, when tìm/lọc/sắp xếp/chọn trang, then URL và hàng bảng phản ánh cùng phạm vi hoặc empty state có ngữ cảnh.
- Given form có lỗi hoặc dữ liệu chưa lưu, when submit lỗi hoặc đổi Trường, then error summary được focus/liên kết field hoặc switch guard nêu lựa chọn an toàn.
- Given Parent/Staff/transition state cần review, when xem hoặc thao tác, then UI giữ tách biệt record và quyền, không cho force/retry khi outcome Operation chưa rõ, và chỉ cập nhật theo terminal mock outcome.

## Design Notes

`Đang học`, `Chờ xếp lớp`, `Sắp nhập học`, `Tạm nghỉ`, `Đã thôi học`, `Đã rời trường`, `Đang hiệu lực`, `Đã thu hồi` là nhãn surface; enum/mã không phải label thao tác. Card chỉ tóm tắt boundary hoặc quyết định; bảng dùng cho học sinh, lớp, liên kết, assignment và preview. Lời mời Parent là trạng thái liên hệ/binding, không thay thế fact quyền StudentParent; Staff grant/capability chỉ là server-returned read state.

## Verification

**Commands:**
- `git diff --check` -- expected: không có lỗi whitespace.
- `node --check _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/prototype.js` -- expected: JavaScript mockup hợp lệ.
- `npx --yes html-validate _bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/roster/*.html` -- expected: sáu HTML Danh bộ hợp lệ.
- `node _bmad-output/implementation-artifacts/test-roster-ux.mjs` -- expected: matrix behavior pass.

**Manual checks:**
- Mở từng trang bằng Preview, thử URL list/filter/page, error summary, đổi Trường khi form đã sửa, và preview/confirm/reconcile transition.
- Kiểm tra bảng ngang trên viewport hẹp, skip link, keyboard focus/dialog return focus và disclosure đối soát.
