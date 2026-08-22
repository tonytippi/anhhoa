# Epic 5 Context: Admin quản lý quyền xem của phụ huynh

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Cho phép Admin gán hoặc thu hồi email Parent cho từng Học sinh, để Parent chỉ được truy cập dữ liệu của các Học sinh còn có liên kết hiệu lực tại thời điểm request. Epic thiết lập dữ liệu quan hệ, thao tác quản trị và service authorization dùng lại cho Parent PWA về sau; việc revoke có hiệu lực ngay nhưng không xóa lịch sử.

## Stories

- Story 5.1: Lưu trữ liên kết Parent-Học sinh.
- Story 5.2: Admin cấp và thu hồi quyền Parent theo từng Học sinh.
- Story 5.3: Kiểm tra quyền Parent theo từng request.

## Requirements & Constraints

- `Parent` lưu `id`, `emailNormalized`, `googleSubject` có thể chưa có trước lần đăng nhập đầu, `displayName` và `status`. `StudentParent` lưu `parentId`, `studentId`, `status`, `createdAt`, `revokedAt`, `revokedBy`, với foreign key đến Parent và Student.
- Quan hệ là nhiều-nhiều, được giữ lại: một Parent có thể có nhiều Học sinh và một Học sinh có thể có nhiều Parent. PostgreSQL phải enforce unique `(parentId, studentId)`.
- Grant chuẩn hóa email bằng `trim` và lowercase, tạo hoặc tái sử dụng Parent, rồi tạo liên kết hoặc chỉ reactivate liên kết duy nhất đang `REVOKED`; không tạo bản ghi trùng. Liên kết mới hiệu lực ngay, không có bước chờ xác minh.
- Admin có thể gán một hoặc nhiều email hợp lệ cho cùng một Học sinh. API xử lý toàn bộ danh sách trong một transaction và trả kết quả theo từng email: đã tạo, đã reactivate hoặc đã liên kết `ACTIVE`. Nếu có email không hợp lệ, từ chối request trước khi bất kỳ liên kết nào thay đổi.
- Revoke chỉ cho phép `ACTIVE -> REVOKED`, ghi thời điểm và Admin thu hồi; không hard-delete Parent, Student hoặc StudentParent. Một Parent còn liên kết `ACTIVE` với Học sinh khác vẫn giữ Parent session và quyền của Học sinh đó.
- Sau revoke, server phải từ chối request kế tiếp cho Học sinh bị thu hồi. Authorization không được tin `studentId`, `invoiceId`, UUID, filter hay URL từ client làm bằng chứng quyền.
- Authorization chỉ chấp nhận Parent `ACTIVE` cùng `StudentParent` `ACTIVE`, được kiểm tra server-side cho mọi request Parent trước khi tạo query hoặc DTO Parent. Contract response của endpoint Parent là phạm vi Epic 6.
- Grant, revoke và thao tác bulk là cookie-auth mutations: bắt buộc origin validation, double-submit CSRF và UUID `Idempotency-Key`. Timeout không đồng nghĩa thất bại; chỉ retry sau khi đối soát operation.
- Phạm vi không gồm Parent OAuth/session, `apps/parent-web`, Parent portal endpoint/read DTO, payment/QR hoặc sửa lifecycle Hóa đơn. Không thêm audit access, retention, monitoring hay incident ownership riêng cho Parent PWA.

## Technical Decisions

- `apps/api` là chủ sở hữu duy nhất của Prisma schema, migration, authorization và trạng thái liên kết. Schema, migration và test seed chỉ nằm trong `apps/api/prisma`; migration phải được commit, không dùng `prisma db push` cho môi trường production-like.
- Thêm module Nest `parents`; module này sở hữu lifecycle `Parent` và `StudentParent`. Các Admin endpoint cấp/thu hồi delegate tới `parents` service; controller chỉ gọi service và không controller nào gọi controller domain khác.
- Dùng Prisma migration cho model/relation/status retained. Enum liên kết chỉ có `ACTIVE` và `REVOKED`; UUID là định danh. REST JSON dùng camelCase và lỗi chuẩn `{ error: { code, message, fieldErrors? } }`.
- API scope idempotency theo Admin đã xác thực + route, atomically lưu request fingerprint và final response cùng mutation. Cùng key/cùng request replay kết quả; cùng key/request khác trả conflict. `GET /operations/:operationId` trả outcome cho đúng Admin để UI reconcile.
- Service authorization cần là dependency hẹp có thể được Parent surface gọi sau này; nhận Parent identity và context Student/Invoice, kiểm tra Parent/link hiện hành trước khi query dữ liệu hoặc dựng DTO. Không sao chép quyền sang client hay endpoint Admin.
- Viết PostgreSQL integration tests chứng minh unique constraint, grant/reactivate, revoke retained, nhiều Parent-nhiều Học sinh, và revoke một Học sinh không làm Parent mất quyền với Học sinh khác. Test phải chứng minh authorization từ chối trước query/DTO Parent; bổ sung kiểm thử mutation security và idempotency cho grant/revoke.

## UX & Interaction Patterns

- Bề mặt quản lý Parent nằm trên chi tiết một Học sinh. Admin chỉ thấy email Parent liên quan cùng trạng thái `ACTIVE` hoặc `REVOKED`; không hiển thị dữ liệu Parent hay Học sinh không liên quan.
- Cấp quyền cho phép nhập một hoặc nhiều email hợp lệ rồi xác nhận. Lỗi email/validation hiển thị tại field và giữ dữ liệu đã nhập; kết quả thành công phản ánh theo từng email.
- Thu hồi một liên kết `ACTIVE` luôn dùng confirmation modal nêu email Parent và Học sinh bị ảnh hưởng, có `Hủy` là action phụ. Modal trap focus, trả focus về trigger khi đóng, không tự focus nút phá hủy; khi gửi khóa action và không cho đóng.
- Khi timeout hoặc mất kết nối sau grant/revoke, khóa trigger, hiển thị `Đang kiểm tra kết quả`, gọi `GET /operations/:operationId`; chỉ cho retry khi server xác nhận thao tác chưa áp dụng. Hiển thị lỗi gần action và toast ngắn, không dùng toast thay validation hay confirmation.
- Kế thừa Admin design system: nền kem, card/modal trắng viền mảnh, CTA xanh lá, Inter cho nội dung và Clash Grotesk cho heading. Tuân WCAG 2.2 AA: status có nhãn chữ, dialog chuẩn, action không chỉ hiện khi hover và target icon tối thiểu 40x40px.

## Cross-Story Dependencies

- Story 5.1 phải hoàn thành trước Story 5.2 và 5.3 vì cung cấp migration, mô hình retained và lifecycle liên kết.
- Story 5.2 dùng `parents` service của Story 5.1 và application shell/auth Admin từ Epic 1, cùng màn hình chi tiết Học sinh từ Epic 2.
- Story 5.3 dùng relation/service của Story 5.1; nó là nền tảng bắt buộc trước Parent OAuth và Parent portal endpoints ở Epic 6.
- Parent session, client cache clearing và revalidation khi revoke được triển khai tại Epic 6; Epic 5 bảo đảm server đã có trạng thái và authorization để các request sau revoke bị từ chối.
