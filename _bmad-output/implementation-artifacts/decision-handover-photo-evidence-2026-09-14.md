# Quyết định: Ảnh bằng chứng khi trả trẻ

**Ngày:** 2026-09-14
**Trạng thái:** Đã quyết định
**Phạm vi:** Attendance/handover, Teacher portal, Parent projection và School settings

## Quyết định

Handover có một School-scoped evidence setting riêng: `handoverPhotoEvidenceMode` với hai giá trị `REQUIRED` hoặc `OPTIONAL`.

- `REQUIRED` khiến API từ chối xác nhận `pickedUpAt` khi không có ảnh bằng chứng hợp lệ.
- `OPTIONAL` cho phép Teacher xác nhận giờ trả trẻ không có ảnh; ảnh được gửi vẫn là evidence được bảo vệ.
- Teacher portal vẫn là surface duy nhất ghi `pickedUpAt` và tải ảnh evidence. School Admin chỉ cấu hình mode trong `Điểm danh & bàn giao`; không ghi trả trẻ từ Admin.
- Handover evidence được đọc duy nhất bởi Teacher có handover capability hoặc School Admin trong cùng School. Parent không nhận media URL, preview, blob, Staff identity, internal reason hoặc bất kỳ metadata evidence nào.
- Blob/preview bị xóa hai tháng lịch sau khi handover được xác nhận; giữ audit metadata và deletion timestamp. Staff/Admin sau cleanup thấy `Tệp bằng chứng đã hết hạn`.
- Handover confirmed tạo một in-app Parent event idempotent. Parent projection chỉ gồm Student display-name snapshot, date, confirmed picked-up time và updated time, sau active `StudentParent`, ParentSchoolContext và retention recheck. Không có SMS/email/Zalo/chat.
- Handover vẫn là operational reference, không phải pickup authorization và không tính/gợi ý/tự động post late-pickup fee. Finance chỉ có thể đọc immutable reference/evidence-audit-safe snapshot khi được authorize cho quyết định `MANUAL`.

## Lý do

School cần một thiết lập đơn giản, dễ hiểu cho hai thời điểm có ảnh bằng chứng: nhận trẻ và trả trẻ. Cutoff/grace/block policy trong UI Settings không phục vụ mục tiêu đó và tạo cảm giác cấu hình phức tạp không cần thiết.

## Hệ quả

- `AttendancePolicy.photoEvidenceMode` được giữ nguyên cho `PRESENT`.
- Handover policy cutoff/grace/block không thuộc release này; không tạo model/API/UI cho các field đó.
- API/schema implementation sau này cần persist mode, evidence reference/deletion audit và protected Parent handover projection. Mockup chỉ minh họa contract, không thêm backend/storage thật.
- Release gates phải chứng minh required-evidence rejection, tenant/capability isolation, two-calendar-month cleanup, Parent minimum DTO/revoke/retention và idempotent notification cho handover.
