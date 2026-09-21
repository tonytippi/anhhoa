# Sprint Change Proposal: Tách nghỉ ngắn, bảo lưu và Finance adjustment

**Ngày:** 2026-09-21

**Trigger:** Story 4.5 bị chặn trong planning sau trao đổi với Business Owner. Thực tế vận hành phân biệt nghỉ ngắn có Parent app với nghỉ dài/bảo lưu được thỏa thuận trực tiếp với School; các điều kiện giảm học phí và phí khôi phục khác nhau theo School/thỏa thuận.

**Chế độ review:** Batch

## 1. Issue Summary

Contract hiện hành gộp hai nghiệp vụ khác nhau vào `long leave`: Parent/Admin tạo request, School Admin approve/reject, rồi tự loại Student khỏi CollectionRun tương lai. Điều này không phản ánh vận hành đã xác nhận:

- Parent chỉ dùng app cho nghỉ ngắn để giảm tiền ăn theo ngày.
- School Admin hoặc Kế toán có thể duyệt đơn nghỉ ngắn khi đơn không auto-approved.
- Nghỉ từ hai tuần trở lên trong một tháng được trao đổi trực tiếp; Kế toán tự thêm adjustment vào Invoice `DRAFT` hoặc áp dụng Finance policy. Không suy luận mức 35-40% từ leave request.
- Bảo lưu là transition `StudentEnrollment` do School Admin quản lý; khi quay lại trong SchoolYear, miễn/thu cơ sở vật chất và phí khôi phục 500.000 VND là thỏa thuận Finance, không phải lifecycle rule tự động.

Nếu giữ contract cũ, API sẽ tạo một long-leave workflow không được dùng, tự thay đổi CollectionRun eligibility và có nguy cơ hard-code giảm học phí/phí khôi phục không đồng nhất giữa các School.

## 2. Impact Analysis

### Checklist

- [x] 1.1 Trigger: Story 4.5 Service enrollment và long leave làm nguồn Finance có kiểm soát.
- [x] 1.2 Loại thay đổi: yêu cầu nghiệp vụ mới được Business Owner làm rõ; contract ban đầu gộp sai các workflow.
- [x] 1.3 Evidence: xác nhận vận hành Parent app chỉ xử lý nghỉ ngắn/tiền ăn; giảm học phí và bảo lưu theo thỏa thuận trực tiếp.
- [x] 2.1 Epic 4 vẫn hoàn thành được sau khi bỏ `LongLeaveRequest` và thay bằng source leave-ngày + service enrollment.
- [x] 2.2 Epic 4 sửa Story 4.5, capability approval và release proof.
- [x] 2.3 Epic 5 sửa source/adjustment wording; Epic 7 Parent leave UX giữ nghỉ ngắn; Epic 2 lifecycle đã có `ON_LEAVE` và không cần rollback.
- [x] 2.4 Không cần Epic mới. Bảo lưu dùng aggregate đã có; Finance policy/adjustment đã thuộc Epic 5.
- [x] 2.5 Không đổi thứ tự Epic: E4 vẫn cấp source, E5 vẫn sở hữu receivable, Invoice DRAFT, adjustment/policy và VND.
- [!] 3.1 PRD final có xung đột tại FR-12/FR-10 và cần Product cập nhật sau khi proposal được duyệt.
- [!] 3.2 Architecture Spine final có xung đột tại AD-13 và cần Architect ratify supersession.
- [!] 3.3 UX final có xung đột tại Service and long leave/Flow 2d và cần UX cập nhật.
- [x] 3.4 Không ảnh hưởng IaC, deployment hay CI/CD; API/Prisma/Admin/Parent tests sẽ đổi khi implementation bắt đầu.
- [x] 4.1 Direct adjustment: khả thi, effort Medium, risk Medium.
- [x] 4.2 Rollback: không khả thi/cần thiết; Stories 2.2, 2.5 và 4.1-4.4 vẫn đúng, `ON_LEAVE` đã là lifecycle hữu ích.
- [x] 4.3 MVP review: không cần giảm MVP; phân tách làm MVP sát vận hành và ít hard-code hơn.
- [x] 4.4 Khuyến nghị: Direct Adjustment, với PM/Product cập nhật PRD và Architect ratify Spine trước build lại Story 4.5.

### Epic Impact

| Epic | Impact |
| --- | --- |
| Epic 2 | Không đổi scope/code hoàn thành. `StudentEnrollmentLifecycle.ON_LEAVE` là cơ chế bảo lưu; future Story 4.5 chỉ consume transition history, không tạo lifecycle song song. |
| Epic 4 | Đổi Story 4.5: bỏ long-leave request/approval; giữ StudentServiceEnrollment; xuất immutable daily leave facts và service facts, không có receivableId/VND/Invoice. Bổ sung `LEAVE_REQUEST_DECIDE` capability cho Admin + Finance. |
| Epic 5 | Catalog quyết định Receivable. CollectionRun dùng lifecycle enrollment như roster eligibility. Invoice DRAFT adjustment/policy là nơi Kế toán áp dụng giảm học phí theo thỏa thuận, với reason/audit; meal adjustment materialization map leave fact sang receivable sau khi catalog tồn tại. |
| Epic 6 | Refund wording không coi long leave là source riêng; refund vẫn có thể dùng service cancellation, coverage, hoặc Finance adjustment source hợp lệ. |
| Epic 7 | Parent leave UI/API chỉ tạo/quản lý leave ngắn; không có long-leave request, bảo lưu, service cancellation, policy selection hay Finance adjustment. |

### Rủi ro được kiểm soát

- Không hard-code ngưỡng 2 tuần, mức giảm 35-40%, 500.000 VND, hay miễn phí cơ sở vật chất: các điều kiện này là Finance policy/adjustment có reason/audit trong Epic 5.
- Không cho Kế toán đổi enrollment lifecycle: `ROSTER_MANAGE` tiếp tục giới hạn bảo lưu/resume cho School Admin.
- Không tạo `receivableId` giả trước khi catalog Epic 5 tồn tại.
- Không biến attendance/leave thành pricing engine: Epic 4 chỉ xuất fact bất biến; Finance là module duy nhất chọn receivable, target DRAFT và VND amount.

## 3. Recommended Approach

**Chọn: Direct Adjustment, phạm vi Moderate.**

Tạo một superseding product/architecture decision, sau đó cập nhật canonical PRD, Spine, UX và backlog. Không triển khai Story 4.5 cho tới khi các cập nhật này được chấp thuận. Cách này bảo toàn source ownership và dùng lại lifecycle `ON_LEAVE` đã được triển khai thay vì thêm `LongLeaveRequest` không có owner vận hành.

**Effort:** Medium. **Rủi ro:** Medium nếu capability/service facts bị gộp vào Finance quá sớm; Low sau khi giữ đúng ranh giới dưới đây.

## 4. Detailed Change Proposals

### A. Quyết định nghiệp vụ mới

1. `LeaveRequest` là nghỉ ngắn theo ngày do Parent tạo trong app. Nó chỉ là source tiềm năng cho giảm tiền ăn; không dừng CollectionRun, không tự giảm học phí và không tạo bảo lưu.
2. `LEAVE_REQUEST_DECIDE` là capability Platform-controlled, cấp cho School Admin và Finance Manager. Nó authorize approve/reject late short leave; auto-approved leave không cần actor quyết định. Quyền được resolve từ active SchoolPosition, không từ role name.
3. Bảo lưu dùng `StudentEnrollment` lifecycle `ENROLLED -> ON_LEAVE` và resume `ON_LEAVE -> ENROLLED`, do School Admin với `ROSTER_MANAGE` thực hiện qua effective-dated Operation/audit. Không có Parent bảo lưu endpoint và Kế toán không thay đổi lifecycle này.
4. Giảm học phí nghỉ dài, miễn phí cơ sở vật chất khi quay lại và phí khôi phục 500.000 VND là Finance agreement/policy hoặc manual adjustment trên Invoice `DRAFT`, với whole-VND, reason/audit và server authority. Không có threshold, percentage, fee hay auto-charge trong attendance/roster.
5. Story 4.5 chỉ persist/đọc immutable operational source facts theo School/Student/day hoặc interval/source provenance. Epic 5, sau Receivable catalog, map fact sang receivable và materialize meal adjustment idempotent.

### B. Backlog: `epics-passionedu.md`

**Epic 4 summary, OLD:**

```text
School Admin/Finance quan ly service va long leave; leave state, evidence,
conflict va Finance adjustment source duoc bao toan ma khong tu dong tinh fee.
```

**NEW:**

```text
School Admin/Finance quan ly service enrollment va duyet leave ngắn theo
capability; School Admin quan ly bao luu qua StudentEnrollment lifecycle.
Leave state, evidence, conflict va immutable operational source facts duoc
bao toan ma khong tu dong tinh fee, giam hoc phi hay CollectionRun outcome.
```

**Story 4.5 title/intent, OLD:**

```text
Service enrollment và long leave làm nguồn Finance có kiểm soát
... quan ly service enrollment va long leave source theo effective date,
So that CollectionRun eligibility va adjustment/refund tuong lai dua tren nguon co audit...
```

**NEW:**

```text
Service enrollment và nguồn leave ngắn cho Finance có kiểm soát
... quan ly service enrollment theo effective date va cong bo source fact
từ leave ngắn đã xác nhận,
So that Finance có dữ liệu audit-safe cho meal adjustment sau này mà không
tự suy diễn giảm học phí, bảo lưu hoặc credit.
```

**Story 4.5 AC #2-#3, OLD:**

```text
Parent hoac School Admin khoi tao long leave source; School Admin duyet/tu choi...
approval loai Student khoi future CollectionRun eligibility...
API tra immutable adjustment eligibility source theo School/Student/day/receivable...
```

**NEW:**

```text
Given leave ngắn sau deadline đang PENDING và School Admin hoặc Finance Manager
có LEAVE_REQUEST_DECIDE trong selected School
When actor approve/reject với Idempotency-Key
Then API re-authorize capability, persist actor-scoped Operation/audit, replay
identical outcome và reject changed fingerprint
And leave chỉ là source meal theo ngày; không thay đổi StudentEnrollment,
future CollectionRun eligibility, Invoice đã issue hay học phí.

Given LeaveRequest AUTO_APPROVED/APPROVED có ngày vận hành
When Finance cần dữ liệu cho Epic 5
Then attendance trả immutable source fact theo School/Student/day/leave provenance
và trạng thái eligibility, loại trừ ngày có PRESENT đã xác nhận
And source không có receivableId, amount, Invoice hay CollectionRun lookup;
Epic 5 sau khi có Receivable catalog mới map và materialize adjustment DRAFT idempotent.

Given School Admin có ROSTER_MANAGE bảo lưu/resume StudentEnrollment
When transition ENROLLED -> ON_LEAVE hoặc ON_LEAVE -> ENROLLED có effective date/reason
Then roster lưu lifecycle transition/Operation/audit theo contract Epic 2
And transition không tự tạo giảm học phí, phí khôi phục, miễn phí cơ sở vật chất,
Invoice mutation hay Finance policy application.
```

**Story 4.7 AC fixture, OLD:** `leave, evidence va adjustment source` và long-leave adjustment assumptions.

**NEW:** thêm PostgreSQL/API/E2E proof cho `LEAVE_REQUEST_DECIDE` Admin/Finance grant và revoke, Parent không có decision/service-cancel/bảo lưu route, `PRESENT` exclusion, immutable leave fact, và absence of automatic tuition/return-fee behavior.

**Story 5.2/5.3, NEW clarification:** CollectionRun eligibility đọc effective `StudentEnrollment` lifecycle snapshot. `ON_LEAVE` có thể tạo categorized skip theo lifecycle, nhưng không suy luận mức giảm học phí hay charge khôi phục.

**Story 5.4, OLD:** `adjustment dua tren attendance/long leave source`.

**NEW:**

```text
adjustment dựa trên immutable approved-leave-day source hoặc source Finance hợp lệ
(service cancellation, policy/coverage hoặc manual agreement có reason/audit).
```

Thêm AC: Finance Manager chỉ thêm giảm học phí/phí khôi phục lên Invoice `DRAFT` qua manual adjustment hoặc approved Finance policy; server validate whole-VND, School/Student/Invoice state và required reason/audit. Không suy luận từ số ngày LeaveRequest, enrollment transition hay client-calculated percentage.

### C. PRD final: `prds/prd-passionedu-2026-09-04/prd.md`

**FR-12, OLD:** `School Admin/Finance Manager quan ly approval/service enrollment theo policy` và long leave Parent/Admin + School Admin approve/reject/exclude future CollectionRun.

**NEW:**

```text
Parent chỉ gửi LeaveRequest ngắn theo ngày cho Student được ủy quyền.
Leave trước deadline auto-approved; leave PENDING sau deadline chỉ School Admin
hoặc Finance Manager có LEAVE_REQUEST_DECIDE từ active Position mới approve/reject.
Leave confirmed là source meal theo ngày, không tự thay đổi học phí, CollectionRun
eligibility hay StudentEnrollment.

StudentServiceEnrollment có status, effective dates và audit; School Admin/Finance
Manager có capability phù hợp tạo/hủy, Parent không tự hủy service.

Bảo lưu là StudentEnrollment lifecycle ON_LEAVE/ENROLLED do School Admin với
ROSTER_MANAGE thực hiện theo effective date/reason, Operation/audit. Bảo lưu không
tự tạo fee, discount, refund hay Invoice mutation.
```

**FR-10 refund examples, OLD:** `long leave/huy service`.

**NEW:** `service cancellation, paid coverage, hoặc Finance adjustment/policy source hợp lệ`; bỏ long leave như aggregate source.

**UX-DR9, OLD:** `attendance/handover/service/long-leave flows`.

**NEW:** `attendance/handover/service/short-leave và roster preservation flows`; nêu rõ Finance adjustment không tự tính từ leave/bảo lưu.

### D. Architecture Spine final: `ARCHITECTURE-SPINE.md`

**AD-13, OLD:** `An approved long leave excludes future CollectionRun eligibility; issued obligations use a source-linked adjustment/refund workflow.`

**NEW supersession:**

```text
Long leave is not an attendance aggregate. Attendance owns immutable
AUTO_APPROVED/APPROVED short-leave-day facts and PRESENT-conflict exclusions;

Roster alone owns effective StudentEnrollment ENROLLED <-> ON_LEAVE preservation
```

**AD-20 addition:** `LEAVE_REQUEST_DECIDE` is class-independent, School-scoped and requires active membership/binding/primary Position; `ROSTER_MANAGE` remains the exclusive lifecycle authority for preservation. Both deny before lookup/write on revoke/inactive state.

### E. UX final: `ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md`

**Service and long leave surface, OLD:** Parent/Admin starts long leave; only School Admin approves/rejects effective date.

**NEW:**

```text
Service enrollment: School Admin/Finance manage effective-dated service enrollment.
Short leave: Parent creates a child/day request; authorized School Admin or Finance
Manager sees and decides pending late requests. Parent sees only its own request result.
Preservation: only School Admin uses the roster lifecycle action after direct agreement;
there is no Parent long-leave form or automatic fee/reduction UI.
```

**Flow 2d, OLD:** Parent/Admin starts long leave then Admin approves/rejects.

**NEW:** đổi thành Flow `Service enrollment, short leave source and Finance review`: Parent creates short leave in Flow 4; Admin/Finance review only pending late leave; Finance review shows source fact and may create a DRAFT adjustment/policy under Epic 5. Bảo lưu là Admin roster flow riêng, với explanation rằng Finance agreement không được tự áp dụng trên UI.

## 5. Implementation Handoff

**Scope:** Moderate, cần Product Owner/PM + Architect trước Developer.

1. Product Owner/PM: xác nhận wording sửa FR-10/FR-12 và Epic 4/5/7; quyết định tên capability `LEAVE_REQUEST_DECIDE`.
2. Architect: ratify AD-13 supersession và AD-20 capability binding; xác nhận `ON_LEAVE` eligibility read không làm pricing engine.
3. UX: cập nhật `EXPERIENCE.md` theo Parent short leave, Admin preservation và Finance adjustment boundaries.
4. Developer: chỉ sau các artifact canonical được cập nhật, thay Story 4.5 spec blocked bằng plan mới; triển khai capability, ServiceEnrollment, immutable leave fact export, API/UI và tests. Không tạo LongLeaveRequest hoặc tự động Finance behavior.
5. Sprint tracker: giữ Story 4.5 `backlog` trong lúc approval. Sau canonical update, đổi title/key nếu backlog tracker cần phản ánh slug mới; không đánh dấu ready-for-dev cho tới khi planning/build spec pass.

## 6. Success Criteria

- Parent app không hiển thị/tạo long leave, bảo lưu hoặc service cancellation.
- Cả School Admin và Finance Manager có `LEAVE_REQUEST_DECIDE` mới approve/reject pending short leave; revoked actor bị chặn trước write.
- Một leave day confirmed chỉ xuất fact meal eligibility, và `PRESENT` loại trừ fact đó.
- Bảo lưu/resume chỉ là audited enrollment transition của School Admin; nó không tạo VND, policy, Invoice hoặc return fee.
- Finance DRAFT adjustment/policy là đường duy nhất cho giảm học phí theo thỏa thuận và phí khôi phục; no client-calculated/hard-coded percentage or amount.
- Story 4.5 build không còn bị chặn bởi receivable identity, vì receivable mapping thuộc Epic 5.

## Approval Record

Approved by user on 2026-09-21. Canonical planning artifacts and sprint tracker updated in accordance with this proposal.
