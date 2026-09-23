---
title: 'Ghi nhớ và tự chọn ngữ cảnh trường Admin'
type: 'bugfix'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd9a74ce90a9fc3b24b9466e5afa8fd556f6177ad'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Sau khi reload hoặc vừa đăng nhập, Admin luôn quay về trạng thái phải chọn Trường dù ngữ cảnh đang làm việc không đổi. Điều này làm gián đoạn công việc, đặc biệt với tài khoản chỉ có quyền tại một Trường.

**Approach:** Ghi nhớ an toàn lựa chọn Trường đã được server xác thực cho từng identity và tự khôi phục nó sau reload. Tự mở workspace khi user hiện chỉ có một Trường hoặc có lựa chọn cũ còn hợp lệ; với nhiều Trường nhưng chưa có lựa chọn hợp lệ, hiển thị rõ trang chọn Trường sau login để user chủ động xác nhận tenant làm việc.

## Boundaries & Constraints

**Always:** API tiếp tục là nguồn duy nhất cho authorization và School context. Browser chỉ được lưu `schoolId`, namespaced theo `userIdentityId`; không lưu hoặc tin capability, membership, tên Trường hay context. Chỉ persist lựa chọn sau khi endpoint context trả thành công cho request hiện tại. Danh sách Trường từ API luôn xác nhận lựa chọn có còn hợp lệ. Một Trường active/authorized phải tự được load và không hiện chooser. Với nhiều Trường, lựa chọn đã nhớ còn trong danh sách server phải tự được khôi phục sau reload; chỉ hiển thị chooser khi chưa có lựa chọn hợp lệ. Khi server từ chối context hiện hành, xóa lựa chọn đã lưu tương ứng rồi làm mới chooser. Lỗi localStorage không được làm hỏng UI hoặc session bootstrap.

**Ask First:** Thay đổi API session/authorization, thêm server-side current-school state, tự mở lựa chọn đã nhớ cho user nhiều Trường, hoặc thay đổi dirty/pending guard khi đổi trường.

**Never:** Không dùng browser storage như bằng chứng authorization; không gửi `schoolId` đã lưu tới context endpoint trước khi xác nhận nó có trong danh sách server; không lưu state form, capability, membership hoặc dữ liệu tenant khác; không sửa API/Prisma/domain chỉ để nhớ UI state.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|----------------------------|----------------|
| Một Trường sau login/reload | API trả đúng một Trường được cấp quyền | Tự tải context server, render workspace, không render control `Chọn trường` | Context bị từ chối thì quay về chooser/empty state theo danh sách làm mới |
| Nhiều Trường có lựa chọn cũ | API trả từ hai Trường trở lên và saved ID vẫn có trong danh sách | Tự tải lại context saved ID sau reload | Server từ chối context thì xóa saved ID, làm mới danh sách và hiển thị chooser |
| Nhiều Trường chưa có lựa chọn | API trả từ hai Trường trở lên nhưng không có saved ID hợp lệ | Render trang chọn Trường và không tự gọi endpoint context | User chọn rõ một Trường trước khi workspace load |
| Chọn Trường thành công | User chọn A; API context A trả success | Render context A và lưu riêng ID A theo identity | Storage unavailable thì vẫn render context bình thường |
| Lựa chọn cũ stale hoặc bị thu hồi | Storage có A nhưng API list không còn A, hoặc endpoint A trả denied | Xóa A; không load A từ storage; hiển thị chooser từ danh sách server | Không logout trừ khi endpoint danh sách trả 401 như hiện hữu |
| Chia sẻ browser giữa accounts | Identity B đăng nhập sau A | Chỉ đọc/ghi key của B; không kế thừa ID A | API list/context vẫn quyết định quyền cuối cùng |

</frozen-after-approval>

## Code Map

- `apps/web/src/main.tsx:61-122` -- AdminShell bootstrap session và hiện truyền chỉ clear callback vào SchoolContext; truyền identity đã xác thực để storage được scoped theo account.
- `apps/web/src/school-context.tsx:38-136` -- state, `refreshChooser()` và `load()` là nơi thêm storage helper, auto-load đúng một trường và chỉ persist sau response context thành công.
- `apps/web/src/school-context.tsx:140-172` -- revalidation/switch giữ request version và dirty guard; denied path phải quên selection bị từ chối, không thay đổi semantic guard hiện có.
- `apps/web/src/school-context.tsx:191-230` -- chooser hiện luôn render; chỉ render khi không có context khôi phục được, giữ empty/loading/error presentation hiện hữu.
- `apps/web/src/school-context.test.tsx:1-79` -- regression suite mock fetch theo URL/sequences; hiện clear sessionStorage, cần clear localStorage và coverage auto-select/persistence/tenant account separation.
- `apps/api/src/modules/authorization/authorization.service.ts:38-57` -- read-only evidence: list và context resolve active membership/capability server-side; không đổi backend.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/main.tsx` -- truyền `session.userIdentityId` vào SchoolContext -- tạo storage key theo identity session thay vì global browser state.
- [x] `apps/web/src/school-context.tsx` -- thêm persistence defensive và chooser routing theo cardinality danh sách -- giữ local selection chỉ là UX hint, server authorization là authoritative.
- [x] `apps/web/src/school-context.test.tsx` -- thêm regression coverage cho one-school auto-open, multi-school restore đã nhớ, chooser khi chưa có lựa chọn, successful persistence, stale/denied removal và identity namespace -- khóa các edge case authorization/UX.

**Acceptance Criteria:**
- Given session hợp lệ có đúng một Trường, when Admin login hoặc reload, then context trường được tải và workspace xuất hiện mà không bắt user chọn trường.
- Given session hợp lệ có nhiều Trường nhưng browser chưa có lựa chọn hợp lệ, when Admin login hoặc reload, then chỉ chooser xuất hiện cho đến khi user chọn trường.
- Given user đã chọn trường và context API thành công, when reload cùng identity, then lựa chọn được nhớ và tự khôi phục sau khi API xác nhận ID vẫn thuộc danh sách trường được cấp quyền.
- Given lựa chọn browser đã stale, denied hoặc thuộc identity khác, when danh sách/context được tải, then UI không dùng nó làm tenant context và xóa selection không hợp lệ khi phù hợp.

## Design Notes

Lựa chọn gần nhất là một tiện ích UI, không phải ngữ cảnh bảo mật. Quy tắc được quyết định sau khi API list trả về: `1` tự vào thẳng; `>1` tự khôi phục lựa chọn đã được server xác nhận gần nhất, hoặc hiển thị chooser nếu không có lựa chọn hợp lệ. Việc persist sau context success tránh ghi một ID mà server không chấp nhận.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx` -- expected: chooser, persistence và switch guards pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite build thành công.
- `git diff --check` -- expected: không có whitespace error.

**Manual checks:**
- Với PeakLand là trường duy nhất của tài khoản, reload `http://localhost:5173/` và xác nhận vào thẳng Danh bộ; không còn chooser.
- Với fixture/tài khoản nhiều trường, chọn một trường rồi reload để xác nhận tự khôi phục; xóa lựa chọn hoặc dùng lựa chọn stale để xác nhận chooser là bề mặt đầu tiên. Đổi trường vẫn giữ dirty/pending confirmation hiện hữu.

## Suggested Review Order

**Khôi phục ngữ cảnh an toàn**

- Chỉ dùng school ID đã được list API xác thực; context server vẫn là authority.
  [`school-context.tsx:71`](../../apps/web/src/school-context.tsx#L71)

- Tự vào trường duy nhất hoặc lựa chọn hợp lệ; otherwise hiển thị chooser.
  [`school-context.tsx:113`](../../apps/web/src/school-context.tsx#L113)

- Denial từ context hoặc workspace luôn quên lựa chọn trước khi quay về chooser.
  [`school-context.tsx:157`](../../apps/web/src/school-context.tsx#L157)

**Phạm vi identity và regression**

- Identity session tạo namespace cho browser-only UX state.
  [`main.tsx:121`](../../apps/web/src/main.tsx#L121)

- Đổi identity reset context cũ trước khi load list/context mới.
  [`school-context.tsx:174`](../../apps/web/src/school-context.tsx#L174)

- Tests khóa auto-load, restore, stale selection và account isolation.
  [`school-context.test.tsx:79`](../../apps/web/src/school-context.test.tsx#L79)
