---
name: Sửa dòng hóa đơn trực tiếp trên bảng
status: approved
approved: 2026-10-07
date: 2026-10-07
trigger: Ở trang `Rà soát hóa đơn`, mỗi dòng có tới ba nút (`Sửa`, `Điều chỉnh`, `Sửa bớt`), mỗi nút mở một modal riêng cho số lượng/đơn giá hoặc phần bớt. Kế toán quen Excel và phần mềm cũ (Kidsonline, `docs/kidsonline/thong-tin-thu-phi.png`) cho sửa `Thu` và `Bớt` ngay trên dòng rồi cập nhật một lần.
mode: incremental
amends: sprint-change-proposal-2026-10-06-invoice-review-lines-first.md §1.3 (nút `Sửa` mở hộp thoại dòng); sprint-change-proposal-2026-10-01-receivable-refund-price-and-leave-deduction.md (hộp `Sửa bớt`); nguyên tắc "mọi thao tác qua modal" của trang Admin không áp dụng cho bảng dòng hóa đơn nháp
---

# Sprint Change Proposal - Sửa dòng hóa đơn trực tiếp trên bảng

## 1. Quyết định

1. Trên hóa đơn nháp, mỗi dòng khoản thu có ô nhập ngay trong bảng: `Số lượng`, `Đơn giá`, và `Bớt` (số lượng × giá hoàn). Bỏ nút `Sửa`, `Điều chỉnh`, `Sửa bớt` và hai modal tương ứng. Dòng công nợ kỳ trước và hóa đơn không còn nháp chỉ đọc.
2. Ô lý do hiện ở hàng phụ ngay dưới dòng khi cần: `Lý do đổi đơn giá` khi đơn giá khác giá hiện tại; `Lý do sửa phần bớt` khi phần bớt khác số đề xuất, kèm `Dùng số đề xuất`.
3. Trình duyệt không tự tính tiền. Khi kế toán ngừng gõ khoảng 300 ms, các thay đổi được gửi tới lệnh tính thử `POST /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines/preview`. Máy chủ chạy đúng quy tắc của lệnh lưu trong một transaction rồi rollback, trả hóa đơn kèm các phần; không ghi Operation, không audit. Số dự kiến hiện in nghiêng trên dòng, tổng phần và tổng phiếu thu. Lý do không đổi số tiền nên tính thử không bắt buộc lý do.
4. Thanh `N dòng đã sửa · Hoàn tác · Lưu thay đổi` dính cuối bảng. `Lưu thay đổi` gọi `PUT /api/app/schools/:schoolId/finance/invoices/:invoiceId/lines` với `{ lines: [{ lineId, quantity?, unitPrice?, overrideReason?, deductionQuantity?, refundUnitPrice?, deductionReason? }] }` (chỉ các giá trị đã đổi). Một Operation idempotent, lưu tất cả hoặc không lưu gì, các dòng có thể thuộc cả hai phần của cùng phiếu thu (cùng học sinh, cùng đợt thu); mỗi dòng ghi audit `INVOICE_LINE_EDITED` và/hoặc `INVOICE_LINE_DEDUCTION_EDITED` như lệnh cũ.
5. Lỗi theo dòng có khóa `lines.<lineId>.<field>` và hiện ngay dưới ô tương ứng; lưu lỗi thì focus ô lỗi đầu tiên.
6. Khi còn thay đổi chưa lưu: `Phát hành`, `Thêm dòng`, `Nguồn`, `Xóa` bị khóa; `Quay lại đợt thu`, `Học sinh trước/tiếp theo` và rời trang hỏi xác nhận bỏ thay đổi.
7. `Nguồn giải thích thủ công` (ít dùng) mở bằng nút `Nguồn` trên dòng, hộp thoại chỉ có các trường nguồn. `Thêm dòng` vẫn là hộp thoại.

## 2. Invariant giữ nguyên

API là nguồn duy nhất cho số tiền, ưu đãi, thuế, giới hạn giá hoàn (không vượt đơn giá thu; hoàn học phí nộp trước không vượt phần đã nộp còn lại) và tổng. Lệnh dòng đơn lẻ cũ giữ nguyên cho tương thích. School-scoped query, capability Finance, origin/CSRF cho cả lệnh tính thử.

## 3. Tác động

| Area | Impact |
| --- | --- |
| UX / mockup | `invoice-detail-review.html`, `MOCKUP-COVERAGE.md`, `EXPERIENCE.md`. |
| Epic 5 | Thêm Story 5.43. |
| API | Lệnh lưu nhiều dòng và lệnh tính thử; không migration. |
| Admin web | Bảng sửa trực tiếp, thanh lưu, khóa thao tác khi chưa lưu; bỏ modal `Điều chỉnh`/`Sửa bớt`. |
| Verification | Integration test tính thử không ghi gì, lưu khớp tính thử, lỗi theo dòng, all-or-nothing, khác Trường 404; controller test; web test; e2e release gate dùng sửa trên dòng. |
