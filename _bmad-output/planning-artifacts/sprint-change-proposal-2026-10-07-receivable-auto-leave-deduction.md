---
name: Đơn vị tự do, tự động trừ theo ngày nghỉ là lựa chọn của khoản thu
status: approved
approved: 2026-10-07
date: 2026-10-07
trigger: Khi sửa trực tiếp trên dòng, kế toán có thể sửa học phí thành 12 tháng; hệ thống không hiểu đó là nộp trước nên các tháng sau vẫn thu và không hoàn khi nghỉ học. Phương án đơn vị cố định có quy tắc (chặn số lượng theo đơn vị) đã được cân nhắc và bỏ: kế toán là người duy nhất thao tác màn hình này và chịu trách nhiệm khi tạo hóa đơn. Đồng thời, đề xuất Bớt theo ngày nghỉ đang áp cho mọi khoản có giá hoàn, sai với khoản theo buổi hoặc theo học phần (unit 2-3 tháng).
mode: incremental
amends: sprint-change-proposal-2026-10-01-receivable-refund-price-and-leave-deduction.md (Bớt được đề xuất cho mọi khoản thu có giá hoàn); PromotionPolicyVersion discountValue > 0
---

# Sprint Change Proposal - Đơn vị tự do, tự động trừ theo ngày nghỉ là lựa chọn của khoản thu

## 1. Quyết định

1. **Đơn vị tính** vẫn gõ tự do; ô có gợi ý `tháng, năm, ngày, buổi, unit, lần, bộ, cái`. Hệ thống không gắn quy tắc nào vào đơn vị; số lượng, đơn giá, Bớt trên dòng là quyết định của kế toán.
2. **Tự động trừ theo ngày nghỉ có phép** là lựa chọn của khoản thu (`autoLeaveDeduction`). Bật: mỗi đợt thu đề xuất Bớt = số ngày nghỉ có phép tháng trước × giá hoàn trả (như cũ), kể cả dòng Thu 0 cho khoản đã bớt tháng trước và quyết toán khi nghỉ học. Tắt: Bớt bắt đầu bằng 0, kế toán nhập trên dòng khi cần (giá hoàn của khoản thu được ghi sẵn vào dòng; khác 0 thì cần lý do). Bật cần giá hoàn trả lớn hơn 0 (API và CHECK trong PostgreSQL). Khoản thu đang có giá hoàn trả được bật sẵn khi migration.
3. **Gói nộp trước không giảm**: chính sách `PREPAID_COVERAGE` được phép mức giảm 0; chính sách giảm giá thường vẫn phải lớn hơn 0.
4. **Cảnh báo, không chặn**: trên dòng hóa đơn nháp của khoản thu là mục tiêu của một gói nộp trước đang áp dụng, số lượng lớn hơn 1 hiện cảnh báo "Thu N tháng bằng số lượng thì các tháng sau vẫn bị thu và không được hoàn khi học sinh nghỉ học. Thu nhiều tháng nên dùng gói nộp trước…". Kế toán vẫn lưu được.
5. Học phần (unit) 2-3 tháng: thu ở đợt thu tháng bắt đầu; các tháng sau kế toán loại lớp ngoại khóa khỏi đợt thu (`Loại khỏi đợt này`) hoặc xóa dòng.

## 2. Invariant giữ nguyên

Số nguyên VND; giá hoàn không vượt giá thu; Bớt khác đề xuất cần lý do và audit; API tính mọi số tiền; Operation idempotent.

## 3. Tác động

| Area | Impact |
| --- | --- |
| DB | `Receivable.autoLeaveDeduction` (mặc định false, bật cho khoản có giá hoàn), CHECK cần giá hoàn, trigger append-only cho phép sửa cột này; CHECK mức giảm cho phép 0 với gói nộp trước. |
| API | Tạo/sửa khoản thu nhận `autoLeaveDeduction`; đề xuất Bớt chỉ cho khoản bật; `discountValue` 0 cho `PREPAID_COVERAGE`. |
| Admin web | Ô `Tự động trừ theo ngày nghỉ có phép` và gợi ý đơn vị trong form khoản thu; cột giá hoàn ghi `Tự trừ theo ngày nghỉ`/`Bớt nhập tay`; gợi ý mức giảm 0 cho gói nộp trước; cảnh báo nhiều tháng trên dòng. |
| UX / mockup | `receivable-configuration.html`, `promotion-configuration.html`, `invoice-detail-review.html`, `MOCKUP-COVERAGE.md`, `EXPERIENCE.md`. |
| Spec | `SPEC.md` mục Bớt. |
| Epic 5 | Story 5.44. |
