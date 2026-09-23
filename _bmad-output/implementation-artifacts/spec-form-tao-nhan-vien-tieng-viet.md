---
title: 'Chuẩn hóa biểu mẫu tạo nhân viên bằng tiếng Việt'
type: 'feature'
created: '2026-09-23'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'f27d8cf713b9411af9783cd5430ef80e37c5519e'
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/spec-2-4-quan-ly-staff-profile-va-phan-cong-theo-effective-date.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Bề mặt Nhân viên hiện là form inline, hierarchy chưa phù hợp luồng tạo mới và dễ bị hiểu nhầm là luồng tạo tài khoản. Tham chiếu Kidsonline có trường tên đăng nhập, nhưng PassionEdu dùng Google OAuth và Staff profile không được tự tạo identity, membership hay quyền truy cập.

**Approach:** Đưa tạo và sửa hồ sơ nhân viên vào dialog tiếng Việt rõ ràng, bố cục responsive tương tự form tạo học sinh, và diễn đạt Email là thông tin liên hệ thay vì tên đăng nhập. Mở rộng Staff profile/API với ảnh hồ sơ, mã nhân viên và mã định danh cá nhân đều tùy chọn, nhưng không mở rộng workflow Google login.

## Boundaries & Constraints

**Always:** Giữ cookie mutation protection, field error, error-summary focus, input retention, Operation reconciliation, switch guard và authorization hiện có. Ảnh chỉ nhận JPEG/PNG/WEBP tối đa 10 MB, được kiểm tra server-side, School-scoped và chỉ Admin có capability roster mới đọc/ghi; không trả blob/data URL trong DTO danh sách. Mã nhân viên và mã định danh cá nhân là optional, trim/normalize ở server; mã nhân viên nếu có phải unique theo School và không tái sử dụng. Dialog chỉ đóng qua nút rõ ràng hoặc sau create/update/upload server-confirmed thành công; không reset input khi native browser focus/visibility quay lại. Email vẫn là bắt buộc và copy phải nói rõ đây là email liên hệ, không đồng nghĩa tạo hay cấp quyền đăng nhập Google. Giữ một primary Position active và employment status theo contract server.

**Ask First:** Tên đăng nhập/password, UI gán SchoolMembership/login binding, biến mã định danh thành unique/required, hoặc mở media Staff cho audience/portal khác Admin.

**Never:** Không tạo UserIdentity, SchoolMembership, binding hay quyền từ form; không gọi Email là tài khoản/tên đăng nhập; không thay đổi enum/semantics giới tính server-side; không lưu draft client-side; không public/cross-School ảnh hay mã định danh; không cho client ghi nhận upload thành công trước response server.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mở tạo mới | Nhấn `Thêm nhân viên` | Dialog `Tạo hồ sơ nhân viên` hiển thị nhóm Thông tin cơ bản và Công việc; không hiện tên đăng nhập | Nút Đóng là dismiss path rõ ràng, không POST |
| Lưu hợp lệ | Đủ profile bắt buộc, chức danh active, optional mã/định danh/ảnh hợp lệ | Lưu profile, mã và định danh; tải ảnh sau khi profile server-confirmed; dialog chỉ đóng/reset sau toàn bộ outcome xác nhận | Không tạo state optimistic, identity hay membership |
| Mã nhân viên | Có giá trị trùng trong cùng School | Server từ chối field `staffCode`; giá trị nhập và dialog còn nguyên | Không durable write hay Operation thành công |
| Ảnh không hợp lệ | MIME/kích thước ngoài policy hoặc Staff foreign | Server từ chối trước persist/read; profile vừa tạo và draft ảnh còn để retry/reconcile | Không trả blob, URL hay lộ media cross-School |
| Server từ chối | API trả field errors | Dialog còn mở, summary được focus, lỗi cạnh field và input còn nguyên | Không gửi lại tự động |
| Focus trả về | Native browser focus/visibility event khi dialog mở | Dialog và draft còn nguyên, không revalidate context làm remount workspace | Không có request context mới khi dialog đang mở |
| Màn hình hẹp | Viewport dưới 768px | Dialog cuộn nội bộ, form một cột, action luôn truy cập được | Không tràn ngang viewport |

</frozen-after-approval>

## Code Map

- `apps/api/prisma/schema.prisma:118-147` cùng migration mới -- thêm `staffCode`, `personalIdentifier` và Staff photo storage/tenant composite graph; unique partial/sentinel-safe mã nhân viên theo School, không thay relation identity/binding.
- `apps/api/src/modules/roster/roster.service.ts:190-213, 639-766, 1949-1993` cùng controller -- mở rộng DTO/input Staff, create/update và endpoint upload/read ảnh; server giữ validation MIME/kích thước, School/capability, idempotency/Operation/audit và không đưa blob vào list DTO.
- `apps/web/src/roster/roster-workspace.tsx:66-83, 231-241, 909-937` -- Staff DTO, state và `saveStaff()` là profile/payload canonical; mở rộng cho ba field optional và staged photo upload sau Staff server-confirmed.
- `apps/web/src/roster/roster-workspace.tsx:341-384, 1317-1478` -- dirty/status reporting và form Staff inline hiện tại; thay bằng entry button/dialog và form tái dùng cho create/edit, đồng thời report dialog-open tới SchoolContext.
- `apps/web/src/roster/roster-workspace.tsx:1237-1288, 2174-2180` -- pattern dialog Student đã được kiểm tra: focus mở dialog, semantic modal, action Đóng và không dismiss qua backdrop/Escape.
- `apps/web/src/school-context.tsx` -- revalidation focus/visibility đã guard bằng `WorkspaceStatus.dialogOpen`; Staff dialog phải được đưa vào status này để không remount/mất draft.
- `apps/web/src/index.css:1178-1218, 1317-1372` -- grid form và modal Student responsive; tái dùng/generalize selector scope để dialog Staff đồng nhất mà không làm lệch form khác.
- `apps/web/src/roster/roster-workspace.test.tsx:479-572` -- test Staff create/edit và validation input retention cần chuyển entry point sang dialog, khóa copy không có username và payload không đổi.
- `apps/api/src/modules/roster/roster.service.ts:639-766, 1949-1993` -- server source of truth: bắt buộc fullName/email/phone/dateOfBirth/gender/address/primaryPositionId; không có username, photo, staff code hay personal identifier.
- `apps/api/src/integration/roster.integration.test.ts` -- Staff profile proof hiện có là điểm mở rộng cho optional fields, unique mã nhân viên, tenant isolation, upload validation, idempotency và no-login-creation.

## Tasks & Acceptance

**Execution:**
- [x] `apps/api/prisma/schema.prisma` và migration mới -- persist mã nhân viên, mã định danh và ảnh hồ sơ Staff optional theo School; enforce mã nhân viên unique nếu hiện diện, giữ rollback-safe migration với profile lịch sử.
- [x] `apps/api/src/modules/roster/roster.service.ts`, `apps/api/src/modules/roster/roster.controller.ts` -- mở rộng Staff DTO/command và Staff photo upload/read endpoints; validate optional text, MIME/size và tenant graph server-side, dùng mutation protection, Operation/audit/reconciliation như Staff command hiện có.
- [x] `apps/web/src/roster/roster-workspace.tsx` -- thay form Staff inline bằng form dùng chung trong dialog cho create/edit, thêm CTA `Thêm nhân viên`, nhóm field `Thông tin cơ bản` và `Công việc`, dùng nhãn `Email liên hệ`, select giới tính chỉ thay bề mặt nhưng gửi string contract hiện có; thêm mã nhân viên, mã định danh và staged ảnh optional; giữ submit/reconciliation và reset chỉ sau toàn bộ success.
- [x] `apps/web/src/school-context.tsx` cùng `apps/web/src/roster/roster-workspace.tsx` -- báo cả Student và Staff dialog-open trong workspace status, để focus/visibility revalidation không làm remount form đang mở.
- [x] `apps/web/src/index.css` -- tái dùng style dialog intake đã scope cho Student để Staff có cùng desktop grid, mobile one-column và internal scroll mà không ảnh hưởng form/table khác.
- [x] `apps/api/src/modules/roster/*.test.ts` và `apps/api/src/integration/roster.integration.test.ts` -- cover optional field persistence, mã trùng/cross-School, MIME/kích thước/foreign Staff, idempotency, audit, Admin authorization và no-login-creation.
- [x] `apps/web/src/roster/roster-workspace.test.tsx` và `apps/web/src/school-context.test.tsx` -- cover mở/đóng dialog, copy Google-login, optional payload/staged upload, field error/input retention, picker cancel và focus-return bảo toàn Staff dialog/draft.

**Acceptance Criteria:**
- Given School Admin mở Nhân viên, when nhấn `Thêm nhân viên`, then dialog có tên `Tạo hồ sơ nhân viên`, có nhóm `Thông tin cơ bản` và `Công việc`, không hiện `Tên đăng nhập` hoặc `Tài khoản`, và ba field ảnh/mã nhân viên/mã định danh đều không bắt buộc.
- Given Admin điền thông tin hợp lệ, when submit tạo hoặc sửa, then API lưu các field optional có mặt và UI tải ảnh sau profile server confirmation; email được hiển thị là email liên hệ và UI chỉ cập nhật/đóng sau toàn bộ server confirmation.
- Given hai Staff cùng School dùng cùng mã nhân viên, when Staff thứ hai được lưu, then API trả field error và không tạo/update partial profile; given cùng mã ở School khác, then API không conflict.
- Given Admin upload hoặc đọc ảnh Staff, when MIME/kích thước, Staff ID, School hoặc capability không hợp lệ, then API từ chối trước blob persistence/disclosure; list Staff không chứa blob/data URL.
- Given API trả validation error, when dialog render lại, then summary focus, `aria-invalid`/`aria-describedby` đúng field và toàn bộ dữ liệu đã nhập còn nguyên.
- Given dialog Staff đang mở, when browser trả focus hoặc đổi visibility, then dialog cùng draft còn mở và SchoolContext không reload trong thời gian đó.
- Given desktop hoặc viewport dưới 768px, when dialog render, then trường ngắn thẳng hàng desktop, về một cột mobile, không horizontal overflow và action Đóng/Lưu truy cập được.

## Design Notes

Email được giữ vì API yêu cầu nó cho Staff profile, nhưng không là credential: chỉ luồng membership/binding server-authorized riêng mới liên kết Google identity. Ảnh là aggregate phụ thuộc Staff profile, tải sau khi profile đã được xác nhận; đường đọc ảnh không đưa media vào list DTO và tái kiểm tra School/capability. Mã nhân viên là một identifier vận hành optional, unique trong School; mã định danh là optional sensitive profile data, không suy ra authorization hoặc Google identity.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- school-context.test.tsx roster-workspace.test.tsx` -- expected: Staff dialog, validation, focus-return và regression roster pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: không lỗi TypeScript.
- `pnpm --filter @passionedu/admin-web build` -- expected: Vite production build hoàn tất.
- `pnpm --filter @passionedu/api test` -- expected: unit/controller Staff contract pass.
- `set -a && . apps/api/.env && set +a && pnpm --filter @passionedu/api test:integration` -- expected: Staff data/media tenant, validation và idempotency proofs pass.
- `git diff --check` -- expected: không lỗi whitespace.

**Manual checks:**
- Desktop và mobile: mở/đóng Tạo nhân viên, kiểm tra grid/scroll/action; xác nhận không hàm ý email tạo login Google.

## Suggested Review Order

**Profile Contract**

- Persist optional Staff data without turning a profile into a Google credential.
  [`schema.prisma:119`](../../apps/api/prisma/schema.prisma#L119)

- Preserve issued employee codes across profile edits and clearing.
  [`migration.sql:1`](../../apps/api/prisma/migrations/20260923000001_staff_profile_optional_media/migration.sql#L1)

**API Boundary**

- Validate tenant-scoped identifiers and protected binary Staff media.
  [`roster.service.ts:643`](../../apps/api/src/modules/roster/roster.service.ts#L643)

- Accept Staff-photo raw bodies at the same server-enforced 10 MiB limit.
  [`main.ts:20`](../../apps/api/src/main.ts#L20)

**Admin Workflow**

- Stage profile then photo, retaining and reconciling uncertain uploads.
  [`roster-workspace.tsx:925`](../../apps/web/src/roster/roster-workspace.tsx#L925)

- Keep Staff dialog state through browser focus return.
  [`roster-workspace.tsx:390`](../../apps/web/src/roster/roster-workspace.tsx#L390)

**Proof**

- Prove identifiers, media isolation, audit and idempotent replay on PostgreSQL.
  [`roster.integration.test.ts:269`](../../apps/api/src/integration/roster.integration.test.ts#L269)

- Cover dialog submission, validation retention and unchanged Google-login boundary.
  [`roster-workspace.test.tsx:479`](../../apps/web/src/roster/roster-workspace.test.tsx#L479)
