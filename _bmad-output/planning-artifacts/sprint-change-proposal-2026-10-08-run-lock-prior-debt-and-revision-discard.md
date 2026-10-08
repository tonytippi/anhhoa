---
name: Khóa đợt thu trước khi phát hành đợt mới, chuyển công nợ kỳ trước bằng tay, hủy bản điều chỉnh nháp
status: approved
approved: 2026-10-08
date: 2026-10-08
trigger: Chuẩn bị cho kế toán dùng thử nội bộ. Kế toán quen quy trình KidsOnline (khóa đợt thu xong mới phát hành đợt mới). Rà soát khi viết mục Hướng dẫn cho thấy chưa có giao diện chuyển công nợ, và bản điều chỉnh chuẩn bị nhầm không bỏ được.
mode: incremental
amends: Story 6.4 (chuyển prior debt), Story 5.x đóng đợt thu (`Đóng đợt thu`), Story về bản điều chỉnh hóa đơn đã phát hành
---

# Sprint Change Proposal - Khóa đợt thu, công nợ kỳ trước, hủy bản điều chỉnh

## 1. Quyết định

1. **Khóa đợt trước khi phát hành đợt mới.** `Đóng đợt thu` hiện có là thao tác "khóa đợt thu": chỉ làm được khi mọi hóa đơn đã phát hành; sau khi đóng không thêm học sinh, không sửa hoặc điều chỉnh hóa đơn, vẫn ghi thực nhận bình thường. Mới: hóa đơn (kể cả hóa đơn quyết toán) của một đợt thu `MONTHLY` chỉ được phát hành khi **mọi đợt thu `MONTHLY` có tháng thu sớm hơn của cùng Trường đã đóng**.
   - Vẫn được mở đợt, sửa khoản thu mẫu, xem trước, tạo và sửa hóa đơn nháp của đợt mới.
   - Phát hành bản thay thế không bị chặn (điều chỉnh của đợt chưa đóng).
   - Lỗi: `409 PREVIOUS_RUN_NOT_CLOSED` "Cần đóng đợt thu tháng MM/YYYY trước khi phát hành hóa đơn của đợt này."
   - Run DTO trả `previousOpenRun: { id, billingMonth } | null` để giao diện báo trước và khóa nút phát hành.
2. **Chuyển công nợ kỳ trước do kế toán bấm, không tự gộp.** Phụ huynh hầu như đóng đủ trước khi đưa trẻ đến lớp, nên việc chuyển nợ hiếm và phải chủ động.
   - `GET .../finance/collection-runs/:runId/prior-debts`: hóa đơn `ISSUED` chưa ghi thực nhận của đợt `MONTHLY` **đã đóng**, tháng sớm hơn, cùng Trường và năm học, của học sinh có hóa đơn nháp thường (không phải bản điều chỉnh) trong đợt này; còn nợ = nghĩa vụ − tổng đã chuyển > 0; bỏ hóa đơn có gói nộp trước. Mỗi dòng: hóa đơn nguồn, học sinh, lớp, tháng, tài khoản nhận, còn nợ.
   - `POST .../finance/collection-runs/:runId/prior-debts/transfer` `{ sourceInvoiceIds: uuid[] }` (1 hoặc tất cả): một Operation, tất cả hoặc không. Mỗi nguồn chuyển **toàn bộ** số còn nợ thành dòng `Công nợ kỳ trước` trên phần nháp **cùng tài khoản** của học sinh trong đợt (tạo phần đó nếu chưa có, như khi thêm dòng). Lý do tự ghi "Chuyển công nợ tháng MM/YYYY". Dùng lại `DebtTransfer`, ledger `DEBT_TRANSFER_POSTED` và các ràng buộc DB hiện có.
   - Hóa đơn nguồn đã chuyển nợ: không còn trong hàng đợi `Thu tiền`, không tải lại ảnh VietQR (đã có), báo cáo không tính là còn nợ (đã có).
   - API chuyển một phần (`POST .../debt-transfers`) giữ nguyên cho tương thích, không có giao diện.
3. **Hủy bản điều chỉnh nháp.** Bản điều chỉnh chưa phát hành không ảnh hưởng hóa đơn gốc, không có ledger, nên **xóa hẳn** thay vì chuyển trạng thái.
   - `POST .../finance/invoices/:invoiceId/discard-revision` `{ reason }` (bắt buộc): chỉ cho hóa đơn `DRAFT` có `revisesInvoiceId`; xóa dòng, gói nộp trước (nếu có) và hóa đơn; audit `INVOICE_REVISION_DISCARDED` (lý do, hóa đơn gốc). Sau đó được chuẩn bị bản điều chỉnh mới cho cùng hóa đơn gốc.
   - Migration nới trigger `reject_invoice_snapshot_mutation` đúng một ngoại lệ: được xóa hóa đơn `DRAFT` có `revisesInvoiceId`. Mọi hóa đơn khác vẫn cấm xóa.

## 2. Sửa lỗi đi kèm (đã làm cùng ngày, commit `504fa8d`)

- Gói nộp trước gắn vào phần phiếu thu cùng tài khoản nhận với khoản thu của gói và thu đủ số tháng của gói (số lượng = số tháng, ưu đãi = tổng phần giảm); xóa gói đưa dòng về 1 tháng. Gói phải gồm khoản thu cùng một loại tài khoản.
- Bản điều chỉnh chép sẵn dòng của phần gốc; kế toán chọn phần cần điều chỉnh của phiếu thu hai phần; mở lại phiếu thu vào bản điều chỉnh đang dở.
- Rà soát hóa đơn nháp hiện dòng `Khoản thu thiếu kỳ trước` / `Khoản thu thừa kỳ trước được khấu trừ`.
- Báo cáo không tính chênh lệch đã ghi thực nhận vào công nợ hay tiền phải chi hoàn.

## 3. UX

- Chi tiết đợt thu (`Đã tạo hóa đơn`): khi `previousOpenRun` có giá trị, thông báo "Đợt thu tháng MM/YYYY chưa đóng. Cần đóng đợt đó trước khi phát hành hóa đơn đợt này." kèm liên kết mở đợt đó; trang rà soát hóa đơn khóa nút phát hành với cùng lý do.
- Chi tiết đợt thu (`Đã tạo hóa đơn`): mục `Công nợ kỳ trước` (chỉ hiện khi có dòng): bảng Học sinh, Lớp, Tháng, Tài khoản nhận, Còn nợ, Thao tác `Chuyển vào hóa đơn tháng này`; nút `Chuyển tất cả công nợ`; mỗi thao tác qua hộp xác nhận nêu tổng tiền.
- Rà soát bản điều chỉnh nháp: nút `Hủy bản điều chỉnh` cạnh `Phát hành bản thay thế`, hộp xác nhận có `Lý do` bắt buộc; sau khi hủy mở lại hóa đơn gốc.
- Mục Hướng dẫn: cập nhật bài Đóng đợt thu, Điều chỉnh hóa đơn, Quy trình hằng tháng; thêm bài Chuyển công nợ kỳ trước. Hướng dẫn không cần mockup (quyết định 2026-10-08).

## 4. Stories

- **Story 5.47: Khóa đợt trước khi phát hành đợt mới.** Given đợt tháng sớm hơn chưa đóng When phát hành hóa đơn đợt mới Then `409 PREVIOUS_RUN_NOT_CLOSED`, giao diện báo trước; khi đợt trước đã đóng thì phát hành bình thường.
- **Story 5.48: Chuyển công nợ kỳ trước.** Given hóa đơn đã phát hành chưa thu của đợt đã đóng When kế toán chuyển một hoặc tất cả Then mỗi nguồn thành dòng `Công nợ kỳ trước` trên phần cùng tài khoản, nguồn rời hàng đợi Thu tiền, thao tác idempotent và tất cả hoặc không.
- **Story 5.49: Hủy bản điều chỉnh nháp.** Given bản điều chỉnh nháp When hủy với lý do Then bản nháp bị xóa, hóa đơn gốc không đổi, có audit, và chuẩn bị lại được.
