# Quyết định: Contract membership và capability Story 1.4

**Trạng thái:** Đã xác nhận bởi Product, 2026-09-16.

## Quyết định

Story 1.4 phát hành hai capability nền do API resolve ở mỗi request:

- `SCHOOL_CONTEXT_READ`: đọc School chooser, selected context và navigation projection.
- `ACCESS_MANAGE`: quản trị SchoolMembership và SchoolRoleGrant trong đúng School context.

Preset release đầu và capability của chúng là:

| Preset | Capability phát hành trong Story 1.4 |
| --- | --- |
| `SCHOOL_ADMIN` | `SCHOOL_CONTEXT_READ`, `ACCESS_MANAGE` |
| `FINANCE_MANAGER` | `SCHOOL_CONTEXT_READ` |
| `CLASS_TEACHER` | `SCHOOL_CONTEXT_READ` |

Không phát hành capability nghiệp vụ Epic 2, 4 hoặc 6 ở Story 1.4. Attendance và handover capability vẫn deferred đến Epic 4. Navigation là projection do server trả về; chỉ Admin audience có destination quản lý access khi có `ACCESS_MANAGE`.

Mỗi UserIdentity có tối đa một SchoolMembership tại một School. Các SchoolRoleGrant thuộc một membership là additive. Command đổi role thay thế nguyên tập preset trong một transaction. Revoke chuyển membership sang `REVOKED` và xóa toàn bộ role grant trong cùng transaction. Story 1.4 không hỗ trợ reactivation membership; một cấp lại access sau revoke cần contract riêng. Tạo membership không bắt buộc reason; revoke và đổi preset bắt buộc reason.

School Admin không được tự revoke hay tự hạ quyền khi họ là School Admin cuối cùng trong School. Các thay đổi access khác vẫn phải được server authorize trong selected School context.

Create, revoke và replace-role là privilege-changing mutation high-impact ngay trong Story 1.4. Mỗi command yêu cầu UUID `Idempotency-Key`, dùng SchoolMembership-scoped Operation, lưu fingerprint/outcome và yêu cầu client reconcile `GET /operations/:operationId` trước retry sau timeout.

Cả `app` và `teacher` audience có thể dùng chooser/context khi UserIdentity có active membership và `SCHOOL_CONTEXT_READ`. Chỉ `app` có API/UI access management. `teacher` chỉ có context và navigation projection; không có access-management route/UI hoặc capability nghiệp vụ trước Epic 4.

## Ranh giới

- Session cookie không chứa role, capability hay trusted School context.
- School selector URL chỉ là selector; API resolve active membership, grant, capability và School status trước mọi lookup scoped.
- StaffProfile hay assignment không tự cấp membership, role, login hoặc portal access.
- Revoke/suspension có hiệu lực ở request School-scoped kế tiếp. Portal xóa protected state context bị từ chối nhưng không đăng xuất global identity khi còn context khác hợp lệ.
