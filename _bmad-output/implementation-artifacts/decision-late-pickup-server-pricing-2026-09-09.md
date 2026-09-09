# Quyết định: Tính phí đón muộn phía máy chủ

**Trạng thái:** Decision draft cho contract mockup; cần Product và Architecture phê duyệt trước khi làm API hoặc persistence.

## Quyết định

Phí đón muộn là chính sách typed/versioned theo Trường. Mỗi policy hiệu lực gồm các block thời gian có thứ tự, không chồng lấn, với giờ bắt đầu, giờ kết thúc và giá VND nguyên cho mỗi block. Một block được đạt khi thời điểm trả trẻ đã xác nhận bằng hoặc sau giờ bắt đầu của block; giờ kết thúc không kích hoạt block kế. Vì vậy, trả trẻ đúng 18:00 sau block 17:38-18:00 chỉ đạt block 17:38, còn block 18:05 chưa đạt. Khoảng trống không đạt block mới và không làm tròn thời điểm trả trẻ sang block sau.

Máy chủ dùng thời điểm trả trẻ từ handover đã xác nhận làm source fact duy nhất. Máy chủ cộng giá VND nguyên của mọi block đạt, materialize khoản phí kết quả và snapshot phiên bản policy, các block đạt cùng source handover. Browser chỉ render policy và thống kê đã materialize do máy chủ trả về; không được tính, làm tròn, tạo hoặc sửa khoản phí.

Sau materialization, hậu sửa handover không tự điều chỉnh hoặc hoàn tiền khoản phí. Miễn phí, override, thời điểm materialize và correction trước materialization là các quyết định tiếp theo cần chốt rõ.

## Ranh giới

- Decision này không định nghĩa phí nộp tiền muộn, rate, grace period, compounding, exemption, ledger treatment hoặc permission của nó.
- Snapshot Invoice đã phát hành vẫn bất biến.
- API, persistence, authorization và lifecycle cần một thay đổi theo sau được phê duyệt riêng trước khi xây dựng.
