---
title: Học sinh vào giữa kỳ, chuyển lớp, nghỉ học
summary: Thêm hóa đơn cho học sinh vào lớp sau khi đã tạo hóa đơn, xử lý chuyển lớp và Trùng kỳ, học sinh nghỉ hoặc quay lại.
order: 13
requires: collection-runs
pages: collection-runs, receipt-queue, students
---
## Học sinh vào lớp giữa kỳ

Học sinh được xếp vào lớp **trước khi** tạo hóa đơn nháp sẽ tự có hóa đơn. Nếu em vào lớp **sau khi** đợt đã tạo hóa đơn:

1. Mở đợt thu của lớp (trạng thái `Đã tạo hóa đơn`).
2. Bấm `Thêm học sinh` trong bảng **Hóa đơn trong đợt**, chọn em rồi `Yêu cầu thêm`. Chỉ học sinh của lớp này mới hiện trong danh sách.
3. Hóa đơn bổ sung tính **trọn kỳ**. Nếu chỉ thu phần còn lại của unit, sửa số lượng hoặc dùng `Bớt` trên hóa đơn nháp, kèm lý do, rồi phát hành.

> Đợt đã đóng thì không thêm được học sinh. Hãy thêm xong học sinh vào giữa kỳ trước khi đóng đợt.

## Chuyển lớp giữa kỳ

Chuyển lớp làm ở `Danh bộ › Học sinh › Chuyển danh bộ` (xem [Lớp học và học sinh](guide:lop-hoc-va-hoc-sinh)). Hóa đơn đã tạo ở lớp cũ không đổi. Khi lớp mới tạo hóa đơn cho kỳ có ngày trùng, các dòng mà em đã có ở lớp cũ được gắn nhãn `Trùng kỳ`:

- Học sinh thật sự học cả hai lớp: thu đủ.
- Học sinh chỉ chuyển lớp và đã đóng tiền ở lớp cũ: giảm số lượng, dùng `Bớt` hoặc xóa dòng trên hóa đơn ở lớp mới.

Hệ thống không tự bỏ dòng nào; kế toán quyết định trước khi phát hành. Công nợ và chênh lệch thu thiếu/thừa của em **đi theo học sinh** sang lớp mới.

## Học sinh nghỉ học

- **Nghỉ buổi không tự hoàn tiền.** Hệ thống không tự trừ tiền khi học sinh nghỉ buổi. Muốn giảm, kế toán nhập `Bớt` bằng tay trên dòng hóa đơn, kèm lý do.
- **Nghỉ hẳn:** trung tâm không có hóa đơn quyết toán hay phiếu hoàn tiền tự động. Nếu trả lại tiền, thực hiện ngoài phần mềm theo thỏa thuận và ghi chú lại. Hóa đơn chưa thu của em vẫn nằm ở trang `Thu tiền` cho tới khi ghi thực nhận.

## Học sinh nghỉ rồi quay lại

Học sinh nghỉ rồi quay lại là **hồ sơ mới**: em được tạo lại như một học sinh mới. Hóa đơn chưa thu của hồ sơ cũ **không chuyển sang** hồ sơ mới và không hiện ở mục `Công nợ kỳ trước` của hồ sơ mới; phải thu trên hồ sơ cũ ở trang `Thu tiền`.
