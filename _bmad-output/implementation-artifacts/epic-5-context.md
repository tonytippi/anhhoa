# Epic 5 Context: Tạo và phát hành nghĩa vụ thu

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Thiết lập Finance Admin MVP để cấu hình khoản thu và rule theo từng Trường, tạo đợt thu tháng, xem preview do server tính, sinh và rà soát Invoice DRAFT không trùng lặp, rồi phát hành nghĩa vụ cùng Payment instruction snapshot bất biến. Điều này tạo một nguồn nghĩa vụ thu có thể kiểm toán, không phụ thuộc Teacher, Parent hay dữ liệu vận hành tự động; các thay đổi và trạng thái sau khi phát hành phải giữ được lịch sử đáng tin cậy cho settlement và Parent projection ở các epic sau.

## Stories

- Story 5.1: Quản lý receivable catalog theo School
- Story 5.2: Tạo CollectionRun và server-authoritative preview
- Story 5.3: Generate Invoice DRAFT idempotent theo snapshot roster/rule
- Story 5.4: Rà soát Invoice DRAFT và manual Finance-source có audit
- Story 5.5: Issue Invoice với Payment instruction snapshot bất biến
- Story 5.6: Release gate Finance Admin MVP
- Story 5.7: Đóng CollectionRun đã generate
- Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ

## Requirements & Constraints

- Finance Manager hoặc School Admin có `FINANCE_MANAGE` hợp lệ mới được quản lý catalog, CollectionRun và Invoice trong School đang chọn. Mọi request phải tái xác thực School, membership/binding/Position capability ở server; URL, UUID, filter, header và browser state chỉ là selector, không phải bằng chứng quyền.
- ReceivableGroup và Receivable là School-scoped, có lifecycle/audit; mục inactive không dùng cho line mới nhưng còn đọc được qua snapshot lịch sử. Mã khoản thu là tùy chọn nhưng phải unique trong School khi có.
- Finance Admin MVP không có ChargeRule, `FIXED`/`MANUAL`, precedence hay auto-charge. Invoice DRAFT bắt đầu rỗng; Finance chọn Receivable active, nhập quantity nguyên dương và dùng default/authorized override price. Server tính mọi amount; absence của line nghĩa khoản không áp dụng.
- VND phải lưu `BIGINT` và REST chỉ trả JSON-safe integer. Client không được đặt hay làm authority cho total, outstanding, settlement outcome hoặc Invoice status.
- Một CollectionRun `MONTHLY` có `billingMonth` chuẩn `YYYY-MM`; mỗi SchoolYear chỉ có một run cho một tháng. Lifecycle là `DRAFT -> READY -> GENERATED -> CLOSED`; cấu hình/scope chỉ sửa ở DRAFT, GENERATED khóa snapshot gốc, CLOSED chặn tạo/sửa Invoice.
- Preview và generate bắt buộc dùng cùng Student-selection server-side, trả eligible rows và skip được phân loại. Preview stale, invalid hoặc state conflict phải bị từ chối thay vì dùng kết quả client cũ.
- Generate từ READY phải lấy roster as-of snapshot và bảo đảm tối đa một DRAFT Invoice rỗng cho mỗi Student được chọn/eligible trong run, với unique `(schoolId, studentId, collectionRunId)`. Kết quả nêu rõ Invoice tồn tại, enrollment không đủ điều kiện hoặc không Class active.
- Finance chỉ được thêm/sửa/xóa DRAFT line, override unit price hoặc thêm manual Finance-source khi Invoice còn DRAFT, có authority, whole-VND và note/reason audit. Manual source chỉ snapshot tham chiếu do Finance nhập như service date, attendance status, picked-up time hoặc late-care minutes; không tự suy ra fee, price, discount hay total.
- Issue chỉ nhận BankAccount active cùng School, khóa obligation và snapshot bank, account number, account holder, transfer content, student/class facts và issued total. Invoice `ISSUED` không sửa nội dung, tài khoản, instruction hay trạng thái tại chỗ.
- Revision là đường sửa hẹp cho Invoice đã issue: tạo replacement DRAFT từ source snapshot với reason, audit và lineage; khi replacement được issue, source cùng School/Student/run chuyển atomically sang `CANCELLED`. Source Invoice, Payment instruction, Receipt và audit không bị ghi đè; replacement thứ hai hoặc lineage sai bị từ chối.
- Các mutation nhiều bản ghi hoặc high-impact như generate, issue, close run và revision cần UUID `Idempotency-Key`, transaction, Operation và audit. Retry cùng fingerprint replay kết quả; fingerprint khác conflict; sau timeout phải `GET /operations/:operationId` đối soát trước retry.
- Cookie mutation phải có origin validation và double-submit CSRF. Test phải chứng minh tenant isolation, scoped uniqueness, lifecycle lock, integer math, snapshot immutability, retry/concurrency và không chấp nhận client injection. Generate fixture 1.000 Student phải có Operation progress và hoàn tất trong 60 giây.
- Finance Admin MVP chưa bao gồm ChargeRule automation, service catalog/enrollment, approved-leave materialization, PromotionPolicy/StudentPromotionAssignment, `PREPAID_COVERAGE`, Receipt/settlement/carry, report hoặc phụ thuộc attendance, teacher-web và parent-web. Không tạo UI hay authorization dependency thay thế các phạm vi hoãn này.

## Technical Decisions

- `apps/api` và module `finance` sở hữu Prisma, PostgreSQL, authorization, calculation, transition, snapshot, audit và Operation; controller chỉ gọi owning service. Portal Admin chỉ dùng REST, không import API internals hoặc app portal khác.
- `School` là tenant root: mọi aggregate, query, write, unique constraint, audit và Operation Finance phải scope `schoolId`; update/delete xác minh cả ID và School trong cùng transaction. Finance snapshot roster-owned enrollment/class facts thay vì tính lại từ dữ liệu hiện hành.
- Dùng timezone `Asia/Ho_Chi_Minh` và effective interval `[effectiveFrom, effectiveTo)`. SchoolYear là boundary của CollectionRun/Invoice; thay đổi catalog, policy, roster hoặc BankAccount hiện hành không được rewrite snapshot đã phát hành.
- Operation Finance scope School, route và actor context, atomically lưu request fingerprint/outcome; chỉ actor context tạo Operation mới được đọc outcome. Audit lưu School, actor identity/reference, thời gian, provenance và reason khi bắt buộc.
- Invoice lifecycle là `DRAFT`, `ISSUED`, `CLOSED`, `CANCELLED`. Sau issue, chỉ workflow Receipt-close hoặc revision/cancellation được phép chuyển trạng thái; Parent sau này chỉ nhận current-effective obligation, không nhận lý do correction hay ledger provenance.

## UX & Interaction Patterns

- Finance dùng Admin desktop-first: danh sách CollectionRun là bảng gọn có filter/create; chọn run mở bảng Student với eligibility/Invoice status dạng text và hành động đi tới Invoice. Invoice review là deep destination, không phải landing page.
- Wizard CollectionRun hiển thị rõ School, SchoolYear/period và Student selection; dùng keyboard-accessible stepper. Preview/generate chỉ render Student eligibility/skips do server trả; không có optimistic total hay local eligibility.
- DRAFT review cho phép chọn Receivable active, quantity dương, VND price server validate và optional explanatory reference/reason; UI không gợi ý auto fee hay hiển thị rule mode. Issue/destructive action cần named confirmation, focus trap/return và refresh state khi lifecycle conflict.
- Validation giữ input, đặt `fieldErrors` cạnh trường và focus error summary. Timeout khóa submit lặp, hiển thị reconciliation, chỉ mở retry sau Operation result. School switch guard ngăn đổi context khi form dirty hoặc mutation chưa chắc chắn.
- Amount VND dùng typography numeric, căn phải và không bị nén trên màn nhỏ; bảng có caption, keyboard row action và horizontal scroll/card responsive. Mỗi trạng thái có nhãn văn bản, màu không là tín hiệu duy nhất, focus/contrast đạt WCAG 2.1 AA.

## Cross-Story Dependencies

- Epic 5 phụ thuộc Epic 1 cho tenant isolation, session/authorization, CSRF, idempotency và Operation; Epic 2 cho SchoolYear, Class, Student enrollment và roster snapshot; Epic 3 cho FinancePolicy và BankAccount active/history.
- Story 5.1 cung cấp catalog cho 5.4. Story 5.2 cung cấp CollectionRun và Student selection cho 5.3. Story 5.3 tạo DRAFT Invoice rỗng cho 5.4; 5.4 hoàn tất review trước 5.5 issue. Story 5.6 kiểm chứng toàn bộ MVP.
- Story 5.7 close chỉ thực hiện sau GENERATED và khi mọi Invoice là `ISSUED`, `CLOSED` hoặc `CANCELLED`. Story 5.8 revision dùng DRAFT review/issue flow nhưng thuộc release settlement cùng Epic 6; Epic 6 tiếp tục Receipt, settlement, carry, ledger và report.
- Epic 4 là enhancement sau MVP: operational facts không được ghi đè hoặc re-price manual Finance-source snapshot đã issue.
