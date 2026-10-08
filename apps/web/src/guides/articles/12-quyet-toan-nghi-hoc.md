---
title: Học sinh nghỉ học (quyết toán)
summary: Tạo hóa đơn quyết toán cho học sinh đã nghỉ, phát hành phiếu hoàn tiền và ghi nhận đã chi.
order: 12
requires: collection-runs
---
Khi học sinh nghỉ học, trường có thể phải trả lại tiền ăn chưa dùng hoặc học phí đã nộp trước. Việc này làm bằng **hóa đơn quyết toán** trong đợt thu của tháng kế tiếp.

## Các bước

1. Mở đợt thu tháng sau tháng học sinh nghỉ, ở trạng thái `Đã tạo hóa đơn`.
2. Tìm mục **Cần quyết toán**: liệt kê học sinh nghỉ học từ tháng trước, kèm ngày nghỉ và trạng thái.
3. Bấm `Tạo hóa đơn quyết toán`. Hóa đơn này **không có khoản thu mới**, chỉ gồm phần trả lại tiền ăn chưa dùng và hoàn học phí nộp trước.
4. Mở hóa đơn bằng `Rà soát hóa đơn`, kiểm tra số tiền.
   - Nếu tổng âm, nút phát hành là `Phát hành phiếu hoàn tiền`.
5. Phát hành như hóa đơn bình thường.
6. Chuyển tiền cho phụ huynh, sau đó vào `Thu tiền`, tìm dòng `Chờ chi hoàn` và chọn `Ghi nhận đã chi` (xem [Ghi nhận thu tiền](guide:thu-tien)).

> Nếu hệ thống báo "Không có tiền ăn chưa dùng, học phí nộp trước hay số dư chuyển kỳ cần quyết toán cho học sinh này." thì học sinh không có khoản nào cần trả lại.

> Với học sinh vẫn đang học, phần tổng âm của một tháng (ví dụ bớt nhiều hơn số phải thu) **không hoàn ngay** mà được trừ vào hóa đơn tháng sau; hóa đơn đó tự đóng khi phát hành.
