---
name: Trang rà soát hóa đơn ưu tiên dòng hóa đơn
status: approved
approved: 2026-10-06
date: 2026-10-06
trigger: Trang `Rà soát hóa đơn` dành phần lớn màn hình cho thông tin thanh toán và ảnh xem trước của ảnh hóa đơn; dưới 1440 px panel thanh toán nằm trên, bảng dòng hóa đơn (phần kế toán thao tác nhiều nhất) bị đẩy xuống dưới. Form `Thêm dòng`/`Sửa` nằm ngay dưới bảng nên bấm `Sửa` trên một dòng phải cuộn xuống form xa dòng đó.
mode: incremental
amends: EXPERIENCE.md mục `Invoice review and issue` (cột trái/cột phải) và `Issued Invoice payment image` (ảnh xem trước trên trang)
---

# Sprint Change Proposal - Trang rà soát hóa đơn ưu tiên dòng hóa đơn

## 1. Quyết định

1. Bảng dòng hóa đơn hiện ngay dưới tiêu đề trang, chiếm toàn bộ chiều rộng, như một bảng tính: mỗi phần (`Phần 1 · Thu vào tài khoản trường`, `Phần 2 · Thu vào tài khoản cá nhân`) một bảng, cột số canh phải, dòng tổng phần cuối bảng, thao tác (`Sửa bớt`, `Điều chỉnh`, `Sửa`, `Xóa`) ở cột cuối của chính dòng đó.
2. Lý do ưu đãi hiện dưới số tiền ưu đãi trong cùng ô; bỏ cột `Lý do ưu đãi` riêng để bảng vừa màn hình không cuộn ngang.
3. `Thêm dòng` là nút ở tiêu đề `Chi tiết hóa đơn`; `Thêm dòng` và `Sửa` mở cùng một hộp thoại (khoản thu, số lượng, đơn giá điều chỉnh, lý do; `Nguồn giải thích thủ công` thu gọn). Không còn form nằm dưới bảng. Lệnh API không đổi.
4. Panel `Rà soát trước khi phát hành` / `Thanh toán` nằm dưới bảng, gọn theo chiều ngang: các phần đặt cạnh nhau (tổng phần, tài khoản một dòng), sau đó `Tổng cần nộp` và `Nội dung chuyển khoản` trên một hàng, rồi hàng nút.
5. Trang không còn ảnh xem trước. Nút `Xem ảnh hóa đơn` mở hộp thoại `Ảnh hóa đơn` có ảnh, ghi chú gửi phụ huynh và `Tải ảnh hóa đơn`; nút `Tải ảnh hóa đơn` cũng có ngay trên trang. Ảnh chỉ được yêu cầu từ API khi bấm xem hoặc tải, không tạo mỗi lần mở trang.
6. Ghi chú giải thích (ưu đãi/thuế do hệ thống tính, chốt khi phát hành) chuyển vào `Hướng dẫn` thu gọn cuối trang.

## 2. Invariant giữ nguyên

API vẫn là nguồn duy nhất cho số tiền, ưu đãi, thuế, trạng thái và ảnh hóa đơn; lệnh thêm/sửa/xóa dòng, sửa bớt, điều chỉnh và phát hành giữ nguyên Operation idempotent và đối soát. Hóa đơn không phải nháp chỉ đọc.

## 3. Tác động

| Area | Impact |
| --- | --- |
| UX / mockup | `invoice-detail-review.html`, `MOCKUP-COVERAGE.md`, `EXPERIENCE.md`. |
| Epic 5 | Thêm Story 5.42. |
| API | Không đổi. |
| Admin web | Bố cục trang rà soát, hộp thoại dòng, hộp thoại ảnh hóa đơn, tải ảnh theo yêu cầu. |
| Verification | Web test cho hộp thoại thêm/sửa dòng, tải ảnh theo yêu cầu, xem ảnh trong hộp thoại và trả focus. |
