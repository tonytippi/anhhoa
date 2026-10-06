---
name: Bộ chọn học sinh khi gán ưu đãi
status: approved
approved: 2026-10-06
date: 2026-10-06
trigger: Hộp `Gán ưu đãi cho học sinh` liệt kê mọi Student của School thành một khối checkbox (sắp theo mã dạng chuỗi PL1, PL10, PL100…), không tìm/lọc, không biết ai đã có ưu đãi; với trường hơn 100 học sinh, kế toán không dùng được. Mockup chỉ vẽ hai học sinh.
mode: incremental
---

# Sprint Change Proposal - Bộ chọn học sinh khi gán ưu đãi

## 1. Quyết định

1. Hộp `Gán ưu đãi cho học sinh` là modal rộng, dùng lại bộ chọn của `Thêm học sinh` ở Lớp ngoại khóa: select `Lớp chính thức`, ô `Tìm học sinh` (mã hoặc tên), bảng ☐ / Mã HS / Họ tên / Lớp chính thức trong vùng cuộn có chiều cao cố định, ô chọn tất cả học sinh đang hiện, dòng `Đã chọn N học sinh`.
2. Lựa chọn giữ qua các lần lọc để gom học sinh nhiều lớp. Học sinh đã có gán cùng chính sách chồng lấp khoảng áp dụng đang nhập bị khóa kèm `Đã gán ưu đãi này` và tự bỏ khỏi lựa chọn.
3. `GET /api/app/schools/:schoolId/finance/promotion-students` nhận `versionId` (bắt buộc), `q`, `officialClassId`, `effectiveFrom`, `effectiveTo`. Server chọn SchoolYear chứa ngày bắt đầu (mặc định hôm nay hoặc ngày hiệu lực phiên bản nếu muộn hơn), trả học sinh `ENROLLED`/`SCHEDULED_TO_START` của năm đó kèm tên lớp chính thức và cờ `assigned`, sắp theo lớp rồi mã học sinh theo thứ tự số tự nhiên.
4. Lệnh gán `POST .../promotion-policy-versions/:versionId/assignments` không đổi: server vẫn kiểm tra toàn bộ danh sách, hiệu lực và chồng lấp; picker chỉ là gợi ý.

## 2. Invariant giữ nguyên

School-scoped query, capability Finance, thời hạn/lý do chung cho cả nhóm, lưu nguyên khối, audit `STUDENT_PROMOTION_ASSIGNMENTS_CREATED`.

## 3. Tác động

| Area | Impact |
| --- | --- |
| UX / mockup | `promotion-configuration.html` (hộp gán), `MOCKUP-COVERAGE.md`, `EXPERIENCE.md`. |
| Epic 5 | Thêm Story 5.39. |
| API | Endpoint ứng viên có tham số lọc và cờ `assigned`; không thêm migration. |
| Admin web | Modal rộng với bảng chọn; trang Ưu đãi không còn tải danh sách học sinh khi mở. |
| Verification | PostgreSQL integration (năm học, lifecycle, lọc, cờ chồng lấp, cross-School), controller, web test. |
