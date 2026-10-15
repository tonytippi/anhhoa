---
name: Rà soát gói nộp trước
status: approved
approved: 2026-10-14
date: 2026-10-14
trigger: Sau bản sửa "gói chỉ nộp trước khoản thu có trên hóa đơn" (commit f9e9baf), rà soát lại vòng đời gói nộp trước và tái hiện được 5 lỗi bằng integration test - hóa đơn gói không ghi thực nhận được sau khi khóa đợt, đổi giá hoặc ngừng gói; tháng sau bị thu trùng khi gói trả muộn; dòng trùng khoản thu bị nhân gói hai lần.
mode: incremental
supersedes-in-part: Decision 2026-10-01 D11 (coverage theo Student, receivable và billingMonth -> theo Student, gói và billingMonth); sprint-change-proposal-2026-10-08 §2 (gói tính theo đơn giá danh mục)
---

# Sprint Change Proposal - Rà soát gói nộp trước

## 1. Issue summary

Tái hiện trên database test (2026-10-14):

1. Hóa đơn gói đã phát hành, chưa thu; khóa đợt (việc bắt buộc trước khi phát hành đợt sau) -> không ghi thực nhận được.
2. Hóa đơn gói tháng 3 chưa thu khi tạo đợt tháng 4 -> tháng 4 vẫn thu học phí; khi gói được trả, coverage tháng 4 vẫn phát hành -> thu trùng.
3. Đổi đơn giá khoản thu sau khi phát hành gói -> không ghi thực nhận được.
4. Ngừng gói sau khi phát hành -> không ghi thực nhận được.
5. Hai dòng cùng khoản thu rồi áp dụng gói -> cả hai dòng thành N tháng.

Lỗi 1, 3, 4 do ghi thực nhận tính lại gói từ dữ liệu hiện tại thay vì số đã chốt khi phát hành. Hóa đơn gói chưa thu lại không điều chỉnh, không chuyển công nợ được, nên tiền phụ huynh đã chuyển không có đường ghi nhận.

## 2. Decision (business owner, 2026-10-14)

1. **Gói đã phát hành giữ số đã chốt.** Ghi thực nhận chỉ kiểm tra đúng số tiền và tháng chưa có quyền nộp trước khác; không tính lại theo trạng thái đợt thu, trạng thái gói, đơn giá, lịch hay ghi danh. Ngừng gói chỉ chặn áp dụng gói cho hóa đơn mới.
2. **Tháng đang được gói giữ không bị thu.** Một tháng thuộc gói khi đã có quyền nộp trước (gói đã thu) hoặc đang được giữ bởi hóa đơn gói `DRAFT`/`ISSUED` của đợt khác. Sinh đợt thu bỏ qua khoản thu của tháng đó như tháng đã nộp trước. Phát hành từ chối dòng có số lượng > 0 thu khoản thu của tháng đang được gói giữ. Áp dụng gói từ chối nếu hóa đơn đợt khác (không hủy) đã thu khoản thu của gói trong một tháng của gói.
3. **Gói cần đúng một dòng cho mỗi khoản thu của gói** có trên phiếu thu; có hai dòng cùng khoản thu thì từ chối.
4. **Hóa đơn gói đã phát hành, chưa thu, được điều chỉnh** khi đợt chưa đóng: bản điều chỉnh chép dòng và gói; giữ nguyên gói (kể cả gói đã ngừng) hoặc bỏ gói để thu theo tháng. Khi bản thay thế phát hành, hóa đơn gốc hủy và nhả các tháng đang giữ. Đợt đã đóng thì chỉ ghi thực nhận đúng số tiền.
5. **Khoản thu trong một gói thay thế cho nhau.** Quyền nộp trước của tháng M che mọi khoản thu mà gói liệt kê (ví dụ Học phí Mầm, Chồi, Lá). Học sinh đổi lớp hoặc lên lớp năm sau (D11) trong thời hạn gói không bị thu học phí lớp mới. **Giữ mức giá đã trả trước, không thu bù**; hoàn tiền khi nghỉ (D10) vẫn tính theo giá lúc mua gói. Khoản thu không thuộc gói vẫn thu bình thường.
6. **Không tự bớt ngày nghỉ cho tháng thuộc gói.** Khi tháng N-1 thuộc gói của một khoản thu, đợt tháng N không đề xuất `Bớt` ngày nghỉ cho khoản thu đó (kể cả dòng `Thu 0`). Trường hợp nghỉ dài, kế toán bớt tay. *(Bổ sung cùng ngày)* Để bớt tay khi tháng không có dòng của khoản thu, `Thêm dòng` cho chọn **Chỉ bớt (Thu 0)**: số lượng 0, số lượng bớt > 0, giá hoàn / đơn vị (mặc định giá hoàn của Receivable, không vượt đơn giá) và lý do bắt buộc; dòng `Thu 0` không bị coi là thu tháng đã nộp trước và không mang gói.
7. **Ưu đãi khác cộng theo quy tắc cộng dồn hiện có.** Mỗi tháng của gói được tính như một dòng một tháng: ưu đãi gán cho học sinh có hiệu lực ở tháng đó cùng với chính gói (mức giảm, ưu tiên, độc quyền/cộng dồn của gói) qua cùng quy tắc tính ưu đãi. Phần giảm của tháng là tổng; hoàn tiền D10 dùng số đã trả thực.
8. **Giá gói là đơn giá của dòng**, kể cả đơn giá đã sửa kèm lý do.

## 3. UX

- Rà soát hóa đơn nháp: thẻ **Gói nộp trước** dưới bảng dòng. Chưa có gói: một câu ngắn và nút `Áp dụng gói nộp trước`. Nút mở hộp thoại: chọn gói (chỉ gói có khoản thu trên phiếu thu), xem trước do hệ thống tính - mỗi tháng một dòng (Tháng, Khoản thu, Giá, Ưu đãi, Phải thu) và tổng; nêu khoản thu của gói không có trên hóa đơn; xác nhận `Áp dụng gói`. Đã có gói: tóm tắt `Tên gói · N tháng · MM/YYYY–MM/YYYY · Chờ thu đủ | Đã thu`, bảng tháng gọn, nút `Bỏ gói nộp trước` qua hộp xác nhận (nhắc rằng đợt tháng sau đã tạo sẽ không có khoản thu của những tháng này).
- Hóa đơn đã phát hành có gói: cùng tóm tắt và bảng, chỉ đọc.
- Thu tiền: hóa đơn có gói hiện nhãn `Gói nộp trước · thu đúng X đ`; ô thực nhận điền sẵn đúng số.
- Xem trước đợt thu: học sinh có khoản thu được bỏ vì gói hiện `Đã nộp trước: Học phí Chồi (gói từ MM/YYYY)`.
- Ngày tháng hiển thị dạng `MM/YYYY`; không hiện múi giờ, ngày hiệu lực lịch hay chữ "máy chủ".
- Mockup `admin/invoice-detail-review.html` cập nhật trước.

## 4. Impact

- Schema: `InvoicePromotionCoverageFact.promotionEvaluation` (JSON, kết quả tính ưu đãi của tháng).
- API: `GET finance/invoices/:invoiceId/coverage-preview?versionId=` (chỉ đọc); áp dụng, phát hành, phát hành bản thay thế, ghi thực nhận, chuẩn bị bản điều chỉnh, sinh đợt và đề xuất bớt theo §2. Preview đợt thu trả `prepaid` theo học sinh. Receipt queue trả `coverage` của hóa đơn.
- Admin web: §3. Hướng dẫn mầm non `06-uu-dai`, `ra-soat-phat-hanh`.
- Parent, Teacher, Ops: không đổi.

## 5. Acceptance

- Given hóa đơn gói đã phát hành chưa thu, when khóa đợt / đổi đơn giá / ngừng gói, then ghi thực nhận đúng số vẫn phát hành quyền nộp trước.
- Given hóa đơn gói tháng 3 chưa thu, when sinh đợt tháng 4, then hóa đơn tháng 4 không có học phí; when thêm tay học phí vào tháng 4 rồi phát hành, then bị từ chối.
- Given hóa đơn tháng 4 đã có học phí, when áp dụng gói 3 tháng ở tháng 3, then bị từ chối.
- Given hai dòng cùng khoản thu của gói, then áp dụng gói bị từ chối.
- Given hóa đơn gói đã phát hành chưa thu, when điều chỉnh bỏ gói và phát hành bản thay thế, then các tháng được nhả và áp dụng được gói ở hóa đơn khác.
- Given gói gồm Học phí Chồi và Lá đã thu từ tháng 3 (3 tháng), when học sinh chuyển sang lớp thu Học phí Lá từ tháng 4, then đợt tháng 4, 5 không thu Học phí Lá.
- Given tháng 3, 4 thuộc gói và học sinh nghỉ có phép trong tháng 3, 4, then đợt tháng 4, 5 không đề xuất bớt học phí; tháng 6 (sau gói) không bớt ngày nghỉ tháng 5.
- Given ưu đãi anh chị em cộng dồn và gói cộng dồn, then mỗi tháng của gói giảm cả hai (giảm cố định trước, phần trăm tính trên phần còn lại); có ưu đãi độc quyền thì theo quy tắc độc quyền hiện có.
- Given đơn giá dòng đã sửa, then gói tính theo đơn giá đó.
- Story: 5.55.
