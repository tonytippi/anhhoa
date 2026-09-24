# Epic 5 Context: Tạo và phát hành nghĩa vụ thu

<!-- Generated from planning artifacts. Rebuild with compile-epic-context when planning docs change. -->

## Goal

Epic này cung cấp Finance Admin workflow để cấu hình catalog và template khoản thu chung cho Đợt thu theo tháng, preview và generate Invoice DRAFT có sẵn dòng một cách server-authoritative, rồi rà soát, phát hành nghĩa vụ cùng Payment instruction snapshot bất biến. Sau template gate, Pha 1b thêm ưu đãi theo từng Receivable và Student assignment; automation định giá, settlement, coverage và báo cáo vẫn nằm ngoài phạm vi Epic này.

## Stories

- Story 5.1: Quản lý receivable catalog theo School
- Story 5.2: Tạo CollectionRun và server-authoritative preview
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

Finance commands yêu cầu capability `FINANCE_MANAGE` trong School context hợp lệ. API tự resolve StaffProfile active, primary SchoolPosition active, same-School login binding và capability cho từng request; route, UUID, header, filter và browser state chỉ là selector. Tất cả query, mutation, relation, unique constraint, audit và Operation phải School-scoped; SchoolYear là data boundary và business timezone là `Asia/Ho_Chi_Minh`.

`Khoản thu` quản lý ReceivableGroup và Receivable active/inactive theo School, với default price; catalog live không được viết lại snapshot lịch sử. CollectionRun chỉ là `MONTHLY`, có `billingMonth` chuẩn `YYYY-MM`, unique trong SchoolYear và lifecycle `DRAFT -> READY -> GENERATED -> CLOSED`. Trong `DRAFT`, run sở hữu CollectionRunTemplateLine: mỗi Receivable active same-School xuất hiện tối đa một lần, quantity là số nguyên dương và amount/total dùng default unit price do server tính. Browser không gửi price, amount, total, scope Class/Student hay giá trị theo Student. Không có position/reorder; DTO sắp amount giảm dần với stable server tie-breaker.

Preview và generate dùng cùng server selection/evaluation, trả Student eligible và categorized skips, và fingerprint gồm selection, roster, template/catalog cùng policy/target/assignment facts liên quan. Fact đổi làm preview stale. Generate chỉ từ `READY`, preview hiện hành và template hợp lệ không rỗng; transaction khóa, revalidate và snapshot template-derived line vào tối đa một DRAFT Invoice cho mỗi Student eligible. Student được thêm sau `GENERATED` chỉ dùng immutable run template snapshot, không đọc live catalog/template. Per-Invoice DRAFT adjustment có audit/reason và không thay template hay Invoice của Student khác.

Pha 1b quản lý PromotionPolicy School-scoped, version effective-dated, same-School Receivable target và StudentPromotionAssignment có interval, reason, audit. Server tính gross, application/reason, discount và net theo dòng ở preview/generate, rồi đánh giá lại trong Issue transaction. Fixed VND áp dụng trước percentage; priority, exclusivity và tie-breaker phải deterministic; giảm trừ bị cap tại gross, không tạo dòng âm, generic credit hay browser-derived discount. Mọi issued application snapshot policy/version/target/outcome và assignment provenance, không bị live fact viết lại.

Issue chỉ dùng BankAccount active cùng School và snapshot obligation, roster/source facts, receiving bank, account number, holder, transfer content và issued total. VND dùng PostgreSQL `BIGINT` và JSON-safe integer; client không đặt total, outstanding, settlement outcome hoặc lifecycle state. Cookie mutation phải origin-validate và double-submit CSRF. Template, preview/generate, DRAFT line, issue, close và revision dùng UUID `Idempotency-Key`, transaction, School/actor-scoped Operation và audit; identical retry replay outcome, changed fingerprint conflict, timeout phải reconcile `GET /operations/:operationId` trước retry.

Không đưa ChargeRule, Class/Student/service/attendance automatic eligibility, Teacher/Parent dependency, Receipt, settlement, carry, debt, refund, report hay `PREPAID_COVERAGE` vào các story Pha 1b. Promotion fulfillment `PREPAID_COVERAGE` và coverage chỉ thuộc Epic 6 sau settlement theo contract riêng.

## Technical Decisions

`finance` sở hữu CollectionRun, template line, Invoice, policy evaluation/application snapshot, calculation, lifecycle, locking, audit và Operation boundary. Controllers chỉ gọi owning service; Admin portal chỉ gọi REST và không import API internals. Mọi finance graph reference phải verify same-School trong transaction, dùng composite `(schoolId, id)` relation khi khả dụng.

Generate và Issue phải atomic, retry-safe và không để Invoice/InvoiceLine/application partial hoặc duplicate. Enforce unique Invoice `(schoolId, studentId, collectionRunId)`; revision replacement là ngoại lệ hẹp với `revisesInvoiceId` trỏ đến đúng source `CANCELLED` cùng School/Student/run. `READY`, `GENERATED` và `CLOSED` khóa template mutation; `CLOSED` khóa tạo/sửa Invoice. Invoice content và Payment instruction bất biến sau Issue; catalog, BankAccount, template và policy live không được suy diễn lại lịch sử.

Unit tests bao phủ transition, validation, whole-VND calculation và deterministic promotion evaluation. PostgreSQL integration phải chứng minh tenant graph, catalog/template lifecycle, positive quantity, stale preview, snapshot immutability, scoped uniqueness, idempotency và concurrency. E2E phải chứng minh preview/generate/review/issue chỉ hiển thị server values, timeout reconciliation, switch safety và không stale School data. Generate fixture 1.000 Student phải có Operation progress và hoàn tất trong 60 giây; preview trong 3 giây. Epic 1 tenant-isolation gate là điều kiện phát hành.

## UX & Interaction Patterns

Admin/Finance desktop-first và table-first. Sidebar chỉ có `Khoản thu`, `Ưu đãi` và `Đợt thu`; Invoice review là deep destination theo Student từ detail Đợt thu, không phải sidebar item. Trong DRAFT, Finance cấu hình `Khoản thu trong đợt`, chọn Student, yêu cầu preview server rồi generate; Invoice review cho phép ngoại lệ DRAFT từng Student có audit. `Ưu đãi` quản lý policy/version/target/assignment, còn preview và Invoice chỉ hiển thị gross, discount, net cùng application server-returned.

Hiển thị School và period rõ ràng, VND nguyên căn phải, status có text label. Dùng skeleton không mang dữ liệu School cũ, focusable error summary, keyboard-accessible table/stepper và named confirmation cho Issue hay hành động destructive. READY trở đi khóa template/selection. Khi timeout hoặc School context không chắc chắn, chặn repeat submit và vào Operation reconciliation; switch guard chỉ cho remain, discard trước submit hoặc reconcile, không auto-save hay local override.

## Cross-Story Dependencies

Epic 5 phụ thuộc Epic 1 về tenant isolation, session, CSRF, audit, Operation và capability; Epic 2 về SchoolYear, Student, enrollment lifecycle và roster snapshot; Epic 3 về FinancePolicy, BankAccount và effective-dated settings. Stories 5.3 và 5.1-5.8 là historical evidence của empty-DRAFT MVP; contract hiện hành tiếp tục qua 5.9 template, 5.10 populated generate, 5.11 gate, sau đó 5.12 policy/assignment, 5.13 evaluator, 5.14 Issue recheck và 5.15 gate. Epic 6 tiếp nhận `PREPAID_COVERAGE`, Receipt, settlement/carry, refund, debt và ledger/report; Epic 7 mới cung cấp Parent projection.
