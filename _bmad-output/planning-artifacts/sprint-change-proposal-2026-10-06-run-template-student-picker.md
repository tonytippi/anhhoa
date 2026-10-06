---
name: Bộ chọn học sinh cho phạm vi khoản thu trong đợt thu
status: approved
approved: 2026-10-06
date: 2026-10-06
trigger: Khi chọn phạm vi `Học sinh cụ thể` trong hộp `Thêm khoản thu` của đợt thu, modal hiện 30 học sinh đầu tiên thành một khối chip checkbox (sắp theo mã dạng chuỗi PL1, PL10, PL100…) cùng một khung `Học sinh đã chọn` rỗng; không lọc theo lớp, không biết đã chọn bao nhiêu. Mockup chỉ vẽ hai chip đã chọn.
mode: incremental
---

# Sprint Change Proposal - Bộ chọn học sinh cho phạm vi khoản thu trong đợt thu

## 1. Quyết định

1. Phạm vi `Học sinh cụ thể` trong hộp `Thêm khoản thu` / `Sửa` của đợt thu dùng cùng bộ chọn với `Gán ưu đãi cho học sinh` (`sprint-change-proposal-2026-10-06-promotion-assignment-picker.md`): select `Lớp chính thức`, ô `Tìm học sinh` (mã hoặc tên), bảng ☐ / Mã HS / Họ tên / Lớp chính thức trong vùng cuộn có chiều cao cố định, ô chọn tất cả học sinh đang hiện, dòng `Đã chọn N học sinh`.
2. Lựa chọn giữ qua các lần lọc để gom học sinh nhiều lớp; mở `Sửa` giữ nguyên học sinh của dòng mẫu.
3. `GET /api/app/schools/:schoolId/finance/collection-runs/:runId/scope-options` nhận thêm `officialClassId`, trả toàn bộ học sinh `ENROLLED` của năm học của đợt thu (bỏ giới hạn 30), sắp theo lớp rồi mã học sinh theo thứ tự số tự nhiên.
4. Lệnh lưu dòng mẫu `PUT .../collection-runs/:runId/template-lines` không đổi: server vẫn kiểm tra học sinh thuộc năm học của đợt thu.

## 2. Invariant giữ nguyên

School-scoped query, capability Finance, khoản cố định khóa phạm vi `Toàn bộ`, khoản Ngoại khóa không chọn được, lưu dòng mẫu là Operation idempotent.

## 3. Tác động

| Area | Impact |
| --- | --- |
| UX / mockup | `invoice-generation.html` (hộp dòng mẫu), `MOCKUP-COVERAGE.md`, `EXPERIENCE.md`. |
| Epic 5 | Thêm Story 5.40. |
| API | `scope-options` có lọc lớp, không giới hạn số học sinh, sắp tự nhiên; không thêm migration. |
| Admin web | Bảng chọn học sinh trong modal dòng mẫu. |
| Verification | Controller/service test cho lọc lớp và thứ tự, web test cho lọc, chọn tất cả và giữ lựa chọn. |
