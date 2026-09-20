# Sprint Change Proposal: Chức danh School-configurable và handover toàn trường

**Ngày:** 2026-09-19
**Trạng thái:** Approved for planning handoff
**Phạm vi:** Major
**Trigger:** Trong khi hoàn tất Story 4.1, mô hình `staffType: TEACHER | STAFF` lộ ra không phản ánh vận hành thực tế. School cần tự quản lý chức danh, còn quyền trả trẻ phải dựa vào capability trong School thay vì Class assignment.

## 1. Tóm tắt vấn đề

`TEACHER | STAFF` không mô tả được Hiệu trưởng, Quản lý trường, Kế toán, Nhân viên tuyển sinh, Bếp và Y tế. Dùng SchoolRole preset cố định làm nguồn quyền khiến mỗi chức danh mới cần sửa code và làm School Admin phải thao tác khái niệm authorization kỹ thuật.

Contract handover hiện yêu cầu teacher/Class assignment. Điều này không phù hợp khi một Staff được cấp quyền trả trẻ cần xác nhận cho bất kỳ Student nào trong School, không phụ thuộc lớp. Handover vẫn là operational reference, không phải pickup authorization và không tạo phí tự động.

## 2. Phân tích tác động

### Epic

- **Epic 1:** Authorization chuyển từ role preset cố định sang capability được resolve từ SchoolPosition; Parent/Ops/Platform vẫn dùng boundary hiện tại.
- **Epic 2:** Staff profile có một chức danh chính; School Admin quản lý chức danh, Staff login binding và class assignment. Class assignment không phải prerequisite của handover.
- **Epic 4:** Leave/attendance/DailyJournal lớp dùng capability cộng assignment hiệu lực; handover dùng capability toàn School.
- **Epic 7:** Không thay Parent authorization, DTO hoặc evidence boundary.

### Story

- **Story 2.4:** Rework thành quản lý Staff profile, SchoolPosition, login binding và assignment theo capability. `staffType` bị thay thế.
- **Story 4.1:** Teacher leave read thay `staffType` bằng `CLASS_LEAVE_READ` capability, vẫn giới hạn Class assignment hiệu lực.
- **Story 4.2:** Attendance yêu cầu `ATTENDANCE_WRITE` cùng Class assignment hiệu lực.
- **Story 4.4:** Handover yêu cầu `HANDOVER_WRITE` trong selected School, không yêu cầu Class assignment.
- **Story 4.7:** Bổ sung proof cho capability revoke, Position inactive, School isolation và handover cross-class trong cùng School.

### Artifact conflict

- PRD hiện cấm custom-role checkbox UI; cần thay bằng SchoolPosition có capability catalog bị giới hạn.
- Architecture hiện dùng preset SchoolRole như nguồn capability; cần quyết định migration và snapshot/audit semantics.
- UX Admin cần workspace Chức danh với capability list, active/inactive state, audit reason và dirty School-switch guard.

### Kỹ thuật

- Thêm `SchoolPosition`, Position capability grants, Staff position assignment và Position lifecycle/audit; tất cả School-scoped.
- Xóa `StaffType`/`staffType` sau migration. Không duy trì hai nguồn authorization dài hạn.
- Migrate `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER` grants sang capability grants của Position; cần transition plan không làm mất quyền giữa migration.
- API resolve capability server-side từ active StaffProfile, active Position, active membership binding và capability catalog. Client không gửi capability/name làm bằng chứng.
- `HANDOVER_WRITE` check School-scoped Staff capability/binding, Student/enrollment/date/policy/evidence; bỏ Class assignment check duy nhất cho handover.
- Position/capability mutation là high-impact: transaction, UUID Idempotency-Key, Operation reconciliation, audit reason; capability histories không viết lại audit/operation snapshot lịch sử.

## 3. Hướng tiếp cận được chọn

**Direct adjustment sau planning rework.** Không rollback Story 4.1; giữ leave persistence, Parent boundary, idempotency và Staff login binding đã có. Tạo follow-up migration/domain để thay source authorization `staffType`/preset roles bằng Position capability catalog trước khi Story 4.2 và 4.4 được build.

Lý do: Một Staff có một chức danh chính trong vận hành thường ngày. Chức danh có thể đổi tên, tạo mới hoặc inactive theo School, nhưng Platform kiểm soát capability catalog để tránh School tự tạo quyền không có domain/enforcement. Handover toàn School xử lý trường hợp Staff được giao trả trẻ mà không ép tạo phân công lớp tạm thời.

**Rủi ro:** Cao nếu migration giữ đồng thời role preset và Position capability vô thời hạn. Mitigation: one-way migration, negative integration tests và release gate trước attendance/handover writes.

## 4. Đề xuất thay đổi chi tiết

### 4.1 PRD, section 4.5 / FR-12 và FR-13

**OLD**

```text
Teacher có capability ghi attendance, handover và DailyJournal trong Class được phân công.
Nhân viên được cấp capability ghi picked-up time và ảnh evidence theo HandoverPolicy.
```

**NEW**

```text
Mỗi Staff có một Chức danh chính School-scoped đang hiệu lực. Server resolve capability từ Chức danh hiệu lực, active StaffProfile và active login binding; tên Chức danh không phải bằng chứng authorization.

`ATTENDANCE_WRITE`, `DAILY_JOURNAL_WRITE` và `CLASS_LEAVE_READ` vẫn cần StaffClassAssignment hiệu lực trong Class phù hợp. `HANDOVER_WRITE` áp dụng cho mọi Student trong selected School và không yêu cầu Class assignment; server vẫn re-authorize Staff, School, Student enrollment, ngày, HandoverPolicy và evidence trên mỗi request.

Handover không thay pickup authorization và không tự tính/tạo phí.
```

**Rationale:** Tách quyền vận hành khỏi lớp chỉ cho handover, giữ ràng buộc class ở các write/read cần sở hữu bối cảnh lớp.

### 4.2 PRD, section 5 Non-goals

**OLD**

```text
Không có custom-role checkbox UI.
```

**NEW**

```text
Không có custom capability creation. School có thể quản lý Chức danh và chọn capability từ catalog Platform giới hạn, có audit; không có custom script, free-form permission hoặc Platform/Parent/Ops capability trong SchoolPosition.
```

**Rationale:** Cho School tự quản lý chức danh mà không mở authorization tùy ý.

### 4.3 Architecture Spine, decision mới: AD-20 SchoolPosition capability boundary

**NEW**

```text
SchoolPosition là cấu hình tenant-owned với code/name, ACTIVE/INACTIVE và tập capability từ catalog Platform. Provision seed Hiệu trưởng, Quản lý trường, Kế toán, Giáo viên, Nhân viên tuyển sinh, Bếp và Y tế. School Admin có thể đổi tên, tạo hoặc inactive Position và gán capability catalog được phép; không xóa Position đã có Staff/audit history và không tạo capability mới.

Mỗi active StaffProfile có một Position chính và tối đa một active login binding với SchoolMembership. Server resolve request capability từ StaffProfile ACTIVE, Position ACTIVE, binding active và Position capability; authorization history/audit snapshot không bị rewrite khi Position đổi. Class assignment chỉ tham chiếu StaffProfile.

`HANDOVER_WRITE` authorizes cùng School mà không yêu cầu Class assignment. `ATTENDANCE_WRITE`, `DAILY_JOURNAL_WRITE` và `CLASS_LEAVE_READ` additionally require effective assignment/placement. Position mutation là transactional, idempotent Operation có audit reason; mọi query, grant, unique constraint và audit School-scoped.
```

**Rationale:** Xác lập một source authorization School-configurable, hạn chế capability catalog và giữ tenant graph integrity.

### 4.4 Epic/story backlog

**Story 2.4 -- OLD title**

```text
Quản lý staff profile và phân công theo effective-date
```

**Story 2.4 -- NEW title**

```text
Quản lý Staff, Chức danh và phân công theo capability/effective-date
```

**NEW acceptance criteria**

```text
Given School mới được provision
When School Admin mở quản lý Chức danh
Then server trả bộ seed Hiệu trưởng, Quản lý trường, Kế toán, Giáo viên, Nhân viên tuyển sinh, Bếp và Y tế trong School context
And School Admin chỉ gán capability từ Platform catalog cho phép, có reason/audit/Operation, không thể tạo Platform/Parent/Ops capability.

Given Staff ACTIVE có một Position ACTIVE và login binding active
When request operational route
Then server resolve capability từ Position, không từ position name/browser state
And inactivate Position hoặc Staff deny request kế tiếp nhưng giữ lịch sử/audit.

Given School Admin tạo hoặc cập nhật StaffClassAssignment
When Staff không ACTIVE, Position không cho operational class capability, hoặc Class ngoài School
Then server từ chối trước write/audit/Operation outcome thành công.
```

**Story 4.4 -- change acceptance criteria**

```text
Given StaffProfile ACTIVE với Position capability HANDOVER_WRITE và active binding trong selected School
When Staff submit picked-up time cho Student/enrollment/date hợp lệ trong School
Then server không yêu cầu Class assignment, nhưng enforce School scope, HandoverPolicy/evidence, idempotency và audit
And Student/Class UUID từ School khác hoặc revoked/inactive Position/binding bị từ chối.
```

### 4.5 UX

**NEW Admin workspace:** `Chức danh`

```text
Table-first desktop workspace: tên, code, trạng thái, số Staff và capability text labels. Create/edit uses catalog checkboxes grouped by operational area; no raw JSON or free-form permission. Inactivate requires confirmation/reason and explains effects on next request. Visible School context, keyboard/focus/error rules and dirty-form School-switch guard follow existing Admin UX contract.
```

## 5. Handoff implementation

**Classification:** Major.
**Handoff:** Product Manager + Solution Architect cập nhật canonical PRD, Epic 2/4 backlog và Architecture Spine. UX Designer cập nhật Admin workspace contract. Developer chỉ bắt đầu migration/code sau các artifact canonical được approved.

### Success criteria

- Canonical PRD bỏ custom-role prohibition theo replacement contract, không tạo free-form permissions.
- Architecture defines Position catalog, seed, lifecycle, migration from preset grants, snapshot/audit and revoke semantics.
- Epic acceptance criteria phân biệt rõ class-scoped operations với School-wide `HANDOVER_WRITE`.
- PostgreSQL proof cover cross-School Position/capability, inactive Position/Staff/binding, no dual authorization source after migration, class restriction cho attendance/journal/leave, và handover cross-class trong School.
- E2E chứng minh Admin quản lý Position accessible, teacher/staff handover behavior server-confirmed và School switch/revoke không leak context.

## 6. Phê duyệt và trạng thái

- Proposal 1, SchoolPosition contract: **Approved**.
- Proposal 2, seed/capability baseline: **Approved**.
- Quyết định chờ: PM/Architecture/UX canonical artifact updates trước implementation.
