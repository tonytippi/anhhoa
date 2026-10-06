---
name: Một hộp Chỉnh sửa khoản thu
status: approved
approved: 2026-10-06
date: 2026-10-06
trigger: Menu `...` của mỗi dòng Khoản thu có ba thao tác sửa cùng một bản ghi (`Chỉnh sửa`, `Đổi mức thuế suất`, `Đổi giá hoàn trả`), mỗi thao tác một hộp thoại và một endpoint. Mockup đã review chỉ có `Chỉnh sửa` và `Ngừng áp dụng`; form tạo đã có đủ các trường.
mode: incremental
amends: sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md §3.5; sprint-change-proposal-2026-09-30-taxed-receivables-and-two-payment-channels.md (đổi mức thuế); sprint-change-proposal-2026-10-01-receivable-refund-price-and-leave-deduction.md D1 (đổi giá hoàn trả)
---

# Sprint Change Proposal - Một hộp Chỉnh sửa khoản thu

## 1. Vấn đề

Ba thao tác sửa được thêm dần theo từng story (đổi thuế 2026-09-30, giá hoàn trả 2026-10-01, tên/đơn vị/giá/nhóm 2026-10-02). Kết quả là kế toán phải đoán trường nào sửa ở hộp nào, và hộp `Chỉnh sửa` gọi hai endpoint nối tiếp (chi tiết rồi nhóm) nên có thể lưu được một nửa khi đổi nhóm bị từ chối.

## 2. Quyết định

1. Row menu khoản thu chỉ còn `Chỉnh sửa`, `Xem lớp ngoại khóa` (khoản Ngoại khóa) và `Ngừng áp dụng`/`Kích hoạt`. Bỏ `Đổi mức thuế suất` và `Đổi giá hoàn trả`.
2. Hộp `Chỉnh sửa` có các trường như form tạo: tên, đơn vị tính, nhóm (khóa kèm hint khi đã dùng), `Giá / đơn vị (chưa VAT)`, `Giá hoàn trả / đơn vị (chưa VAT)`, `Mức thuế suất` (hint kênh thu), và `Lý do` bắt buộc. Một ghi chú cuối hộp: đổi giá, giá hoàn trả hoặc mức thuế chỉ áp dụng cho dòng hóa đơn thêm mới hoặc làm mới sau đó; đợt thu còn nháp cần xem trước lại.
3. API: `PUT /api/app/schools/:schoolId/finance/receivables/:receivableId` là lệnh sửa duy nhất. Body nhận các trường thay đổi (`displayName`, `unitLabel`, `defaultUnitPrice`, `kind`, `taxCategory`, `refundUnitPrice`) và `reason` bắt buộc; trường vắng mặt giữ nguyên. Một Operation, một Idempotency-Key, một audit `RECEIVABLE_EDITED` với before/after đầy đủ và reason. Bất kỳ lỗi nào (nhóm đã khóa `RECEIVABLE_KIND_LOCKED`, giá hoàn trả vượt đơn giá, không có thay đổi) đều không lưu trường nào.
4. Bỏ các endpoint `.../kind`, `.../tax-category`, `.../refund-price` và audit action riêng `RECEIVABLE_KIND_CHANGED`, `RECEIVABLE_TAX_CATEGORY_CHANGED`, `RECEIVABLE_REFUND_PRICE_CHANGED` cho thay đổi mới. Audit đã ghi giữ nguyên.

## 3. Invariant giữ nguyên

- Tenant root `School`, FOR UPDATE trên Receivable, khóa nhóm khi đã dùng (§3.1 2026-10-02), giá hoàn trả không vượt đơn giá (A1 2026-10-01), snapshot InvoiceLine không bị rewrite, preview DRAFT stale khi template snapshot đổi.
- Browser không gửi VAT, kênh hay tổng tiền; server tính lại mọi giá trị.

## 4. Tác động

| Area | Impact |
| --- | --- |
| UX spine / mockup | `EXPERIENCE.md` (Khoản thu), `mockups/admin/receivable-configuration.html` (hộp `Chỉnh sửa` thêm giá hoàn trả, mức thuế suất, lý do), `MOCKUP-COVERAGE.md`. |
| Epic 5 | Thêm Story 5.38. |
| API | Gộp lệnh sửa; xóa ba route con. |
| Admin web | Một hộp thoại; bỏ hai hộp thoại riêng. |
| Verification | Unit/controller, PostgreSQL integration (bao gồm lỗi nhóm khóa không lưu trường khác), web test. |
