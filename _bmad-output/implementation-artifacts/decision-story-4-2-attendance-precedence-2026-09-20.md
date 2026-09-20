# Quyết định Story 4.2: Attendance là sự thật vận hành

**Ngày:** 2026-09-20

## Quyết định

- Attendance lưu trực tiếp theo unique `(schoolId, classId, studentId, attendanceOn)`; không tạo `ClassSession` trong Story 4.2.
- `AttendanceRecord` chỉ persist `PRESENT` hoặc `ABSENT`. `NOT_RECORDED` và `ON_LEAVE` là trạng thái read-model suy luận bởi API, không persist.
- `AttendanceRecord` là sự thật vận hành cao hơn leave. Khi record tồn tại, projection trả `PRESENT` hoặc `ABSENT` dù tồn tại `LeaveRequestDay` thuộc leave `AUTO_APPROVED` hoặc `APPROVED`.
- Confirmed leave không chặn attendance write và không bị hard-delete hay tự đổi hồi tố khi attendance được ghi. Leave giữ vai trò lịch sử kế hoạch/audit.
- Parent projection trả attendance nếu record tồn tại; nếu chưa có record nhưng có leave confirmed thì trả `ON_LEAVE`; còn lại trả `NOT_RECORDED`. Teacher/Admin thấy attendance state riêng với leave context.
- `PRESENT` yêu cầu `evidenceId` khi AttendancePolicy effective là `REQUIRED`; `ABSENT` không yêu cầu evidence. Story 4.2 chỉ persist opaque, School-scoped access-controlled evidence reference. Upload/read URL, MIME/storage lifecycle, cleanup, Parent exclusion proof và notification source thuộc Story 4.3.
- Attendance cùng ngày dùng upsert state hiện hành; mọi write thành công phải lưu audit provenance. Không thêm revision aggregate trong Story 4.2.

## Hệ quả

- API không trả conflict cho `PRESENT` cùng confirmed leave.
- Roster query suy luận ở server: record `PRESENT`/`ABSENT`, rồi leave confirmed `ON_LEAVE`, rồi `NOT_RECORDED`.
- Báo cáo/eligibility downstream dùng attendance thực tế khi có record. Hủy/sửa leave chỉ là thao tác kế hoạch tương lai, không là điều kiện để Staff xác nhận thực tế.
