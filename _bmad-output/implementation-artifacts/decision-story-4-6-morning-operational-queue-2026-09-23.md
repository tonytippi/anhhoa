# Quyết định Story 4.6: Hàng đợi vận hành buổi sáng

**Ngày:** 2026-09-23

## Quyết định

- Story 4.6 thêm capability `OPERATIONAL_QUEUE_READ`. School Admin và Finance Manager được cấp capability này theo Position; Staff có capability này chỉ xem các Class có `StaffClassAssignment` hiệu lực trong ngày được truy vấn.
- Hàng đợi có mặt ở Admin portal, là read-only và table-first. API có thể phục vụ Staff theo scope được server xác thực, nhưng Story 4.6 không thêm mutation attendance, handover hoặc leave vào Admin.
- Attendance gap có destination Admin read-only riêng, nhận URL filters `date`, `classId` và `status=NOT_RECORDED`. Destination không có control ghi điểm danh.
- Hàng đợi chỉ hiển thị hai loại việc: `attendance-gap` và `pending-leave`. Không đưa handover hay Finance thành chỉ số, bảng hoặc destination chính của Story 4.6.
- Attendance gap là Student `ENROLLED` có Class placement hiệu lực, chưa có `AttendanceRecord` và không có leave `AUTO_APPROVED` hoặc `APPROVED` trong ngày. Leave `PENDING` được đếm riêng và không bị đếm kép vào attendance gap.
- Mặc định ngày là hôm nay theo `Asia/Ho_Chi_Minh`; người dùng có thể chọn ngày ISO hợp lệ. Ngày không vận hành trả kết quả thành công với School/date rõ ràng và queue rỗng có giải thích, không bị diễn giải là API lỗi hay zero attendance đã xác nhận.

## Hệ quả UX

- Quyết định này giải quyết khác biệt giữa mockup Admin cũ có chỉ số leave đã duyệt/handover và Story 4.6. Bề mặt production của Story 4.6 tuân theo scope queue đã chốt ở đây; mockup được giữ làm tham chiếu visual table-first, không là contract dữ liệu/count cho queue này.
- Queue và các destination phải luôn load lại từ server sau khi attendance hoặc leave decision thay đổi. Trạng thái lỗi giữ School/date, không thay bằng số 0 cục bộ.
