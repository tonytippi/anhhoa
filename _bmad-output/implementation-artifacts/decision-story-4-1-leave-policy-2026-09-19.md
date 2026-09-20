# Decision: Leave policy baseline cho Story 4.1

**Date:** 2026-09-19

## Quyết định

- Mọi thời điểm và deadline của leave policy luôn đánh giá theo timezone `Asia/Ho_Chi_Minh`; không hỗ trợ timezone khác.
- Khi School chưa có leave policy hiệu lực, API từ chối tạo leave request.
- Leave request có thể bao gồm nhiều ngày.
- Những ngày holiday/non-operating không thuộc leave request. API phải loại trừ các ngày đó khỏi tập ngày yêu cầu và trả về conflict facts để client trình bày kết quả server-authoritative.
- `LeavePolicy` có version theo `effectiveFrom` và trường `nextDayDeadlineLocalTime` dạng `HH:mm`; deadline này áp dụng cho các ngày nghỉ vận hành liền sau ngày gửi đơn. Giá trị ví dụ `15:00` hoặc `16:00` được đánh giá theo `Asia/Ho_Chi_Minh`.
- Actor App có active StaffProfile, active primary SchoolPosition, active SchoolMembership binding va capability `SETTINGS_MANAGE` có quyền duyệt hoặc từ chối đơn `PENDING`.
- Mọi mutation tạo, duyệt hoặc từ chối leave request, kể cả tạo đơn auto-approved, bắt buộc UUID `Idempotency-Key` và persist actor-scoped `Operation`. Retry cùng fingerprint replay outcome; fingerprint thay đổi bị từ chối; sau timeout client phải reconcile qua Operation trước retry.
- Parent chỉ được tạo leave request cho Student có liên kết `StudentParent` đang `ACTIVE` trong School. Giáo viên được xem leave record của Student thuộc Class mà StaffProfile active đã bind với membership/UserIdentity active, primary SchoolPosition active cấp `CLASS_LEAVE_READ`, và có assignment hiệu lực theo ngày liên quan.
- API tạo đơn nhận date range inclusive `startsOn`/`endsOn`. Nếu sau calendar evaluation không còn ngày vận hành, API từ chối request.
- Deadline so sánh inclusive: gửi đúng `nextDayDeadlineLocalTime` vẫn đủ điều kiện auto-approve. Deadline luôn thuộc ngày ngay trước ngày vận hành đầu tiên của leave request, không áp dụng cho ngày hiện tại.
- Policy deadline được snapshot tại thời điểm tạo request và chỉ đánh giá một lần với ngày vận hành đầu tiên trong range. Các ngày vận hành tiếp theo không tham gia deadline/policy evaluation; calendar vẫn được đánh giá từng ngày để xác định operating-day facts.
- Reject request bắt buộc có reason. Persist distinct states `PENDING`, `AUTO_APPROVED`, `APPROVED`, và `REJECTED`.

## Tác động

- Deadline chỉ auto-approve những requested operating days thuộc ngày vận hành kế tiếp; một request chứa ngày muộn hơn, hoặc được gửi sau deadline, là `PENDING` và chờ approval.
- Leave request và snapshot/audit cần lưu các ngày vận hành thực tế sau calendar evaluation, thay vì coi một date range thô là nguồn chính xác cho các story attendance/finance kế tiếp.

## Authorization và đọc Parent

- `StaffProfile` là nguồn nghiệp vụ. Staff có `employmentStatus` (`ACTIVE`/`INACTIVE`) và đúng một primary SchoolPosition School-scoped; capability từ Position, không phải tên Position hay preset role, quyết định phạm vi vận hành. School Admin chỉ phân công Class cho Staff `ACTIVE` có primary Position `ACTIVE` cấp một capability vận hành lớp (`CLASS_LEAVE_READ`, `ATTENDANCE_WRITE` hoặc `DAILY_JOURNAL_WRITE`). Một Class có thể có nhiều StaffClassAssignment hiệu lực.
- Staff co the duoc tao truoc khi co tai khoan. Binding login la relation audit-safe tu StaffProfile den toi da mot SchoolMembership; School Admin quan ly binding nay, nhung Class assignment chi tham chieu StaffProfile, khong nhan membership tu Admin.
- Server authorise teacher leave read qua active SchoolMembership cua session, active StaffProfile binding, `employmentStatus: ACTIVE`, active primary SchoolPosition cap `CLASS_LEAVE_READ`, StaffClassAssignment hieu luc va Student placement hieu luc trong cung Class. Khong suy ra identity tu email hay tin Class/Student ID tu client.
- Parent là actor tạo request, nên Operation dùng `PARENT_PROFILE` provenance. Parent chỉ được đọc hoặc reconcile leave request/Operation do chính ParentProfile đó tạo và chỉ khi StudentParent link vẫn `ACTIVE`; tên API không phải product contract.
