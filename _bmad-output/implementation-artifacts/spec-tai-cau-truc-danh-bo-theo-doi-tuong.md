---
title: 'Tái cấu trúc Danh bộ theo đối tượng quản lý'
type: 'refactor'
created: '2026-09-22'
status: 'done'
baseline_commit: 'c1cf377c02a765b5821f41c519e11ced4e81cec2'
review_loop_iteration: 0
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/roster-and-people-catalog.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Workspace `Danh bộ` hiện xếp lẫn danh mục chức danh/capability và năm học với hồ sơ học sinh, phụ huynh, nhân sự và lớp. Các nhóm không có submenu sidebar nên người dùng không có điểm vào rõ theo đối tượng; vì vậy bề mặt này bị hiểu như một trang cấu hình trường, không phải nơi quản lý danh bộ vận hành hằng ngày.

**Approach:** Tổ chức sidebar thành hai nhóm collapse độc lập: `Danh bộ` chứa Học sinh, Phụ huynh, Nhân viên và Lớp học; `Cấu hình trường` chứa Năm học, Chức danh & capability và các cấu hình policy hiện có. Mỗi submenu chọn một bề mặt quản lý tập trung; giữ nguyên API, phân quyền và mô hình nghiệp vụ trong phạm vi thay đổi IA/UI.

## Boundaries & Constraints

**Always:** Dùng API server-authoritative hiện có; School vẫn là tenant root, mọi dữ liệu chỉ được tải trong School context được API cấp quyền. Sidebar có nhóm collapse accessible bằng keyboard, giữ trạng thái active/expanded rõ và không làm mất guard dirty/pending khi đổi submenu. Danh bộ phải có các điểm vào rõ cho Học sinh, Phụ huynh, Nhân viên và Lớp học; phụ huynh vẫn là hồ sơ + liên kết StudentParent nhiều-nhiều, nhân sự vẫn tách profile khỏi membership/grant, học sinh vẫn tách Student khỏi enrollment. Lớp thuộc năm học: màn Lớp học dùng năm học làm ngữ cảnh bắt buộc nhưng không quản lý vòng đời năm học. Cấu hình trường sở hữu thao tác Năm học, Chức danh & capability. Giữ CSRF, idempotency và đối soát Operation; không optimistic update.

**Ask First:** Tạo API danh sách phụ huynh độc lập toàn trường, thay đổi capability/role, đổi lifecycle enrollment, hoặc tách một module nhân sự/HR độc lập khỏi Danh bộ.

**Never:** Không chuyển capability, grant hay membership thành “chức danh” hiển thị cho người dùng; không cấp login/quyền chỉ vì tạo giáo viên/phụ huynh; không thay đổi schema, endpoint, authorization hay dữ liệu seed để chỉ phục vụ tái bố cục; không hard-delete profile, liên kết, assignment hay lịch sử; không đưa Năm học, chức danh/capability, policy/finance/attendance vào Danh bộ; không giả lập danh sách phụ huynh toàn trường khi API chỉ trả parent link theo học sinh.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Mở sidebar | Admin được server trả navigation và chọn một trường | `Danh bộ` và `Cấu hình trường` là hai group collapse; Danh bộ có submenu Học sinh, Phụ huynh, Nhân viên, Lớp học; Cấu hình trường có Năm học, Chức danh & capability và policy hiện có. | Chỉ render/cho chọn submenu mà capability server cấp; group đóng/mở không đổi School context hay bypass guard. |
| Quản lý học sinh | Admin chọn năm học/lớp rồi thêm hoặc cập nhật enrollment | Danh sách và form học sinh vẫn dùng năm học/lớp như dữ liệu vận hành hỗ trợ; lịch sử enrollment và parent link giữ nguyên. | Lỗi server giữ form và focus summary; năm học đóng vẫn chỉ đọc. |
| Quản lý phụ huynh | Admin mở submenu Phụ huynh, chọn năm học nếu cần | UI tổng hợp các parent link server trả về cho học sinh trong phạm vi đang xem, nêu rõ đây là Phụ huynh liên kết; cho đi tới học sinh/liên kết để quản lý. | Không mô tả một parent là có quyền/login nếu link/grant chưa được server xác nhận; empty state không suy diễn không có Parent toàn trường. |
| Quản lý nhân sự/lớp | Admin mở submenu Nhân viên hoặc Lớp học | Danh sách/profile/assignment là trọng tâm nhân sự; màn lớp quản lý lớp của năm học chọn sẵn. Chức danh chỉ là dữ liệu tham chiếu, còn tạo/sửa capability ở Cấu hình trường. | Không có quyền hoặc dữ liệu thì giữ safe empty/read state, không phát sinh quyền cục bộ. |

</frozen-after-approval>

## Code Map

- `apps/web/src/school-context.tsx` -- shell chọn School, navigation server-projected và guard khi đổi trường. Mở rộng navigation thành two-level collapsible sidebar, giữ capability gating và gắn mỗi submenu với view cụ thể.
- `apps/web/src/roster/roster-workspace.tsx` -- hiện render tuần tự `Danh mục chức danh`, nhân sự, năm học/lớp, học sinh, parent link, assignment và transition (bắt đầu khoảng dòng 1121). Tách thành các view Học sinh, Phụ huynh, Nhân viên/Giáo viên, Lớp học; bỏ quản trị year/position khỏi đây.
- `apps/web/src/settings/settings-workspace.tsx` -- bề mặt `Cấu hình trường` hiện có; nhận thêm các view Năm học và Chức danh & capability từ RosterWorkspace, cùng navigation nội bộ/props cần thiết, nhưng không trộn policy setting vào roster.
- `apps/web/src/index.css` -- style workspace và pseudo-label navigation roster/settings; thay bằng style sidebar group/submenu collapse, active/focus state và responsive layout mà không làm hỏng table/form hiện có.
- `apps/web/src/roster/roster-workspace.test.tsx` -- fixture và test hành vi create/list/history/closed year/transition; cập nhật theo từng roster submenu và thêm regression people-first.
- `apps/web/src/settings/settings-workspace.test.tsx` và `apps/web/src/school-context.test.tsx` -- kiểm tra các view cấu hình vừa chuyển, sidebar collapse/active/capability gating và guard switch.
- `apps/api/src/modules/roster/roster.controller.ts` -- bằng chứng API roster đã scope theo School và hiện có list students/staff/parent links; không đổi endpoint trong refactor này.
- `docs/roster-and-people-catalog.md` -- contract IA: Danh bộ gồm Học sinh, Phụ huynh, Nhân viên, Năm học; ràng buộc aggregate và quyền cần giữ.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/school-context.tsx` -- thay flat navigation bằng sidebar group collapse: Danh bộ (Học sinh, Phụ huynh, Nhân viên/Giáo viên, Lớp học) và Cấu hình trường (Năm học, Chức danh & capability, policy); quản lý active/expanded state an toàn qua school switch và capability gating -- tạo IA đúng yêu cầu mà không làm mất context guard.
- [x] `apps/web/src/roster/roster-workspace.tsx` -- nhận roster submenu/view để mỗi destination có heading/context nghiệp vụ tương ứng, trong khi tái dùng toàn bộ command/API server-authoritative hiện có cho Học sinh, Phụ huynh, Nhân viên/Giáo viên, Lớp học, Năm học và Chức danh/capability -- đưa destination cấu hình vào đúng group sidebar mà không thay đổi contract API.
- [x] `apps/web/src/index.css` -- triển khai sidebar group/submenu collapse accessible, active/focus state và responsive layout; phân vùng presentation theo submenu, giữ table/form hiện có dùng được trên màn hình hẹp -- bảo đảm navigation mới có thể sử dụng.
- [x] `apps/web/src/school-context.test.tsx` -- cập nhật test theo submenu và thêm assertion Danh bộ có đủ các destination people/class, đồng thời giữ test capability gating và guard/hành vi server-authoritative -- phòng regression IA lẫn boundary bảo mật.

**Acceptance Criteria:**
- Given School Admin mở sidebar sau khi chọn trường, when mở/đóng Danh bộ hoặc Cấu hình trường, then thấy submenu đúng group, trạng thái expanded/current rõ cho screen reader và keyboard, và nội dung group còn lại không bị render như active view.
- Given Admin chọn Danh bộ, when xem submenu, then có Học sinh, Phụ huynh, Nhân viên và Lớp học; không có Năm học hay Chức danh & capability.
- Given Admin chọn Cấu hình trường, when xem submenu, then có Năm học, Chức danh & capability và các policy hiện có; thao tác tạo/sửa Năm học hoặc capability hoạt động bằng API/Operation hiện hữu.
- Given Admin cần tạo/xem học sinh, quản lý lớp hoặc phân công giáo viên, when chọn submenu tương ứng, then có thể dùng year/class context cần thiết mà không nhầm đây là cấu hình trường.
- Given Admin quản lý phụ huynh, when mở submenu hoặc từ học sinh, then UI giữ rõ parent profile khác StudentParent link, công bố đúng phạm vi dữ liệu API trả về và không suy diễn quyền đăng nhập.
- Given Admin đổi trường khi có form chưa gửi hoặc Operation pending trong bất kỳ nhóm Danh bộ nào, when yêu cầu đổi trường, then guard hiện có vẫn ngăn mất dữ liệu/đối soát thiếu an toàn.
- Given server từ chối hoặc năm học đã đóng, when thao tác trong IA mới, then lỗi/read-only state hiện tại vẫn được giữ và không có client-side mutation giả.

## Design Notes

Danh bộ là một **people/class workspace**, không phải nơi thiết kế quyền: “Giáo viên” là profile/assignment; chức danh và capability là dữ liệu quản trị truy cập. Sidebar đề xuất:

- **Danh bộ** (collapse): Học sinh · Phụ huynh · Nhân viên · Lớp học.
- **Cấu hình trường** (collapse): Năm học · Chức danh & capability · Hồ sơ trường/Calendar/Finance policy/Bank account/Attendance–handover–Parent policy.

Do API hiện có chỉ trả Parent link theo Student, submenu **Phụ huynh** trước mắt là danh sách “Phụ huynh liên kết” trong year scope; muốn danh sách duy nhất toàn trường, tìm kiếm và phân trang parent độc lập là thay đổi API cần chốt riêng.

## Verification

**Commands:**
- `pnpm --filter web test -- roster-workspace.test.tsx school-context.test.tsx` -- expected: test IA, guard và hành vi server-authoritative pass.
- `pnpm --filter web lint` -- expected: TypeScript/React lint pass.
- `pnpm --filter web build` -- expected: portal Admin build thành công.
- `git diff --check` -- expected: không có lỗi whitespace.

**Manual checks:**
- Chọn một trường có dữ liệu, kiểm tra thứ tự/nhãn các vùng Danh bộ, thao tác thêm học sinh/link phụ huynh/sửa giáo viên, và mở Cấu hình trường để xác nhận ranh giới dễ hiểu.
- Thử đổi trường khi form ở từng vùng dirty hoặc một Operation pending; kiểm tra focus bằng bàn phím và table trên viewport hẹp.

## Suggested Review Order

**Điều hướng theo đối tượng**

- Tách navigation server-projected thành hai nhóm collapse, giữ guard và capability hiện có.
  [`school-context.tsx:38`](../../../apps/web/src/school-context.tsx#L38)

- Submenu chỉ hiện theo capability và giữ destination active khi đóng/mở group.
  [`school-context.tsx:239`](../../../apps/web/src/school-context.tsx#L239)

**Phân vùng workspace**

- Dùng section để tái dùng API/Operation nhưng chỉ render thao tác của destination.
  [`roster-workspace.tsx:195`](../../../apps/web/src/roster/roster-workspace.tsx#L195)

- Các khối people, class, year và position được điều kiện hóa theo section.
  [`roster-workspace.tsx:1132`](../../../apps/web/src/roster/roster-workspace.tsx#L1132)

**Khả dụng và regression**

- Disclosure controls có trạng thái, liên kết submenu và presentation nhất quán.
  [`index.css:971`](../../../apps/web/src/index.css#L971)

- Test xác nhận destination people/class, active state và không lẫn thao tác cấu hình.
  [`school-context.test.tsx:32`](../../../apps/web/src/school-context.test.tsx#L32)
