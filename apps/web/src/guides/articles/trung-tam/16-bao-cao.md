---
title: Báo cáo tài chính
summary: Theo dõi phải thu, đã thu, công nợ, sổ tiền theo từng đợt và xuất CSV theo thời điểm chốt.
order: 16
requires: finance-reports
---
Mở `Tài chính › Báo cáo`. Chọn bộ lọc (`Tháng thu` dạng YYYY-MM, `Lớp`, `Nhóm khoản thu`, `Thời điểm chốt`) rồi bấm `Xem số liệu`. Dòng "Số liệu chốt …" cho biết số liệu tính đến lúc nào.

> `Tháng thu` của một đợt là **tháng có ngày bắt đầu kỳ**. Học phí cả unit được ghi trọn vào tháng đó, kể cả khi unit kéo dài sang tháng sau.

## Tổng quan

![Thẻ Tổng quan](tt-bao-cao-tong-quan.jpg)

Bốn chỉ số chính: **Phải thu ròng** (sau ưu đãi, bớt, thuế và nợ chuyển kỳ), **Đã thu**, **Còn phải thu**, **Đã chi hoàn**. Bên dưới là biểu đồ theo tháng, diễn giải từ tổng phải thu đến phải thu ròng và tiến độ thu theo đợt (mỗi đợt ghi tên lớp và tên kỳ).

## Đối soát đợt thu

![Thẻ Đối soát đợt thu theo từng đợt của lớp](tt-bao-cao-doi-soat.jpg)

Số hóa đơn đã phát hành, đã thu đủ, chênh lệch chờ chuyển kỳ sau và đã chuyển kỳ; bảng đối soát theo từng đợt thu của từng lớp.

## Công nợ

Công nợ hiện tại, nợ kỳ trước, công nợ theo thời gian quá hạn và danh sách **Học sinh còn nợ nhiều nhất** — dùng để nhắc phụ huynh.

- **Công nợ hiện tại** chỉ tính các hóa đơn đã phát hành mà chưa ghi thực nhận.
- Khoản thu thiếu/thừa của hóa đơn đã ghi thực nhận nằm ở **Chênh lệch chờ kỳ sau** cho đến khi được cộng/trừ vào hóa đơn kỳ sau, nên không bị tính hai lần.

## Sổ tiền và điều chỉnh

Tiền vào, tiền ra theo tuần và nhật ký mọi sự kiện: phát hành, hủy hóa đơn, phiếu thu, chênh lệch, chuyển kỳ…

## Xuất CSV

Bấm `Tải CSV` để tải đúng các dòng đang xem, kèm thời điểm chốt và múi giờ. Mở bằng Excel/Google Sheets để đối chiếu với sổ sách.
