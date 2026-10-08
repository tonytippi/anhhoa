---
name: Ngày học trong tuần cho khoản thu theo ngày
status: approved
approved: 2026-10-08
date: 2026-10-08
trigger: Mở đợt thu, Tiền ăn (khoản tự trừ theo ngày nghỉ có phép) vào template với số lượng 1 ngày; kế toán phải sửa tay mỗi tháng. PeakLand chỉ làm việc Thứ 2–Thứ 6; Thứ 7 là chương trình thu riêng, tiền ăn Thứ 7 đã nằm trong học phí Thứ 7 (con giáo viên miễn học phí Thứ 7 nên có khoản "Tiền ăn ngày Thứ 7 - Con GV"). Ngày vận hành hiện tại (trừ Chủ nhật và ngày lễ) tính cả Thứ 7, nên tháng 10/2026 ra 27 ngày thay vì 22.
mode: incremental
amends: sprint-change-proposal-2026-10-02-receivable-kinds-and-extracurricular-classes.md §3.2 (khoản cố định vào template với quantity 1); sprint-change-proposal-2026-10-01-receivable-refund-price-and-leave-deduction.md D4, D9 (ngày nghỉ được trừ và ngày sau khi nghỉ học tính theo ngày vận hành)
---

# Sprint Change Proposal - Ngày học trong tuần cho khoản thu theo ngày

## 1. Quyết định

1. **Chính sách tài chính có `Ngày học trong tuần`** (`FinancePolicy.schoolWeekdays`, ISO 1 = Thứ 2 … 6 = Thứ 7, ít nhất một ngày, không có Chủ nhật). Theo phiên bản và ngày hiệu lực như các trường khác của chính sách. Phiên bản hiện có giữ Thứ 2–Thứ 7 (bằng ngày vận hành đang dùng); form đề xuất phiên bản mới bắt đầu từ ngày học của phiên bản hiện hành.
2. **Ngày học** của một ngày = thứ trong tuần thuộc `schoolWeekdays` của chính sách hiệu lực ngày đó (không có chính sách: Thứ 2–Thứ 7) và không thuộc kỳ nghỉ của lịch hiệu lực ngày đó.
3. **Mở đợt thu**: khoản cố định bật `Tự động trừ theo ngày nghỉ có phép` vào template với số lượng = số ngày học của tháng thu (tối thiểu 1). Khoản cố định khác vẫn là 1. Kế toán vẫn sửa được khi đợt thu còn nháp; học sinh vào/nghỉ giữa tháng sửa trên hóa đơn như hiện nay.
4. **Bớt theo ngày nghỉ** (D4) chỉ đếm ngày nghỉ có phép rơi vào ngày học; **quyết toán** (D9) hoàn các ngày học sau ngày kết thúc ghi danh.
5. Không đổi: ngày vận hành của điểm danh, đơn nghỉ và bàn giao (Thứ 7 vẫn điểm danh được cho chương trình Thứ 7); tỷ lệ hoàn gói nộp trước (D11) vẫn theo ngày vận hành.

## 2. Invariant giữ nguyên

API tính mọi số lượng và số tiền; số đã snapshot trên hóa đơn không đổi khi chính sách hoặc lịch đổi sau đó; Operation idempotent; lịch sử chính sách trước ngày nghiệp vụ không sửa được.

## 3. Tác động

| Area | Impact |
| --- | --- |
| DB | `FinancePolicy.schoolWeekdays INTEGER[]` mặc định `{1..6}`, CHECK không rỗng và thuộc 1..6. |
| API | Tạo phiên bản chính sách tài chính nhận/trả `schoolWeekdays`; mở đợt thu đặt số lượng theo ngày học; Bớt và quyết toán lọc theo ngày học. |
| Admin web | Cài đặt › Tài chính & thanh toán: cột `Ngày học` trong bảng phiên bản, nhóm ô chọn `Ngày học trong tuần` trong form đề xuất. |
| UX / mockup | `admin/school-settings.html`, `MOCKUP-COVERAGE.md`. |
| Spec | `SPEC.md` mục loại khoản thu và mục Bớt. |
| Seed | PeakLand: Thứ 2–Thứ 6. |
| Epic 5 | Story 5.45. |
