---
name: Nhiều tài khoản trường và tài khoản trường mặc định theo lớp
status: approved
approved: 2026-10-08
date: 2026-10-08
trigger: PeakLand nhận tiền khoản có thuế vào hai tài khoản hộ kinh doanh (BIDV, TPBank) cho các nhóm lớp khác nhau. Hệ thống chỉ cho một tài khoản trường đang hoạt động và luôn dùng tài khoản đó khi phát hành, nên hai tài khoản này bị nhập thành tài khoản cá nhân.
mode: incremental
amends: sprint-change-proposal-2026-09-30-taxed-receivables-and-two-payment-channels.md §1 ("A School usually has exactly one"), §4.4 (kênh `SCHOOL`), §4.5 (giới hạn một tài khoản trường), Story 5.23
---

# Sprint Change Proposal - Nhiều tài khoản trường

## 1. Quyết định

1. Một Trường có thể có nhiều tài khoản trường (`SCHOOL`) đang hoạt động. Bỏ lỗi `SCHOOL_BANK_ACCOUNT_EXISTS` khi thêm hoặc kích hoạt lại tài khoản trường.
2. Lớp có thêm `Tài khoản trường mặc định` (`Class.defaultSchoolBankAccountId`), bên cạnh `Tài khoản cá nhân mặc định` hiện có. Chỉ chọn tài khoản `SCHOOL` đang hoạt động của cùng Trường; trigger DB kiểm tra loại tài khoản như với tài khoản cá nhân.
3. `PUT .../finance/classes/:classId/default-bank-account` nhận thêm `schoolBankAccountId`; không gửi trường này thì giữ nguyên tài khoản trường mặc định.
4. Phát hành (cả phát hành bản điều chỉnh): phần `SCHOOL` dùng `schoolBankAccountId` trong request, nếu không có thì dùng tài khoản trường mặc định của lớp trong snapshot hóa đơn; nếu vẫn không có và Trường chỉ có đúng một tài khoản trường đang hoạt động thì dùng tài khoản đó.
   - Không có tài khoản trường đang hoạt động: `409 SCHOOL_BANK_ACCOUNT_REQUIRED`.
   - Có nhiều tài khoản trường mà không chọn và lớp không có mặc định: `409 SCHOOL_BANK_ACCOUNT_CHOICE_REQUIRED` "Chọn tài khoản trường để thu khoản có thuế hoặc đặt tài khoản trường mặc định cho lớp."
   - Tài khoản được chọn không phải tài khoản trường đang hoạt động: `404 BANK_ACCOUNT_NOT_FOUND`.
5. Notice DTO trả thêm `classDefaultSchoolBankAccountId`.

## 2. UX

- Hộp thoại `Tài khoản thu mặc định · <lớp>` (Lớp) có hai ô chọn: `Tài khoản trường mặc định` và `Tài khoản cá nhân mặc định`. Cột `Tài khoản thu mặc định` của bảng lớp hiển thị cả hai (`Trường: …`, `Cá nhân: …`).
- Panel rà soát và hộp thoại phát hành: phần thu vào tài khoản trường có ô chọn `Tài khoản trường` giống phần tài khoản cá nhân, chọn sẵn mặc định của lớp (hoặc tài khoản trường duy nhất), đánh dấu `(mặc định lớp …)`.
- Cài đặt `Tài khoản nhận tiền`: bỏ câu "Tối đa một tài khoản trường đang hiệu lực".
- Ô chọn trong hộp thoại `Tài khoản thu mặc định · <lớp>` hiện đầy đủ số tài khoản (`Ngân hàng · Số tài khoản · Chủ tài khoản`), giống ô chọn khi phát hành, thay cho `•••• 4 số cuối` (EXPERIENCE.md, mockup `school-year-classes.html`). Hộp thoại chỉ dùng được với quyền Finance và danh sách đã lấy từ route Finance có đủ số; nhiều tài khoản trùng 4 số cuối (PeakLand: MBBank, Vietcombank, VPBank cùng `2859`) nên số che khó phân biệt. Cột `Tài khoản thu mặc định` của bảng lớp vẫn hiện `•••• 4 số cuối` vì roster API chỉ trả 4 số cuối cho người không có quyền Finance.

## 3. Dữ liệu

- Migration `20261008000004_class_default_school_bank_account`: thêm cột, FK theo `(schoolId, id)`, mở rộng trigger `enforce_class_default_bank_account`.
- Seed PeakLand: BIDV `8827839003` và TPBank `88888882026` là tài khoản trường; BIDV là tài khoản trường mặc định của mọi lớp. Database phát triển đã seed hai tài khoản này là `PERSONAL` được chuyển sang `SCHOOL` khi seed lại, đồng thời gỡ khỏi tài khoản cá nhân mặc định của lớp.
