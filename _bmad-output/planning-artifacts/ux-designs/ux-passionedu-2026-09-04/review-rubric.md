# Spine Pair Review — PassionEdu

## Overall verdict

Cặp spine có định hướng thị giác và các guardrail an toàn tốt cho Parent attendance, School context, timeout reconciliation và dữ liệu tiền do server trả về. Tuy nhiên đây chưa phải hợp đồng đủ dùng cho downstream: chỉ có flow cho một phần nhỏ hành trình nguồn, nhiều surface/luồng release bắt buộc chưa có hành vi và state tương ứng, còn một nguồn `SPEC.md` trong frontmatter không tồn tại. Cần khép kín phạm vi hành trình, IA, component và state trước khi dùng làm đầu vào cho architecture/story-dev.

## 1. Flow coverage — broken

Đã đối chiếu năm UJ trong PRD PassionEdu với bốn Key Flow. Flow 1 bao phủ một phần UJ-2, Flow 2 bao phủ một phần UJ-3, Flow 3–4 bao phủ một phần UJ-4. Không có Key Flow cho UJ-1 hoặc UJ-5; các phần release-critical còn lại của UJ-2/UJ-3 cũng không có trình tự, climax và failure path đầy đủ.

### Findings

- **[critical]** Thiếu hoàn toàn flow provision/suspend/reactivate School và bootstrap owner của Platform Operator cho **UJ-1. Linh provision truong moi** (PRD `prd.md:43`; `EXPERIENCE.md:108-144`). IA có surface Ops nhưng không có hành trình nào quy định atomic provision, trạng thái pending owner, suspend, lỗi bootstrap hay ranh giới “Ops không đọc business data”. *Fix:* thêm Key Flow dùng đúng tên UJ-1, protagonist Linh, các bước provision/owner login/suspend hoặc reactivate, climax xác nhận School shell đúng quyền, và failure path cho bootstrap/retry/reconcile Operation.
- **[critical]** Không có flow nào cho **UJ-5. An ghi nhan ngay hoc** (PRD `prd.md:47`; `EXPERIENCE.md:108-144`). `Attendance entry` chỉ là một hàng component, không thay được trình tự chọn lớp/ngày, ghi PRESENT/ABSENT/ON_LEAVE, evidence policy, leave/calendar conflict, handover và retry idempotent. *Fix:* thêm Key Flow UJ-5 với climax cập nhật attendance/handover thành công và failure paths cho evidence bắt buộc, ngày nghỉ, PRESENT xung đột leave và timeout.
- **[high]** Flow 2 dừng ở issue và không bao phủ phần bắt buộc của **UJ-3. Minh phat hanh dot thu**: ghi Receipt, allocation, Prepayment/debt, reversal/refund theo policy và báo cáo ledger-derived (PRD `prd.md:45`, `186-204`; `EXPERIENCE.md:119-127`). Một downstream consumer không thể suy ra UX của settlement append-only, self-approval prohibition, partial payment hay reconciliation của các mutation đó. *Fix:* mở rộng Flow 2 hoặc thêm các finance flows theo đúng requirement name, với confirmation, permission boundary, outcome/failure và Operation reconciliation.
- **[high]** UJ-2 chỉ có morning queue; chưa có flow thiết lập SchoolYear, Class, StudentEnrollment, Parent link, Staff assignment, chuyển lớp/chuyển năm có effective date và audit (PRD `prd.md:44`, `121-143`; `EXPERIENCE.md:110-117`). *Fix:* thêm setup/roster flow từ SchoolYear active đến enrollment/link/assignment, kèm preview-confirmation/idempotency cho batch transition và failure path khi School context hoặc eligibility đổi.

## 2. Token completeness — thin

Đã kiểm tra toàn bộ token YAML và mọi `{path.to.token}` trong hai spine. Các tham chiếu token hiện có đều resolve, token màu đều là hex và cấu trúc typography/rounded/spacing/components hợp lệ theo `design-md-spec.md`.

### Findings

- **[high]** DESIGN.md khẳng định mọi tổ hợp text/background/focus đạt WCAG AA nhưng không định nghĩa token focus, trạng thái interactive hoặc cặp màu/ratio tải trọng để consumer kiểm chứng (`DESIGN.md:103-107`). Một số semantic colors được dùng như text/status nhưng không nêu foreground/background được phép; vì vậy statement AA không phải contract có thể triển khai/test. *Fix:* thêm token focus và state (hover/focus/disabled), chỉ rõ cặp foreground/surface cho semantic status và mục tiêu contrast đo được; kiểm tra riêng các màu warning/danger/primary khi dùng cho text nhỏ và focus indicator.
- **[medium]** Frontmatter không nêu hệ UI được kế thừa, trong khi `Foundation` và architecture nói các portal dùng React/Vite và chia sẻ UI primitives (`EXPERIENCE.md:14-16`; architecture `ARCHITECTURE-SPINE.md:48-52`). Điều này khiến consumer không biết các token là toàn bộ system hay chỉ là delta. *Fix:* nêu rõ UI system/base primitives và phạm vi DESIGN.md ghi đè, hoặc xác nhận đây là token system độc lập.

## 3. Component coverage — broken

Đã đối chiếu tên component trong DESIGN.md Components, EXPERIENCE.md Component Patterns, IA, State Patterns và Interaction Primitives. Các component có ở cả hai bên: School context switcher, Queue/Operational queue card, Today card, Illustration panel. Các component nghiệp vụ và interactive khác chỉ có behavioral description, chỉ có visual description, hoặc chỉ xuất hiện trong prose/state.

### Findings

- **[high]** Component contract không bao phủ các control tải trọng của finance và mutation: `CollectionRun wizard`, `Ledger correction dialog`, `Attendance entry`, `Attendance history`, `Leave request`, `Parent inbox`, `Payment instruction`, dialog xác nhận destructive/issue/settlement/reversal/discard và table/filter/pagination (`EXPERIENCE.md:47-60`, `77-83`; `DESIGN.md:125-133`). Nhiều component này không có visual row trong DESIGN.md; `Operation dialog` còn chỉ có visual prose mà không có row Component Patterns. *Fix:* chuẩn hóa một tên cho từng component và thêm visual + behavioral spec tương ứng, tối thiểu anatomy, semantic state, loading/error/disabled/focus, authority of server data và quyền hiển thị.
- **[medium]** Tên component không nhất quán: `Queue card` ở DESIGN.md khác `Operational queue card` ở EXPERIENCE.md; `status-badge` được gọi là `Attendance badge`; `Operation dialog` không có counterpart behavior (`DESIGN.md:80-82`, `87-90`, `125-133`; `EXPERIENCE.md:49-60`). *Fix:* chọn canonical component name, dùng y hệt trong YAML, hai spine và mock annotations.

## 4. State coverage — broken

Đã walk 13 IA surfaces. State Patterns có coverage khá cho Parent revoke, attendance trống/ngày nghỉ, validation, timeout Operation và evidence retention; chưa bao phủ states cho phần lớn Ops, roster, settings và finance/ledger surfaces.

### Findings

- **[high]** Không có state contract cho Ops provision/suspend/reactivate, School chooser (no eligible school/loading/switch failure), roster/settings (empty first SchoolYear, no class, enrollment lifecycle, effective-date conflict) hoặc Staff/Parent link revoke/pending (`EXPERIENCE.md:18-34`, `62-75`). Các surface này có trong IA và là FR-1/2/4/5/6 nhưng consumer không biết dữ liệu rỗng, permission-denied, validation, pending, offline hay mutation failure được xử lý ra sao. *Fix:* bổ sung state matrix theo từng IA surface, với chỉ các state áp dụng: cold load, empty, validation, permission/revoke/suspended, pending/timeout/reconciliation và conflict.
- **[high]** States finance không bao phủ lifecycle và tình huống ledger theo PRD/architecture: CollectionRun `DRAFT/READY/GENERATED/CLOSED`, Invoice `DRAFT/ISSUED/PARTIALLY_PAID/PAID/VOIDED`, outstanding/no-outstanding Payment instruction, partial allocation, Prepayment, reversal/refund awaiting approval/rejected và report no data (PRD `prd.md:160-204`; architecture `ARCHITECTURE-SPINE.md:84-94`; `EXPERIENCE.md:62-75`). *Fix:* định nghĩa state matrix finance server-authoritative, hành động được phép/khóa theo state, lý do không thể thao tác và trạng thái Operation cho mọi mutation idempotent.
- **[medium]** Rubric yêu cầu xét offline khi áp dụng nhưng State Patterns không có offline/network-loss cho bất kỳ PWA portal nào, dù Foundation xác định đây là PWA (`EXPERIENCE.md:14-16`, `62-75`). *Fix:* xác định rõ read/mutation behavior offline, cached-safe shell versus protected Parent data không cache, và recovery/retry sau khi có mạng.

## 5. Visual reference coverage — thin

Workspace có bốn mock: `admin-operational-queue.html`, `finance-run-preview.html`, `parent-home.html`, `parent-inbox.html`; không có `wireframes/` hoặc `imports/`. EXPERIENCE.md liên kết cả bốn ở một câu IA và đã nêu “Spines win on conflict” (`EXPERIENCE.md:16`, `34`), nhưng không có liên kết nào trong DESIGN.md hoặc tại các component/flow mà mỗi mock minh họa.

### Findings

- **[medium]** Các mock chỉ được liệt kê chung, không được liên kết inline tại section giải thích chúng minh họa điều gì; DESIGN.md không tham chiếu visual artifact nào (`EXPERIENCE.md:34`; `DESIGN.md:99-143`). Điều này làm consumer khó phân biệt mock là reference cho layout nào, component nào và state nào. *Fix:* đặt link từng mock tại Layout/Components của DESIGN.md và IA/flow liên quan trong EXPERIENCE.md, kèm một câu phạm vi minh họa; giữ tuyên bố spines-win-on-conflict một lần.
- **[medium]** Coverage visual chỉ gồm queue, CollectionRun preview và hai Parent surface; 9 IA surface còn lại là spine-only nhưng không có quyết định coverage hoặc xác nhận layout không ảnh hưởng hành vi (`EXPERIENCE.md:20-32`). *Fix:* ghi rõ mocked/spine-only cho từng IA surface và bổ sung mock nơi hierarchy/phân quyền/confirmation phức tạp (Ops provision, roster transition, invoice/receipt/reversal).

## 6. Bloat & overspecification — adequate

Hai spine tương đối cô đọng, dùng bảng cho IA/component/state và không lặp lại phần lớn FR. Nội dung server-authoritative, snapshot và idempotency là constraint UX cần thiết chứ không phải restatement trang trí.

### Findings

- **[low]** Một số technical detail như host cụ thể và `fieldErrors` JSON đi vào EXPERIENCE.md (`EXPERIENCE.md:70-73`, `110-112`) trong khi architecture đã là owner. *Fix:* giữ UX outcome/behavior, liên kết hoặc dùng thuật ngữ contract thay vì lặp implementation detail khi không làm thay đổi interaction.

## 7. Inheritance discipline — broken

Đã resolve `sources` trong frontmatter so với workspace. PRD và Architecture PassionEdu tồn tại; `DESIGN.md` resolve cả hai. `EXPERIENCE.md` có thêm một nguồn SPEC không tồn tại. Thuật ngữ và tên UJ nguồn không được dùng như một traceable contract xuyên suốt Key Flows.

### Findings

- **[critical]** `EXPERIENCE.md` tham chiếu `../../../../specs/spec-passionedu/SPEC.md`, nhưng file này không tồn tại (`EXPERIENCE.md:5-10`). Nguồn không resolve làm downstream không thể biết requirement/decision nào là authoritative và có thể bỏ sót contract đã dự kiến kế thừa. *Fix:* khôi phục SPEC tại đúng path hoặc bỏ reference nếu không phải nguồn áp dụng; sau đó rà soát lại các decision từ nguồn hợp lệ.
- **[high]** Key Flows không dùng nguyên văn tên UJ của PRD và không trace các FR tải trọng: các heading “Morning operational queue”, “CollectionRun preview and issue”, “Parent checks...” không map trực tiếp tới UJ-1…UJ-5; các FR-1 đến FR-15 không có coverage map (PRD `prd.md:43-47`, `prd.md:76-257`; `EXPERIENCE.md:108-144`). *Fix:* đổi/bổ sung heading bằng tên UJ verbatim và thêm traceability matrix requirement/surface/flow, đặc biệt cho flows không thể suy ra chỉ từ IA.

## 8. Shape fit — adequate

DESIGN.md có đủ tám section theo canonical order và frontmatter token hợp lệ. EXPERIENCE.md có đủ required defaults, đồng thời có `Responsive & Platform` phù hợp multi-surface và `Inspiration & Anti-patterns` phù hợp với reference Kidsonline trong memlog. Các section product-specific chưa làm tài liệu phình đáng kể.

### Findings

- **[medium]** Tài liệu vẫn `status: draft` và ngày `updated` sau ngày folder, trong khi report được dùng làm gate cho downstream (`DESIGN.md:1-8`; `EXPERIENCE.md:1-10`). Đây không phải lỗi shape, nhưng consumer cần biết hợp đồng chưa được finalized. *Fix:* chỉ đặt `final` sau khi xử lý các finding blocker và xác nhận mock/flow coverage.

## Mechanical notes

- Mọi token reference dạng `{path.to.token}` hiện có đều resolve vào DESIGN.md; không thấy Mermaid trong hai spine để kiểm tra cú pháp.
- Component YAML dùng kebab-case hợp lệ. Tuy nhiên `button-primary` có YAML token nhưng không được gọi tên trong Components prose hoặc Experience behavior, còn một số component prose không có YAML counterpart.
- Mock `parent-home.html` và `parent-inbox.html` dùng emoji làm artwork/icon; chúng không có mô tả thay thế quyết định trong spine. Đây là mock-level accessibility debt, không được phép trở thành iconography contract khi triển khai.
- Source PRD/architecture để review là bộ `passionedu-2026-09-04`; bộ `anhhoa-2026-08-18` được user nêu là artifact đã bị PRD PassionEdu supersede, không phải nguồn UX này kế thừa trực tiếp.
