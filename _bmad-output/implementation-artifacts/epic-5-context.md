# Epic 5 Context: Tạo và phát hành nghĩa vụ thu

<!-- Generated from planning artifacts. Rebuild with compile-epic-context when planning docs change. -->

## Goal

Epic này cung cấp Finance Admin MVP/template và Pha 1b ưu đãi: cấu hình catalog khoản thu, Đợt thu, policy/version/target theo Receivable và Student assignment; API preview/generate/recheck Issue tạo snapshot ứng dụng giảm trừ trên Invoice line. Receipt, coverage, carry, settlement, refund và báo cáo vẫn thuộc Epic 6.

## Stories

- Story 5.1: Quản lý catalog nhóm khoản thu và khoản thu
- Story 5.2: Tạo CollectionRun và preview học sinh đủ điều kiện
- Story 5.3: Generate Invoice DRAFT rỗng idempotent theo snapshot roster
- Story 5.4: Rà soát dòng Invoice DRAFT có audit
- Story 5.5: Issue Invoice với Payment instruction snapshot bất biến
- Story 5.6: Release gate Finance Admin MVP
- Story 5.7: Đóng CollectionRun đã generate
- Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ
- Story 5.9: Cấu hình template khoản thu cho Đợt thu
- Story 5.10: Generate Invoice DRAFT có dòng template
- Story 5.11: Release gate template Đợt thu
- Story 5.12: Cấu hình ưu đãi theo khoản thu và gán học sinh
- Story 5.13: Preview và generate ưu đãi authoritative
- Story 5.14: Recheck Issue và snapshot ưu đãi bất biến
- Story 5.15: Release gate ưu đãi theo khoản thu Pha 1b

## Requirements & Constraints

Finance chỉ làm việc trong School context hợp lệ và có capability `FINANCE_MANAGE`; API phải tự xác thực membership, StaffProfile, primary SchoolPosition active, login binding và capability ở mỗi request. `schoolId`, UUID, route, filter, header hay browser state chỉ là selector, không là bằng chứng quyền. Mọi query, mutation, quan hệ, unique constraint, audit và Operation phải scope theo School; SchoolYear là boundary dữ liệu, timezone nghiệp vụ là `Asia/Ho_Chi_Minh`.

`Khoản thu` quản lý ReceivableGroup/Receivable theo School, active/inactive và default price. Pha 1b thêm PromotionPolicy version effective-dated, same-School Receivable target và StudentPromotionAssignment có interval/reason/audit; không có ChargeRule, scope School/Class/Student hay service enrollment auto-pricing.

Đợt thu chỉ là `MONTHLY`, unique theo `(School, SchoolYear, billingMonth)`, với lifecycle `DRAFT -> READY -> GENERATED -> CLOSED`. Trong `DRAFT`, CollectionRun sở hữu các `CollectionRunTemplateLine`. Mỗi line tham chiếu tối đa một Receivable active cùng School, unique theo run/receivable, và có quantity nguyên dương. API chỉ hiển thị template/Invoice line theo amount giảm dần với tie-breaker server ổn định; không có position, reorder hay ý nghĩa nghiệp vụ của thứ tự. Browser không được gửi unit price, amount, total, Class/Student scope hay giá trị theo Student; API dùng default unit price catalog và tự tính amount/total VND. VND lưu PostgreSQL `BIGINT` và REST trả JSON integer an toàn; client không bao giờ đặt total, outstanding, settlement state hay eligibility.

Finance có thể thêm, bỏ và đổi quantity template chỉ khi run `DRAFT`. Duplicate, Receivable inactive hoặc khác School, quantity bằng không/âm/thập phân, stale version và non-DRAFT state phải bị từ chối trước khi ghi hay tiết lộ fact cross-School. Mọi thay đổi selection, template hoặc catalog fact phải làm preview hiện có stale. Preview và generate dùng cùng selection policy và cùng cách phân loại skips từ server.

Generate chỉ nhận run `READY`, preview hiện hành và template không rỗng hợp lệ. Trong transaction, API khóa/revalidate run, template, catalog, roster và policy facts; tạo InvoiceLine snapshot gross cùng policy application/discount/net server-derived. Fixed VND trước percentage; priority/exclusivity deterministic, discount cap tại gross line. Policy/catalog/assignment đổi làm preview stale; Issue recheck rồi snapshot bất biến, không rewrite Invoice issued. `PREPAID_COVERAGE`, Receipt, carry, settlement, refund và report không thuộc Pha 1b.

Cookie mutation cần origin validation và double-submit CSRF. Mutation template, preview/generate, line DRAFT, issue, close và revision có UUID `Idempotency-Key`; Operation lưu route, School, actor context, fingerprint và outcome trong cùng transaction. Retry cùng fingerprint replay outcome; tái dùng key với fingerprint khác conflict. Sau timeout, portal giữ Operation ID và đối soát `GET /operations/:operationId` trước retry hoặc đổi School. Audit lưu School, actor/reference, thời gian, provenance và reason khi bắt buộc.

## Technical Decisions

`finance` là owner của CollectionRun, template line, Invoice, snapshot, lifecycle, calculation, audit và locking boundary. Controller chỉ gọi owning service; portal chỉ gọi REST, không import API internals. Schema và service phải bảo toàn composite tenant graph trong transaction, bao gồm tất cả tham chiếu CollectionRun, Receivable, Student, Enrollment, Invoice và InvoiceLine.

CollectionRun template là aggregate hẹp, không phải pricing engine. Canonical template/catalog facts là một phần preview fingerprint. `READY`, `GENERATED` và `CLOSED` khóa template mutation; selection thay đổi quay về `DRAFT`, còn generate chỉ từ preview server-confirmed. Generate phải atomic: stale fingerprint, catalog không còn eligible, race hoặc retry либо reject toàn bộ hoặc replay toàn bộ outcome, không để Invoice/InvoiceLine partial hay duplicate. Unique Invoice `(schoolId, studentId, collectionRunId)` vẫn được enforce; revision cùng lineage hợp lệ là ngoại lệ đã định nghĩa cho Invoice nguồn `CANCELLED`.

Invoice DRAFT vẫn cho phép thêm/sửa/bỏ catalog line, quantity dương và authorized audited price override cho từng Student. Manual Finance-source snapshot có thể là tham chiếu giải thích, có reason/audit và không suy ra quantity, price, fee, discount hoặc total; nó không tạo dependency attendance, handover, Teacher hay Parent. Issue cần BankAccount active cùng School, snapshot receiving bank, account number, account holder, transfer content, source/enrollment facts và issued total. Không dùng account/catalog/template live để ghi lại lịch sử.

Test unit cho transition, validation và whole-VND calculations. PostgreSQL integration phải chứng minh tenant isolation, template line unique, positive quantity, lifecycle lock, stale preview, catalog lifecycle, snapshot immutability, Operation/idempotency, retry và concurrency. Fixture 1.000 Student phải có Operation progress và generate hoàn tất trong 60 giây; preview trong 3 giây. Epic 1 tenant-isolation release gate là điều kiện trước mọi phát hành Epic 5.

## UX & Interaction Patterns

Admin/Finance là desktop-first, table-first. Sidebar chỉ có `Khoản thu` và `Đợt thu`; Invoice review là deep destination theo Student từ detail Đợt thu, không là sidebar item. `Khoản thu` là catalog table với trạng thái active/inactive và default price. Landing `Đợt thu` là bảng CollectionRun có filter, create/open action; detail DRAFT hiển thị template chung và bảng Student với eligibility/status do server trả.

Trong DRAFT, Finance thêm Receivable active vào “Khoản thu trong đợt”, nhập quantity nguyên dương hoặc bỏ line. `Ưu đãi` là destination riêng để cấu hình policy/target/assignment; preview và Invoice review chỉ hiện gross, discount, net và reason server-returned. UI không có calculator, reorder, control Class/service hay tự sửa discount. Luồng là template/assignment -> preview -> generate -> review -> Issue recheck/snapshot. `READY` trở đi khóa template/selection; policy fact đổi yêu cầu preview/review mới.

Số VND căn phải và hiển thị số nguyên; trạng thái luôn có text label. Dùng loading skeleton không mang dữ liệu School cũ, error summary focusable, dialog có focus trap/return, table keyboard-accessible và responsive scroll/card. Action issue/destructive cần named confirmation. Khi timeout hoặc context không chắc chắn, UI đi vào Operation reconciliation; School switch guard chỉ cho remain, discard-before-submit hoặc reconcile, không auto-save.

## Cross-Story Dependencies

Epic 5 phụ thuộc Epic 1 cho tenant isolation, audience/session, CSRF, Operation và capability; Epic 2 cho SchoolYear, Student, enrollment lifecycle và roster as-of snapshot; Epic 3 cho FinancePolicy, BankAccount active và snapshot theo effective date. Epic 4 chỉ là enhancement sau release: operational fact có thể trở thành explanatory/manual Finance-source hoặc adjustment source trong hợp đồng riêng, không thay đổi template, CollectionRun hay Invoice manual snapshot đã issue.

Stories 5.1-5.8 là delivery historical; 5.9 -> 5.11 hoàn tất template. Pha 1b theo thứ tự 5.12 policy/assignment, 5.13 evaluator preview/generate, 5.14 Issue snapshot, 5.15 gate. Epic 6 chỉ bắt đầu `PREPAID_COVERAGE`, Receipt, carry, refund và ledger sau đó; Parent projection thuộc Epic 7.
