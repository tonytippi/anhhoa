# Review adversarial cuối: PRD PassionEdu

## Phạm vi

- Tài liệu review: `prd.md` (bản cập nhật 2026-09-04); `addendum.md` được đọc để xác minh các contract mà PRD dẫn chiếu.
- Baseline bắt buộc: `../../sprint-change-proposal-2026-08-31.md`, trạng thái `approved` ngày 2026-09-04.
- Tiêu chí: xác minh 18 finding của review trước; chỉ báo cáo blocker mức Critical hoặc High còn lại. Không coi phần mở rộng hợp lý nhưng chưa có tác động chặn release là finding.

## Phán quyết

**CHƯA ĐỦ ĐIỀU KIỆN phê duyệt.** Không còn blocker Critical. Còn **2 blocker High**: PRD chưa bảo toàn contract nhiều tài khoản nhận tiền của School, và đã thay đổi semantic `ChargeRule` so với quyết định finance được duyệt. Cả hai có thể làm Architecture/epics triển khai một finance model khác proposal, ảnh hưởng phát hành invoice, phân bổ tiền và tính đúng đắn của snapshot.

## Xác minh 18 finding trước

| Finding trước | Trạng thái | Bằng chứng bản sửa |
| --- | --- | --- |
| 1. Parent chooser/topology ở E1 | Đã xử lý | FR-2 yêu cầu E1 chốt/test Parent callback, cookie, audience và school-selection contract; §6.2 giữ E7 cho finance UI/read model. |
| 2. E3 phụ thuộc E2 | Đã xử lý | §6.2 yêu cầu E3 chỉ sau E1 và E2. |
| 3. E5 thiếu phụ thuộc E3 | Đã xử lý | §6.2 yêu cầu E5 sau E2, E3 và E4. |
| 4. Pending owner bind Google | Đã xử lý | FR-1 yêu cầu normalized pending identity, chỉ bind Google subject khi đăng nhập; cấm password mặc định. |
| 5. Ops/bootstrap/preset capability mơ hồ | Đã xử lý | FR-1 và FR-2 quy định `PlatformOperatorGrant`, audience `ops`, không `OpsUser`, ba preset đầu và capability E4. |
| 6. `studentCode` server-generated | Đã xử lý | FR-5 quy định prefix/sequence unique theo School, bất biến, không manual/import ở release đầu. |
| 7. Semantics close-year/transition | Đã xử lý | FR-5 quy định assignment/enrollment lịch sử, partial mapping, `GRADUATED` và audit. |
| 8. Parent provisioning/contact boundary | Đã xử lý | FR-6 quy định email normalized, tên, số điện thoại; Parent chỉ tự sửa số điện thoại có audit. |
| 9. Parent retention | Đã xử lý | FR-14 gắn 30 ngày với `endedOn`, nêu ngoại lệ finance chưa settlement và policy 12 tháng có version/audit. |
| 10. Quyền evidence attendance | Đã xử lý | FR-12 giới hạn evidence cho Staff có capability hoặc School Admin trong đúng School, retention hai tháng và xóa metadata audit. |
| 11. Long leave và service cancellation | Đã xử lý | FR-12 đặc tả actor, approval, effective date, dừng future run, adjustment/refund và cấm Parent tự hủy service. |
| 12. Chống charge trùng meal/service | Đã xử lý | FR-12 yêu cầu meal adjustment có source trên invoice DRAFT kế tiếp và Saturday MANUAL kiểm tra service coverage. |
| 13. Thêm học sinh sau generate | Đã xử lý | FR-8 khóa rule/phạm vi gốc, giới hạn actor và tạo duy nhất DRAFT từ snapshot. |
| 14. Default transfer content | Đã xử lý | FR-9 chốt snapshot mặc định `studentCode + className`. |
| 15. Reversal/refund separation of duties | Đã xử lý | FR-10 quy định `DIRECT`, `SCHOOL_ADMIN_APPROVAL`, actor khác nhau, reason/audit/idempotency và source. |
| 16. Idempotency mutation cụ thể | Đã xử lý | §7 liệt kê generate, transition, issue, ledger, reversal/refund, approval và reconciliation `GET /operations/:operationId`. |
| 17. Trial workflow boundary | Đã xử lý | FR-5 nêu `TRIAL` là workflow ngoại lệ có audit và không mặc định eligible. |
| 18. Staff profile/assignment boundary | Đã xử lý | FR-6 chốt trường dữ liệu, effective date/audit và loại trừ HR/payroll/password/primary-secondary. |

## Blocker còn lại

### High-1. Contract nhiều tài khoản nhận tiền của School bị thiếu

- **Vị trí:** `prd.md` FR-9, dòng 171-177; proposal §2, quyết định 19.
- **Điều kiện kích hoạt:** PRD chỉ yêu cầu Finance Manager “chọn tài khoản active” khi issue Invoice. PRD không yêu cầu một School có **nhiều** tài khoản nhận tiền, không xác định aggregate/quyền quản lý/lifecycle active-inactive của tài khoản, và không đặt invariant lựa chọn một tài khoản riêng cho từng invoice trước khi issue. Vì vậy implementation vẫn có thể hợp lệ theo PRD với một tài khoản singleton, trái quyết định approved.
- **Guard bắt buộc:** Bổ sung FR finance configuration hoặc FR-9: School quản lý nhiều receiving account scoped theo School; account chỉ deactivate, không hard-delete khi đã được snapshot; Finance Manager/School Admin chọn đúng một account `active` cho từng Invoice `DRAFT` trước issue; Invoice và Payment instruction snapshot toàn bộ dữ liệu account đã chọn. Thêm negative test cho account thuộc School khác, account inactive và thay đổi account sau issue.
- **Hệ quả nếu không sửa:** Không thể đáp ứng nhu cầu nhận tiền theo từng invoice bằng tài khoản khác nhau; thay đổi account có thể làm hỏng hướng dẫn Parent hoặc làm Finance phải dùng account live thay vì snapshot, gây đối soát/allocation sai.

### High-2. Semantic `ChargeRule` mâu thuẫn với contract finance đã approved

- **Vị trí:** `prd.md` Thuật ngữ, dòng 61; FR-7, dòng 153-156; proposal §2, quyết định 21 và 24.
- **Điều kiện kích hoạt:** Proposal chốt `ChargeRule` chỉ có quantity `FIXED` hoặc `MANUAL`; Finance nhập hoặc override quantity/giá/adjustment trên Invoice `DRAFT`, còn attendance/handover/service chỉ là reference. PRD lại định nghĩa `ChargeRule` là `INCLUDE`/`EXCLUDE`, đồng thời thêm nguồn giá `RECEIVABLE_DEFAULT`, `CLASS_MONTHLY_TUITION`, `OVERRIDE`. Đây không chỉ là cách diễn đạt khác: nó chuyển rule từ contract quantity tối giản sang eligibility/pricing engine mới, nhưng không có quyết định superseding hay release boundary được phê duyệt.
- **Guard bắt buộc:** Khôi phục contract approved trong PRD: `ChargeRule` chỉ biểu diễn quantity `FIXED`/`MANUAL`; giá và adjustment được Finance Manager/School Admin nhập hoặc override trong Invoice `DRAFT` với ghi chú/audit; attendance, handover và service enrollment chỉ là reference snapshot. Nếu Product thực sự cần `INCLUDE`/`EXCLUDE`, price source hoặc precedence `STUDENT > CLASS > SCHOOL`, phải tạo và phê duyệt change proposal thay thế trước khi đưa vào Architecture Spine/Epics.
- **Hệ quả nếu không sửa:** Architecture có thể xây một pricing/eligibility engine vượt scope và khác finance model đã duyệt; precedence/conflict mới sẽ quyết định ai bị thu tiền mà không có policy được phê duyệt, tăng rủi ro tạo Invoice sai hoặc phải clean-break lần nữa.

## Điều kiện gỡ chặn

- Sửa hai contract High trên trong `prd.md` với acceptance criteria và release owner rõ ràng.
- Không chuyển PRD sang `final` hoặc dùng làm baseline Architecture Spine/Epics trước khi hai điểm được xử lý hoặc một proposal thay thế được phê duyệt.
