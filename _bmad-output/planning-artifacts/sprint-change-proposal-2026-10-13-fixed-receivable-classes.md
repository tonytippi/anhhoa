---
name: Khoản thu cố định áp dụng theo lớp
status: approved
approved: 2026-10-13
date: 2026-10-13
trigger: Dùng thử trung tâm ngoại ngữ, business owner thấy Khoản thu cố định tạo được nhưng không đưa vào Đợt thu theo lớp được. Học phí của trung tâm khác nhau theo lớp; trường mầm non cũng có thể mỗi lớp một mức học phí.
mode: incremental
supersedes-in-part: Decision 2026-10-02 §3.2 (Receivable `FIXED` luôn áp dụng cho toàn bộ Student, template line `FIXED` luôn scope `ALL`); sprint-change-proposal-2026-10-12 §2.3 (run `CLASS` không tự thêm `FIXED`, sao chép mọi dòng `ALL` của run liền trước)
---

# Sprint Change Proposal - Khoản thu cố định áp dụng theo lớp

## 1. Issue summary

Mức giá nằm trên Receivable, nên "mỗi lớp một mức học phí" nghĩa là mỗi mức giá là một Receivable. Hai chỗ chưa khớp:

- Trung tâm ngoại ngữ: run `CLASS` không seed `FIXED` và hộp thoại thêm khoản thu chỉ liệt kê `FLEXIBLE`, nên Receivable `FIXED` là ngõ cụt.
- Trường mầm non: `FIXED` luôn áp cho toàn trường; học phí khác nhau theo lớp phải thêm tay dòng `FLEXIBLE` theo lớp ở từng tháng.

Business owner chốt 2026-10-13: Receivable `FIXED` chọn được lớp áp dụng ngay trên Receivable, dùng chung cho cả hai loại trường.

## 2. Decision

1. Receivable `FIXED` có **Áp dụng cho**: `Toàn trường` (mặc định, không có dòng gán lớp) hoặc `Các lớp được chọn` (ít nhất một lớp). Chỉ `FIXED` được gán lớp; Receivable rời nhóm `FIXED` thì bỏ danh sách lớp. Chỉ chọn được Class `ACTIVE` của SchoolYear chưa đóng, cùng School.
2. Run `SCHOOL` (mầm non): mở run seed mọi `FIXED` ACTIVE. `Toàn trường` -> dòng scope `ALL` như cũ. Gán lớp -> dòng scope `CLASSES` gồm các lớp được gán thuộc SchoolYear của run; không có lớp nào thuộc SchoolYear đó thì không seed. Số lượng mặc định giữ quy tắc cũ (1, hoặc số ngày học của tháng với `autoLeaveDeduction`).
3. Run `CLASS` (trung tâm): mở run seed mọi `FIXED` ACTIVE là `Toàn trường` hoặc có gán lớp của run, số lượng 1, cả lớp. Dòng `FLEXIBLE` cả lớp vẫn sao chép từ run liền trước cùng lớp; dòng `FIXED` không sao chép, luôn lấy theo danh sách lớp hiện tại của Receivable.
4. Phạm vi của dòng `FIXED` không chọn trên run: sửa số lượng giữ nguyên phạm vi đã seed; request mang phạm vi khác bị từ chối. Dòng `FIXED` vẫn gỡ được khi run còn `DRAFT`. `FIXED` không áp dụng cho lớp của run `CLASS` thì không thêm tay được.
5. Đổi danh sách lớp không đổi run đã mở. Chuyển một lớp sang mức giá khác: sửa danh sách lớp của hai Receivable trước khi mở run kế tiếp.
6. Lớp thuộc một SchoolYear, nên sang năm học mới kế toán gán lại lớp cho các Receivable `FIXED` theo lớp. Chưa tự chuyển danh sách lớp khi đóng năm.

## 3. Impact

- Schema: bảng `ReceivableClass (schoolId, receivableId, classId)` với composite tenant FK, unique theo bộ ba, trigger chỉ nhận Receivable `FIXED`; trigger template line bỏ luật `FIXED` = `ALL`.
- API: catalog trả `classOptions` và `appliesToClassIds`/`appliesToClassNames` trên Receivable; tạo/sửa Receivable nhận `classIds`; mở run seed theo mục 2-3.
- Admin: hộp thoại tạo/sửa Khoản thu có `Áp dụng cho` khi nhóm là cố định; danh sách Khoản thu hiện phạm vi áp dụng; chi tiết Đợt thu hiện lớp của dòng cố định. Mockup `admin/receivable-configuration.html` cập nhật trước.
- Parent, Teacher, Ops: không đổi.

## 4. Acceptance

- Given Receivable `FLEXIBLE`/`EXTRACURRICULAR` hoặc Class của School khác, Class không ACTIVE, SchoolYear đã đóng, then `classIds` bị từ chối.
- Given trường mầm non có hai `FIXED` gán hai lớp khác nhau và một `FIXED` toàn trường, when mở run tháng, then mỗi Student nhận đúng `FIXED` của lớp mình cộng `FIXED` toàn trường.
- Given `FIXED` chỉ gán lớp của SchoolYear khác, then run không seed Receivable đó.
- Given trung tâm, when mở run của một lớp, then run có `FIXED` toàn trường và `FIXED` gán lớp đó; `FIXED` gán lớp khác không vào và không thêm tay được.
- Given lớp được chuyển từ `FIXED` A sang `FIXED` B trước unit kế tiếp, then run kế tiếp có B, không có A, và vẫn sao chép dòng `FLEXIBLE` cả lớp.
- Story: 5.54.
