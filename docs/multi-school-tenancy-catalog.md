---
title: "Đa trường và quyền theo trường: tham chiếu Kidsonline cho PassionEdu"
status: discovery-proposal
created: 2026-08-31
source: "Khảo sát Kidsonline /v4/chosen-schools"
---

# Đa Trường Và Quyền Theo Trường Của PassionEdu

## 1. Kết luận

PassionEdu phải được thiết kế **multi-school ngay từ schema và authorization boundary**. Ánh Hoa là một `School` tenant đầu tiên, không phải tên platform hay ranh giới dữ liệu. Không làm theo mô hình một Admin toàn cục có toàn quyền với mọi dữ liệu.

Mỗi request nghiệp vụ phải có `schoolId` đã được xác thực từ route/context. Identity đăng nhập là toàn cục; quyền là một membership có hiệu lực trong từng trường. Cùng một người có thể là quản lý tài chính tại trường A, người ghi điểm danh tại trường B và không có quyền ở trường C.

Đây là clean-break kiến trúc cần thực hiện cùng đợt thay finance/danh bộ. Dữ liệu hiện chỉ là seed nên không nên xây compatibility layer cho schema single-school.

## 2. Bằng chứng quan sát Kidsonline

Màn `https://komt.kidsonline.edu.vn/v4/chosen-schools` quan sát ngày 31/08/2026 hiển thị danh sách bốn trường mà tài khoản hiện tại truy cập được:

- Mỗi dòng có logo, mã trường, tên trường, địa chỉ, ngày tạo và link vào dashboard.
- Link của từng dòng mang school context rõ ràng trong URL, ví dụ `/v4/school/3139/dashboard`, `/v4/school/2716/dashboard`.
- Tài khoản đang đăng nhập có thể chọn ít nhất bốn school context độc lập.

Màn này không hiển thị role của người dùng ở từng trường. Không suy diễn rằng tài khoản có cùng một role hoặc quyền quản trị ở cả bốn trường.

## 3. Mô hình miền đề xuất

### 3.1 Identity và tenant

| Model | Trách nhiệm | Quy tắc |
| --- | --- | --- |
| `UserIdentity` | Identity Google canonical toàn platform | Email normalized và Google subject unique toàn hệ thống; giữ display name/avatar tối thiểu, status login và timestamps; không có `schoolId`, role hay dữ liệu profile nghiệp vụ |
| `School` | Tenant pháp lý/vận hành | Mã trường unique toàn hệ thống, profile, timezone, lifecycle; Ánh Hoa là một bản ghi `School`; không hard delete |
| `SchoolMembership` | UserIdentity thuộc trường nào | `userIdentityId`, `schoolId`, `ACTIVE`/`SUSPENDED`/`REVOKED`, hiệu lực, audit; unique một membership mỗi cặp identity-trường |
| `SchoolRoleGrant` | Quyền của membership trong trường | Role/capability, effective dates, granted/revoked by; không gắn quyền trực tiếp vào `UserIdentity` |

`Admin`, `Staff` và `Parent` không là ba identity tables tách rời có Google subject riêng. Chúng là persona/profile hoặc membership/domain link của một `UserIdentity`; mỗi portal vẫn giữ callback, cookie, CSRF scope, session audience và guard riêng:

- Membership vận hành cấp `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `ATTENDANCE_RECORDER`, `HANDOVER_RECORDER`, `CLASS_TEACHER`.
- `StaffProfile` chỉ lưu thông tin nhân sự theo trường nếu cần; việc là nhân viên ở trường A không tự cho quyền ở trường B.
- `ParentProfile` là profile liên hệ/portal toàn platform, không có `schoolId`, được bind với `UserIdentity` khi Parent login; một identity có thể là phụ huynh ở một trường và nhân viên ở trường khác. School context của Parent luôn được suy ra từ `Student` qua `StudentParent`, không phải từ profile.

### 3.2 Control plane của PassionEdu

PassionEdu cần một bề mặt **Platform Operations** tối thiểu. Không có nó, không có actor hợp lệ để tạo một trường mới, bootstrap `SCHOOL_ADMIN` đầu tiên, suspend tenant hoặc xử lý sự cố platform mà không dùng tay database.

Đây không phải một `SUPER_ADMIN` có quyền vô hạn trong school application. Dùng grant platform tách biệt:

| Model/capability | Trách nhiệm | Không được phép mặc định |
| --- | --- | --- |
| `PlatformOperatorGrant` | Gắn capability global cho một `UserIdentity`, có hiệu lực, cấp/thu hồi và audit | Không tạo school membership hoặc quyền đọc dữ liệu trường chỉ nhờ grant này |
| `PLATFORM_SCHOOL_PROVISION` | Tạo/suspend/reactivate `School`, khởi tạo profile và cấp owner membership đầu tiên | Xem/sửa danh bộ, finance, attendance, Parent data |
| `PLATFORM_ACCESS_ADMIN` | Quản lý PlatformOperatorGrant và account provisioning theo quy trình hai người khi có thể | Thao tác trong tenant như một School Admin |
| `PLATFORM_SUPPORT` | Xem metadata vận hành tối thiểu như trạng thái tenant, health/config version và audit support | Đọc PII, receipt, invoice, attendance hoặc Parent payload |

Trang control plane đặt tại `ops.passionedu.org`, tách route, origin, cookie host-only và navigation khỏi `app.passionedu.org`. Release đầu chỉ cần:

- Danh sách/tạo/suspend/reactivate trường, mã trường, tên, timezone, trạng thái, người tạo và timestamp.
- Cấp/thu hồi owner membership đầu tiên và xem membership metadata, không hiển thị dữ liệu nghiệp vụ của trường.
- Audit append-only cho mọi provisioning, suspension và platform grant.

Không có `OpsUser`, `OperationalUserProfile` hoặc bảng người dùng vận hành global riêng. `ops.passionedu.org` xác thực `UserIdentity` bằng callback/session audience `ops`, rồi `OpsSessionGuard` tải `PlatformOperatorGrant` hiệu lực và kiểm capability route. Grant không cấp quyền vào `app.passionedu.org`; chỉ `SchoolMembership` + `SchoolRoleGrant` mới cấp quyền vận hành trong School.

Hỗ trợ truy cập dữ liệu một trường là capability riêng, **không nằm trong release đầu**. Nếu cần sau này, phải tạo support session just-in-time có trường đích, lý do/ticket, scope read-only hoặc capability hẹp, thời hạn, banner rõ ràng cho operator và audit bất biến. Không implement impersonation im lặng, không dùng `SUPER_ADMIN` bypass mọi `SchoolMembership`.

### 3.3 Bootstrap và provisioning đã chốt

- `SUPERADMIN_EMAIL` là một biến environment duy nhất, chứa email Google normalized của Platform Operator bootstrap. Không commit giá trị thật; chỉ mô tả biến trong `.env.example`.
- `SUPERADMIN_EMAIL` chỉ dùng để cấp/tái xác nhận `PLATFORM_ACCESS_ADMIN` và `PLATFORM_SCHOOL_PROVISION` cho UserIdentity tương ứng khi người đó đăng nhập. Các PlatformOperatorGrant khác vẫn là record có audit; không dùng biến môi trường như một role check rải rác trong business routes.
- Khi Platform Operator tạo `School`, form nhận email của `SCHOOL_ADMIN` đầu tiên. API tạo `UserIdentity` pending theo email normalized nếu chưa có, rồi tạo `SchoolMembership` active và grant `SCHOOL_ADMIN` ngay trong transaction provisioning.
- Lần đầu email owner đăng nhập Google verified, API bind Google subject/update UserIdentity pending đó. Không phát sinh password mặc định hay account nội bộ riêng.
- Không xóa `School`. Platform Operator chỉ `SUSPEND`/`REACTIVATE`; school suspended bị từ chối ở mọi school business request tiếp theo. Không cần cơ chế hủy toàn bộ session ngay ở release đầu.

### 3.4 Role matrix release đầu

Khảo sát Kidsonline tại `/school/3139/access-role/index` cho thấy role `PP - Hiệu trưởng` có 335 functional permissions và hệ thống tách rõ xem/sửa/xuất/sửa dữ liệu quá khứ theo domain. PassionEdu không sao chép permission catalog này ở release đầu. Dùng preset role nhỏ, capability không phụ thuộc UI title, và chỉ tách quyền khi một domain phát hành cần phân tách thật.

| Role preset | Capability release đầu | Không bao gồm mặc định |
| --- | --- | --- |
| `SCHOOL_ADMIN` | Quản lý membership/role trong trường, school profile/calendar, roster, Parent links, Staff assignment, finance configuration, đóng collection run, quyết toán năm/write-off, duyệt nghỉ dài hạn/hủy dịch vụ và đọc báo cáo | Platform Operations, dữ liệu trường khác, support bypass |
| `FINANCE_MANAGER` | Khoản thu, discount, collection run, tạo hóa đơn `DRAFT`, rà soát/override/issue từng invoice với tài khoản nhận tiền riêng, receipt/allocation/nộp trước, tạo/hủy service enrollment theo yêu cầu Parent và báo cáo finance; tạo reversal theo policy | Membership/role, school policy ngoài finance, attendance/handover, đóng collection run, write-off quyết toán năm, duyệt nghỉ dài hạn/hủy dịch vụ |
| `CLASS_TEACHER` | Xem roster/lớp được phân công, chụp/upload ảnh + xác nhận attendance `PRESENT`, xác nhận trả trẻ trong lớp; xem leave request liên quan lớp để vận hành attendance | Finance mutation, Parent link management, school-wide configuration, approval đơn nghỉ sau deadline |
| `ATTENDANCE_RECORDER` | Ghi/xem attendance trong phạm vi phân công khi Epic attendance phát hành; `PRESENT` tuân theo School `photoEvidenceMode` và confirmation | Finance, handover override, lịch sử quá khứ nếu chưa cấp capability riêng, approval đơn nghỉ sau deadline |
| `HANDOVER_RECORDER` | Xác nhận trả trẻ trong phạm vi phân công khi Epic handover phát hành | Finance, attendance backdate, pickup authorization policy, approval đơn nghỉ sau deadline |

`SCHOOL_ADMIN` có thể cấp/thu các school role preset cho membership trong cùng trường, với audit. `FINANCE_MANAGER` có thể post receipt và reversal; School cấu hình reversal `DIRECT` hoặc `SCHOOL_ADMIN_APPROVAL`. Với mode hai bước, Finance Manager tạo yêu cầu và School Admin duyệt, hai actor phải khác nhau. School cấu hình leave deadline; `SCHOOL_ADMIN` hoặc `FINANCE_MANAGER` duyệt/từ chối request sau deadline, request trước deadline tự duyệt. Chỉ School Admin quyết định adjustment/write-off khi quyết toán năm. Không làm UI tự tạo role hoặc gán từng checkbox capability ở release đầu.

`Staff` là hồ sơ nhân sự theo School, không phải principal đăng nhập. Tạo Staff profile hoặc StaffClassAssignment không tạo `UserIdentity`, `SchoolMembership` hay session. Chỉ khi School Admin liên kết/cấp membership và role cho một Google UserIdentity thì người đó mới truy cập portal; revoke membership không xóa Staff history.

### 3.5 Ownership của dữ liệu

Tất cả aggregate business dưới đây, trừ identity/profile toàn platform, phải chứa `schoolId` và toàn bộ unique/index/foreign-key query phải scope theo school:

- `SchoolYear`, `Class`, `Student`, `StudentEnrollment`, `StudentParent`, Staff profile/assignment. `ParentProfile` là global; mọi truy cập Parent vào dữ liệu school phải join qua `StudentParent -> Student.schoolId` và validate school context đó.
- Calendar và toàn bộ policy/configuration.
- `ReceivableGroup`, `Receivable`, `DiscountPolicy`, `CollectionRun`, `ChargeRule`, invoice, receipt, nộp trước, allocation và bank account.
- Attendance, handover, late pickup, notification, operations và audit.

Ví dụ đúng: mã học sinh và mã khoản thu unique trong cùng `schoolId`; cùng mã có thể tồn tại ở hai trường. Class, enrollment, receipt hoặc invoice không bao giờ được join/chọn bằng UUID đơn lẻ mà không kiểm tra cùng school context.

## 4. Authorization và request context

1. Google OAuth xác thực `UserIdentity`; session chỉ chứa identity tối thiểu (`sub`) và audience portal, không nhét danh sách role/trường có thể stale vào JWT.
2. `GET /me/schools` trả các membership active và metadata tối thiểu để render màn chọn trường.
3. Khi người dùng chọn trường, web đi tới route scoped, ví dụ `/schools/:schoolId/...`; API dùng `/schools/:schoolId/...` tương ứng.
4. Guard của `app.passionedu.org` tải `SchoolMembership` active cho `UserIdentity + schoolId`, sau đó kiểm tra capability được route yêu cầu. Thiếu membership trả 404 hoặc 403 theo policy chống lộ tenant; không fallback sang trường mặc định.
5. Service/repository nhận `schoolId` bắt buộc. Với update/delete, query phải match cả `id` và `schoolId` trong transaction.
6. `Operation`/idempotency uniqueness phải chứa school scope, ví dụ `@@unique([schoolId, actorMembershipId, route, id])`; audit lưu actor user, actor membership và school.
7. Revoke/suspend membership hoặc suspend School phải vô hiệu hóa school business request kế tiếp và xóa school context đã chọn ở client. Session identity có thể còn hợp lệ cho trường khác mà user vẫn thuộc.

Không tin `X-School-Id`, local storage hay schoolId trong request body như authorization proof. Route/context chỉ là input; membership lookup server-side mới là proof.

## 5. Tác động tới schema hiện tại

Schema hiện có là single-school:

- `Admin` giữ Google identity và quyền ngầm cho toàn hệ thống.
- `Class`, `Student`, invoice, bank account và `Operation` không có `schoolId`; `Parent` hiện chưa được tách thành `ParentProfile` global với school context suy ra qua `StudentParent`.
- `StudentParent.revokedBy`, invoice creator/confirmer và `Operation.adminId` trỏ trực tiếp `Admin`.
- `InvoiceTemplate` singleton dùng `singleton Boolean @unique`, không thể tồn tại một cấu hình riêng theo trường.

Clean-break cần thay `Admin` bằng `UserIdentity`, `SchoolMembership` và `SchoolRoleGrant`; thêm owner school vào toàn bộ aggregate tenant-scoped, đồng thời tách `ParentProfile` global khỏi school context suy ra qua `StudentParent -> Student`; chuyển actor/audit relation sang membership. `InvoiceTemplate` vốn đã bị finance blueprint thay thế, nên không cần thiết kế biến thể per-school của nó.

## 6. UX và vận hành

- Nếu user có một membership active, có thể redirect thẳng dashboard trường đó nhưng vẫn có switcher trong app shell.
- Nếu có nhiều membership, sau login vào `Chọn trường`; mỗi item hiển thị logo, mã, tên và địa chỉ như Kidsonline, kèm role label chỉ khi điều đó không làm lộ thông tin nhạy cảm.
- School switcher không được đổi context của form mutation đang dở. Cần cảnh báo discard hoặc khóa switch khi operation pending.
- Mọi trang scoped hiển thị tên trường hiện tại; URL phải giữ school context cho refresh/deep link.
- Parent PWA chỉ liệt kê những trường có `StudentParent` active và `canViewParentPortal`; Parent không được thấy tenant khác chỉ vì dùng cùng Google identity.

## 7. Thứ tự thực hiện

1. Chốt boundary multi-school và control plane PassionEdu trong PRD/architecture superseding artifacts final hiện tại.
2. Thay identity/auth guard; thêm bootstrap `SUPERADMIN_EMAIL`, Platform Operations provisioning tối thiểu, school chooser/membership test trước module nghiệp vụ mới.
3. Rebuild schema seed với Ánh Hoa là `School` đầu tiên và `schoolId` mandatory trên core roster/config/finance.
4. Xây roster, finance ledger, attendance/handover chỉ trên scoped APIs.
5. Thêm invitation/onboarding membership, role grant UI và school switcher khi có ít nhất hai trường hoặc test fixture đa trường.

## 8. Acceptance criteria bắt buộc

- Một UserIdentity được cấp role khác nhau tại hai trường; API chỉ cho thao tác tương ứng từng trường.
- URL/id của bản ghi trường A không thể đọc, cập nhật hoặc xóa qua membership trường B.
- Revoke membership ở trường A chặn request tiếp theo ở A nhưng không ảnh hưởng quyền hợp lệ ở B.
- Mã học sinh, khoản thu và class có thể trùng giữa A/B, nhưng unique trong từng trường.
- Invoice/receipt/nộp trước/attendance/audit không thể join hoặc aggregate lẫn tenant.
- Idempotency key giống nhau được dùng ở hai trường không va chạm; retry trong cùng trường vẫn trả operation cũ.
- Parent với children ở hai trường chỉ thấy dữ liệu theo từng school scope và không đọc chéo qua URL/API.
- Bootstrap UserIdentity từ `SUPERADMIN_EMAIL` có thể đăng nhập Ops và provision/suspend một trường, bootstrap owner, nhưng không thể gọi school business API nếu không có membership hoặc support session hợp lệ.
- UserIdentity có `PlatformOperatorGrant` hiệu lực vào được `ops.passionedu.org` với session audience `ops`; không có `OpsUser` table và grant này không cho vào `app.passionedu.org` hoặc đọc dữ liệu School.
- Platform support metadata không chứa dữ liệu trẻ em, receipt, invoice, attendance hoặc Parent payload.

## 9. Câu hỏi cần chốt

1. Có cần platform support JIT access sau release đầu không? Nếu có, ticket/approval/retention/audit owner là ai?
2. Có shared catalog/policy giữa các trường không? Mặc định nên copy-from-template có audit, không live-share dữ liệu/setting.
3. Parent có thể có trẻ ở nhiều trường thuộc cùng/khác chuỗi không, và giao diện chọn trường nên hiển thị thế nào?
4. Đã chốt: Finance Manager có thể tạo/post reversal theo `FinancePolicy.reversalApprovalMode`; School Admin giữ quyền cấu hình finance policy và write-off quyết toán năm.

## 10. Quyết định portal đã chốt

- Admin và Staff dùng portal chung tại `app.passionedu.org`.
- Parent dùng portal/PWA riêng tại `parent.passionedu.org`.
- Platform Operations dùng portal riêng tại `ops.passionedu.org`.
- API dùng `api.passionedu.org`; authorization không dựa vào hostname mà luôn kiểm tra membership/link hoặc platform capability server-side theo route context.
- Release đầu không dùng subdomain/domain riêng cho từng trường. Parent và Staff chọn/switch trường trong portal chung khi có quyền hợp lệ tại nhiều trường.
- Có thể thêm school-specific subdomain sau này cho branding hoặc entry point. Nó chỉ map sang school context và không thay thế kiểm tra `SchoolMembership` hoặc `StudentParent`.
- Cookie session giữ host-only theo portal. Không dùng cookie `.passionedu.org` chia sẻ mặc định chỉ để tạo SSO xuyên portal.
