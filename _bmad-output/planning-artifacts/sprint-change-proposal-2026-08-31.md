---
title: "Sprint Change Proposal - Multi-school school operations platform"
status: proposed
created: 2026-08-31
mode: batch
change-scope: major
supersedes-intent:
  - prds/prd-anhhoa-2026-08-18/prd.md
  - prds/prd-anhhoa-parent-pwa-2026-08-22/prd.md
  - epics.md
  - epics-parent-pwa.md
  - architecture/architecture-anhhoa-2026-08-18/ARCHITECTURE-SPINE.md
  - architecture/architecture-anhhoa-parent-pwa-2026-08-22/ARCHITECTURE-SPINE.md
  - ux-designs/ux-anhhoa-2026-08-18/EXPERIENCE.md
  - ux-designs/ux-anhhoa-parent-pwa-2026-08-22/EXPERIENCE.md
inputs:
  - ../../docs/kidsonline-feature-catalog.md
  - ../../docs/receivables-clean-break-blueprint.md
  - ../../docs/roster-and-people-catalog.md
  - ../../docs/school-settings-catalog.md
  - ../../docs/multi-school-tenancy-catalog.md
---

# Sprint Change Proposal: Nền Tảng Vận Hành Đa Trường

## 1. Tóm tắt vấn đề

### Trigger

Không có một story lỗi đơn lẻ. Thay đổi xuất phát từ discovery trực tiếp Kidsonline, sau khi các Epic 1-7 của Admin MVP/Parent PWA đã được hoàn thành trong sprint status. Quan sát tài chính, danh bộ, cấu hình và màn chọn trường cho thấy product target thực tế rộng hơn và có data boundary khác hẳn MVP cũ.

### Vấn đề cốt lõi

Các artifact hiện tại định nghĩa một dashboard thu học phí cho **một trường**, với một `Admin` toàn quyền, một `InvoiceTemplate` singleton và invoice tháng chỉ được xác nhận thu đủ. Hướng sản phẩm đã chốt cần:

- Nhiều trường độc lập dữ liệu; một `UserIdentity` có membership và role khác nhau ở từng trường.
- PassionEdu là platform chung; Ánh Hoa là một `School` tenant. `app.passionedu.org` cho Admin/Staff, `parent.passionedu.org` cho Parent PWA, `ops.passionedu.org` cho Platform Operations và `api.passionedu.org` cho API; không dùng domain per-school ở release đầu.
- Danh bộ có năm học, enrollment và Staff assignment/role theo trường.
- Tài chính theo danh mục khoản thu, đợt thu, invoice obligation và ledger receipt/allocation/nộp trước/debt.
- Attendance, handover và late pickup phát triển sau foundation, không phải vá vào invoice monthly cũ.

Đây là requirement mới/strategic pivot có chủ đích, không phải bug implementation. Dữ liệu hiện có chỉ là seed; vì vậy clean-break được chấp nhận và an toàn hơn migration compatibility giả tạo.

### Bằng chứng

- Kidsonline `chosen-schools` hiển thị bốn trường cùng khả dụng cho một tài khoản, với school context trong route `/v4/school/:schoolId/...`.
- Màn finance có catalog khoản thu, nhóm, unit, đợt thu, preview matrix, discount, prepayment và debt signals; chúng không biểu diễn được bởi template singleton + `COMPLETED` invoice.
- Màn roster có school year, lifecycle theo enrollment, Parent directory, Staff nhiều role/nhiều lớp.
- Những quan sát và model đích được ghi ở năm discovery proposal trong front matter của tài liệu này.

## 2. Phạm vi quyết định đã chốt

1. `School` là tenant root. Các trường độc lập; Ánh Hoa là tenant đầu tiên. Không tạo `Organization`/holding hierarchy cho release đầu.
2. `UserIdentity` là identity Google canonical toàn platform, gồm email normalized, Google subject, display name/avatar tối thiểu và status, không có `schoolId`, role hay profile nghiệp vụ. Quyền nội bộ là `SchoolMembership` + `SchoolRoleGrant`, không phải `Admin` global. `ParentProfile` và Staff profile là persona riêng; callback, cookie, CSRF scope, session audience và guard của Parent/Admin-Staff/Ops vẫn tách biệt.
3. Mỗi request business buộc có school context từ route. Server kiểm membership/link active; hostname, header, local storage và UUID không phải bằng chứng authorization.
4. Admin/Staff dùng `app.passionedu.org`; Parent dùng PWA riêng `parent.passionedu.org`; Platform Operations dùng `ops.passionedu.org`; API dùng `api.passionedu.org`. Cookie host-only theo portal. Không dùng cookie `.passionedu.org` chia sẻ mặc định.
5. Parent có thể thuộc nhiều trường qua các `StudentParent` link active, và chỉ thấy mỗi school context được ủy quyền.
6. Không dùng subdomain/domain riêng theo trường ở release đầu. Có thể thêm sau như branding/entry point map sang school context, không thay authorization.
7. Platform Operations có capability hẹp để provision/suspend tenant và bootstrap owner, không có quyền dữ liệu trường mặc định. Support access JIT/impersonation không nằm release đầu.
8. Các schema/module/UI single-school invoice cũ bị thay thế, không chạy song song. Seed/dev/test database được reset theo schema đích.
9. `SUPERADMIN_EMAIL` bootstrap `PlatformOperatorGrant` cho một `UserIdentity` qua environment; provisioning nhận email `SCHOOL_ADMIN` đầu tiên, tạo/tìm UserIdentity pending theo email rồi bind Google subject khi họ login Google, không dùng password mặc định. `ops.passionedu.org` dùng session audience `ops` và `PlatformOperatorGrant` để authorize; không tạo `OpsUser`/operational profile global, và grant không cấp quyền School. School không xóa, chỉ suspend/reactivate.
10. Release đầu dùng role preset `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`; `ATTENDANCE_RECORDER` và `HANDOVER_RECORDER` chỉ có capability khi domain tương ứng được phát hành. Không sao chép 335 quyền Kidsonline hoặc xây permission-checkbox UI ban đầu.
11. Release đầu server tự sinh `studentCode` theo prefix của School và sequence unique trong trường, ví dụ Ánh Hoa `AH1`, `AH2`. Manual/import code là extension sau có validation/audit, không phải UI release đầu.
12. Student lifecycle dùng đủ bảy trạng thái Kidsonline trên `StudentEnrollment` của từng SchoolYear: `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`. Chỉ `ENROLLED` mặc định vào attendance/collection run; `TRIAL` là workflow ngoại lệ có audit khi được phát hành.
13. School Admin có thể tạo Parent/link bằng email, tên và số điện thoại bắt buộc trước Google login. Số điện thoại là contact vận hành; Parent được tự sửa số của mình với audit, không đổi identity/quyền và chưa cần SMS verification. StudentParent active mặc định cấp Parent portal, obligations và payment instructions; relationship label không quyết định quyền. Parent có một trường đi thẳng home, nhiều trường thì chooser; revoke hiệu lực request tiếp theo, không gửi notification release đầu.
14. `ParentProfile` là global, không có `schoolId`; school context của Parent chỉ suy ra từ `StudentParent -> Student`. Parent không xem ledger chi tiết và không có mutation finance/school data. Ngoại lệ release đầu là leave request cho trẻ được ủy quyền theo policy ở mục 25. Khi enrollment `ON_LEAVE`/`WITHDRAWN`/`GRADUATED`, dữ liệu vận hành/nhạy cảm chỉ còn xem 30 ngày lịch từ `StudentEnrollment.endedOn`, nhưng invoice issued, payment instruction, receipt/refund và settlement vẫn xem khi còn balance/nộp trước/refund chưa quyết toán; `ParentAccessPolicy` của School áp dụng retention finance riêng server-side sau settlement.
15. Staff profile release đầu gồm họ tên, email, điện thoại, ngày sinh, giới tính và địa chỉ; không có HR/payroll/password. Staff class assignment là many-to-many có effective dates/audit, không phân giáo viên chính/phụ.
16. Mỗi School có tối đa một `SchoolYear` active do `SCHOOL_ADMIN` quản lý. Calendar và attendance/late-pickup policy mặc định chung toàn trường, phù hợp release đầu cho mầm non; nếu sau này có nhu cầu thật theo lớp/chương trình thì bổ sung override domain với effective date/precedence, không dùng adjustment thủ công. Class là cohort theo SchoolYear, nên wizard chuyển năm có thể map một phần trẻ từ lớp nguồn `3-4 tuổi` sang lớp đích mới `4-6 tuổi` và giữ/move các trẻ khác theo lựa chọn. Close-year đóng SchoolYear/kết thúc class assignment nhưng giữ enrollment lịch sử `ENROLLED`; wizard tạo enrollment mới `ENROLLED` khi gán lớp đích. `GRADUATED` chỉ dành cho trẻ thực sự hoàn thành/chuyển cấp rời trường.
17. Khi tạo hóa đơn mới trong cùng SchoolYear, server gộp từng nợ mở của học sinh thành dòng `PRIOR_DEBT` có origin invoice rõ ràng và `DebtTransfer` nguyên tử để loại số tiền đó khỏi outstanding invoice nguồn, tránh thu/đếm hai lần. Không auto-carryover công nợ sang SchoolYear mới; School Admin quyết toán bằng thu, adjustment hoặc write-off có lý do/audit.
18. Nộp trước là record gắn cố định một học sinh, có thể nhắm khoản/đợt thu và chỉ dùng cho hóa đơn tương lai của học sinh đó; không có credit balance hoặc chuyển nhượng. Khi trẻ nghỉ trước lúc áp dụng, School Admin hoặc Finance Manager hoàn tiền qua reversal/refund có audit.
19. Một School có nhiều tài khoản nhận tiền. CollectionRun batch chỉ tạo invoice `DRAFT`; Finance Manager rà soát/điều chỉnh từng invoice và bắt buộc chọn tài khoản active riêng khi issue, sau đó invoice/payment instruction snapshot tài khoản và transfer content mặc định `studentCode + className`.
20. Mỗi School cấu hình reversal trực tiếp hoặc approval hai bước. `DIRECT` cho School Admin/Finance Manager post reversal có lý do; `SCHOOL_ADMIN_APPROVAL` yêu cầu Finance Manager tạo yêu cầu, School Admin khác actor duyệt trước khi post.
21. Finance release đầu hỗ trợ CollectionRun `MONTHLY`, `ANNUAL` và `ONE_OFF`, bắt buộc có `schoolId` và `schoolYearId`. `MONTHLY` dùng `billingMonth` chuẩn `YYYY-MM`; `periodKey` là text kế toán nhập chỉ cho `ANNUAL`/`ONE_OFF`. Các giá trị này không unique, nên một năm học có thể có run chuẩn và run bổ sung cùng kỳ. School tự định nghĩa nhóm/khoản thu, đơn vị, giá, hoàn trả và rule áp dụng; mã khoản thu tùy chọn, unique khi có. ChargeRule chỉ có `FIXED` hoặc `MANUAL`; meal deduction là adjustment âm riêng từ đơn nghỉ, còn attendance/handover/service enrollment chỉ là dữ liệu để Finance tham chiếu khi nhập dòng `MANUAL`. PassionEdu không define sẵn behavior cho `Cơ sở vật chất`: School có thể tự tạo khoản này với unit `năm theo ngày nhập học`; Finance Manager điều chỉnh giá thực thu hoặc thêm adjustment trên invoice `DRAFT` có ghi chú/audit cho case nhập học giữa năm.
22. CollectionRun `GENERATED` giữ rule/phạm vi batch gốc bất biến nhưng cho Finance Manager/SCHOOL_ADMIN thêm một học sinh chưa có invoice vào run, tạo duy nhất invoice `DRAFT` từ snapshot rule. Không có hai invoice cho cùng học sinh/run; hóa đơn đã issue cần run bổ sung cho khoản mới.
23. Tiền ăn tháng giảm trừ trực tiếp bằng adjustment âm trên invoice `DRAFT` kế tiếp từ đơn nghỉ có phép: School cấu hình deadline, đơn trước deadline tự duyệt, Finance Manager/SCHOOL_ADMIN duyệt sau deadline và API tự bỏ ngày nghỉ/lễ; `PRESENT` xác nhận loại ngày trùng khỏi đề xuất. Nghỉ dài hạn/hủy dịch vụ được duyệt là nguồn refund, còn adjustment thủ công vẫn có ghi chú/audit. School hỗ trợ mọi `StudentServiceEnrollment` theo effective dates; học thứ bảy chỉ là một dịch vụ. Học lẻ thứ bảy và phí muộn là dòng `MANUAL` do Finance nhập trong `DRAFT` khi tham chiếu attendance/handover, không charge trùng ngày đã được gói dịch vụ bao phủ. Xe đưa đón deferred.
24. ChargeRule chỉ có quantity `FIXED` hoặc `MANUAL`. Finance Manager/SCHOOL_ADMIN nhập/override quantity, giá hoặc adjustment trong invoice `DRAFT` với ghi chú/audit; attendance, handover và service enrollment chỉ là reference snapshot còn giữ, không là engine tính số lượng. Giáo viên lớp hoặc lễ tân được phân công ghi attendance/xác nhận trả trẻ. Staff profile không cấp login: chỉ UserIdentity có SchoolMembership/role active truy cập portal. Import dữ liệu lịch sử vận hành deferred thành onboarding workstream riêng sau core.
25. Parent chỉ mutation leave request cho trẻ được ủy quyền: School cấu hình deadline, trước deadline là `AUTO_APPROVED`, sau deadline cần School Admin/Finance Manager duyệt; API tự bỏ ngày nghỉ/lễ. School cấu hình `AttendancePolicy.photoEvidenceMode`: `REQUIRED` buộc giáo viên/lễ tân chụp/upload ảnh trước `PRESENT`, `OPTIONAL` cho phép không ảnh; Parent chỉ nhận notification event, không xem evidence ảnh release đầu. Không xác nhận attendance ngày nghỉ/lễ. `PRESENT` trên ngày có leave request đánh dấu conflict và loại ngày đó khỏi meal adjustment đề xuất. Học thứ bảy là một dịch vụ; Finance chỉ nhập học lẻ `MANUAL` khi tham chiếu attendance và không charge ngày đã được gói dịch vụ bao phủ. Giáo viên/lễ tân xác nhận giờ trả trẻ thực tế. Late pickup dùng `pickedUpAt` và School LatePickupPolicy cutoff/grace/block làm reference cho Finance nhập dòng `MANUAL` trong `DRAFT`; API không tự tính fee.
26. Parent hoặc School Admin có thể tạo nghỉ dài hạn; chỉ School Admin duyệt/từ chối và xác nhận/chọn effective date không trước ngày yêu cầu. Sau approval, API dừng charge future CollectionRun; invoice đã issue dùng adjustment/refund có source. Hủy dịch vụ và tạo/hủy `StudentServiceEnrollment` là thao tác School Admin/Finance Manager theo thông báo/yêu cầu Parent, có effective dates/audit; Parent không tự hủy dịch vụ.

## 3. Impact analysis

### 3.1 Epics và sprint hiện tại

| Artifact hiện có | Trạng thái hiện tại | Tác động | Quyết định |
| --- | --- | --- | --- |
| Epic 1: truy cập Admin | done | `ADMIN_EMAILS` và `Admin` global không còn hợp lệ | Supersede; giữ Google OAuth/cookie/CSRF pattern nhưng đổi sang UserIdentity + membership + chooser |
| Epic 2: lớp, học sinh, template, bank account | done | Class/Student thiếu tenant, school year/enrollment; template singleton bị loại | Supersede; rebuild roster/settings/receivables scoped theo school |
| Epic 3: monthly invoice | done | unique theo tháng, lifecycle và completion không có receipt/allocation/nộp trước/debt | Supersede bằng collection run + finance ledger |
| Epic 4: monthly report | done | aggregate `COMPLETED` không đúng với partial payment/nộp trước/void | Supersede bằng ledger/report projection |
| Epic 5: Parent links | in-progress nhưng stories done | Quan hệ nhiều-nhiều giữ lại; ParentProfile global bind UserIdentity, school context qua StudentParent/Student | Rebuild cùng UserIdentity/School/Parent design |
| Epic 6: Parent read PWA | done | route/filter/payment state đang dựa invoice old và không có school chooser | Supersede bằng Parent multi-school read model |
| Epic 7: Parent transfer guidance | done | snapshot-only instruction giữ nguyên principle nhưng phải đọc invoice settlement mới | Rebuild sau finance ledger |

Không rollback git history hoặc xóa các commit đã hoàn thành. Code hiện có là reference/testbed; không được coi là baseline production cho schema mới. `sprint-status.yaml` không đổi trước khi proposal được phê duyệt và epics replacement được tạo.

### 3.2 Xung đột PRD

| PRD/source cũ | OLD | NEW | Lý do |
| --- | --- | --- | --- |
| Admin PRD §§1, 2.2, 4.1 | Một dashboard duy nhất, Admin global qua allowlist, không có Staff/Parent | Platform multi-school; UserIdentity global, membership/role per-school; Admin/Staff và Parent là surface riêng | Cần tenant isolation và quyền khác nhau theo trường |
| Admin PRD §§2, 4.2 | Lớp có học phí tháng; Student có class/status hiện tại | SchoolYear, Student, StudentEnrollment, class scoped school, parent links và staff assignment | Lịch sử và lifecycle phải thuộc năm học |
| Admin PRD §4.3 | Một Mẫu hóa đơn chung | ReceivableGroup, Receivable, DiscountPolicy, CollectionRun và ChargeRule | Catalog/rule/run mới biểu diễn được khoản, unit và phạm vi áp dụng |
| Admin PRD §§4.4-4.6 | Một invoice/student/month, `DRAFT -> PENDING -> COMPLETED`, report chỉ `COMPLETED` | Invoice per student/collection run; `DRAFT`, `ISSUED`, derived `PARTIALLY_PAID`/`PAID`, `VOIDED`; receipt/allocation/nộp trước/debt ledger | Hỗ trợ partial, prepayment theo học sinh, nợ cũ gộp trong năm, quyết toán năm, void/reversal và đối soát đúng |
| Parent PRD §§1, 4 | Parent xem invoice PENDING/COMPLETED single-school | Parent chọn school nếu có active links; xem obligations/payment state thuộc school context | Ngăn leak tenant và hỗ trợ con ở nhiều trường |
| Parent PRD §5 | Subdomain Parent tách Admin chưa chốt host | Chốt `parent.passionedu.org`, `app.passionedu.org`, `api.passionedu.org`, host-only session | PassionEdu là platform chung; Ánh Hoa là một tenant |

### 3.3 Xung đột architecture

| Architecture cũ | OLD | NEW |
| --- | --- | --- |
| AD-3/AD-4 | `auth`, `admins`; Google allowlist `ADMIN_EMAILS`; session `sub=admin.id` | `identity`, `schools`, `memberships`, `authorization`; session `sub=user.id`; membership resolved per request |
| AD-5 | Paths unscoped `/classes`, `/students`, `/invoices` | `/schools/:schoolId/...` for all operational resources; Parent routes scope school explicitly or derive/validate it from active Parent school selection |
| AD-7 | unique `(studentId, billingMonth)` and `PENDING -> COMPLETED` | unique `(schoolId, studentId, collectionRunId)`; immutable issued obligation plus append-only payment/prepayment ledger |
| AD-8 | Class, Student, BankAccount retained but tenantless | Every aggregate has `schoolId`; ownership, foreign keys, unique constraints and queries must be tenant scoped |
| AD-9 | Operation scope Admin + route + key | Operation scope school + actor membership + route + key; audit records UserIdentity and membership |
| Parent AD-13 to AD-18 | Parent identity separate from Admin/Staff; parent invoice lifecycle old | UserIdentity can be cross-persona; Parent authorization is `StudentParent` scoped to school; portal reads new finance read model |

Stack and high-level modular-monolith direction remain valid: pnpm/Turborepo, React/Vite PWA, NestJS, Prisma, PostgreSQL, REST, Google OAuth, VND `BIGINT`, API-owned calculations, CSRF, origin validation, idempotency, immutable snapshots and audit.

### 3.4 Xung đột UX/IA

| UX cũ | OLD | NEW |
| --- | --- | --- |
| Admin Foundation/IA | Một workspace; all Admin surfaces granted | Login -> choose school (if multiple) -> school-scoped shell with switcher and permission-aware navigation; Platform Operations có portal/IA tách biệt |
| Admin sidebar | Học sinh, Lớp, Mẫu hóa đơn, Tài khoản, Báo cáo | Tổng quan, Danh bộ, Nhân viên, Khoản thu, Đợt thu, Thu tiền & đóng trước, Công nợ, Báo cáo, Cấu hình trường; show only capability-authorized surfaces |
| Invoice flows | Monthly batch modal and completion confirmation | Collection-run wizard: configure -> scope -> server matrix preview gồm nợ cũ -> generate `DRAFT`; Finance Manager rà soát/điều chỉnh -> chọn tài khoản riêng -> issue; receipt/allocation/prepayment wizard; debt view |
| Parent IA | No school selection | School chooser/switcher before child/invoice views when Parent has active children in multiple schools |
| Parent payment | `PENDING` payment snapshot | Issued/outstanding obligation payment instruction; Parent never posts receipt or confirms settlement |

Accessibility and state constraints persist: one `h1` per route, text status, accessible dialogs, no data leak during revalidation, explicit server reconciliation after uncertain idempotent mutation. School switch must not discard a pending mutation/form silently.

### 3.5 Secondary artifacts

- `apps/api/prisma/schema.prisma`, seed, module layout, API contracts and tests require a new target schema.
- `apps/web`, `apps/parent-web` router, API clients, app shells and query-key conventions require school context.
- Environment config requires separate origins/callbacks/cookie names for Admin/Staff, Parent and Platform Operations portals; no secrets in DB/UI.
- Existing Playwright/integration tests become regression references only. New cross-tenant isolation tests are release blockers.
- Production migration/import is explicitly out of scope for this clean-break release. Before real operational data exists, reset dev/test data. When operational import is needed after core launch, create a separate onboarding/migration plan rather than adding ad hoc CSV flows.

## 4. Path forward evaluation

| Option | Assessment | Effort | Risk | Decision |
| --- | --- | --- | --- | --- |
| Direct adjustment of current stories | Would require dual models, tenant retrofit and ambiguous lifecycle compatibility | High | High | Not viable |
| Roll back commits/code | Removes useful working reference but does not solve product/design decisions | Medium | Medium | Not selected |
| Keep old MVP and defer new target | Fastest locally, but locks incorrect single-school and finance assumptions into data/API | Medium now, high later | High | Not selected |
| Hybrid clean-break in same repository | Preserve platform/tooling/security patterns; supersede domain/schema/UI and reset seed | High | Medium, controlled | **Selected** |

### Recommended approach

Use a **major clean-break replan in the existing repository**. Do not create a new repository; do not maintain an old/new finance compatibility layer. First produce new PRD, architecture spine, UX specification and epics. Then replace the schema and implementation in dependency order.

This is the lowest long-term-risk option because the main mismatch is business domain, not the technical platform. It avoids repeating OAuth/PWA/API infrastructure while preventing old identifiers/lifecycles from contaminating production data.

## 5. Detailed replacement proposal

### 5.1 New PRD set

Replace the two old PRDs as active sources with a new initiative-level PRD split into these traceable releases:

1. **Platform multi-school, identity and authorization**
   - PassionEdu platform, School tenant, UserIdentity, membership, role grants, chooser, switcher, Admin/Staff portal and narrow Platform Operations provisioning.
   - Parent portal domain/cookie decision and Parent school selection.
2. **School profile, calendar, roster and operational roles**
   - SchoolYear, Class, Student, StudentEnrollment, Parent links/permissions, Staff profile/assignment.
   - Typed/versioned school, finance and parent-access settings.
3. **Finance ledger**
   - Receivable catalog, discount, collection run, preview/generate, invoice obligation, receipt, allocation, student prepayment, prior-debt grouping, year-end settlement, reversal policy, debt and reports.
4. **Attendance, leave, service registration, handover and late pickup**
   - Attendance/leave approval, service registration and teacher/lễ tân-recorded handover; leave creates meal adjustments, while Finance references operating data for `MANUAL` lines. Money calculations remain API-owned.

The current discovery does not justify implementation of communications beyond attendance-event notification, albums, medical data, meal/daily journal, transport, custom school domains, organization hierarchy, shared catalogs, bank sync, tax invoices or SaaS control plane. Keep them deferred. Meal billing, leave requests, configurable-photo attendance, Saturday service registration and handover are in scope; meal/daily journal is not. Attendance evidence is retained two months and Staff/Admin-scoped.

### 5.2 New epic sequence

| New epic | Outcome | Depends on |
| --- | --- | --- |
| E1. PassionEdu identity, access and control plane | UserIdentity login, `SUPERADMIN_EMAIL` bootstrap, School, pending owner membership by email, role grant, school chooser/switcher, tenant guard, Ops audience/PlatformOperatorGrant authorization without OpsUser table, Platform Operations provisioning, cross-tenant tests | none |
| E2. School foundation and roster | School profile/calendar chung, SchoolYear một active với close-year/transition batch, Class, Student với `studentCode` server-generated, Enrollment lifecycle bảy trạng thái, Parent identity/link/default permissions/history-retention policy, Staff profile/assignment | E1 |
| E3. Finance configuration | Bank accounts, finance policy, receivable groups/catalog, discounts | E1, E2 |
| E4. Attendance, leave, service registration and handover | School-configurable attendance photo evidence with two-month Staff/Admin-scoped access and Parent event notification; teacher/lễ tân attendance and handover; School-defined leave deadline, calendar exclusion/conflict handling, and generic service enrollment | E1, E2 |
| E5. Collection runs and invoice obligations | `MONTHLY`/`ANNUAL`/`ONE_OFF` charge rules with `FIXED`/`MANUAL` quantity, ready/preview/generate `DRAFT`, meal adjustment proposals, Finance reference/audit for service/attendance/handover data, add an eligible student after batch generation, per-invoice review/override/bank selection/issue, snapshots, issue/void rules | E2, E3, E4 |
| E6. Receipts, prepayments, debt and reporting | Receipt post/void, allocations, student prepayment/refund, prior-debt grouping, year-end settlement, finance reports | E5 |
| E7. Parent multi-school finance portal | Parent login/chooser, authorized obligations, payment instructions, history | E1, E2, E6 |

Do not begin E3-E7 before E1 has proven route-level tenant isolation. Do not begin E4 before SchoolYear/enrollment semantics are in E2. Do not begin E5 before E4 has defined the leave adjustment inputs and reference data for Finance review.

### 5.3 Mandatory architecture acceptance criteria

- Same UserIdentity can hold different roles at schools A/B; every API call authorizes the selected school membership/capability.
- Data from A is inaccessible through route, UUID, filter, mutation or report query under a valid B membership.
- Revoking A membership affects the next A request but preserves B access.
- Every business table/query/unique/index/audit/operation is school scoped.
- Parent can only select schools for active authorized links; a Parent school A route cannot expose school B children/finance.
- Platform operator can provision/suspend School and bootstrap owner membership, but cannot read school business data without separately authorized support access.
- `SUPERADMIN_EMAIL` bootstrap only grants platform capability; it cannot access School data without a SchoolMembership. School suspension denies the next business request without needing global session revocation in release one.
- Receipt/allocation/prepayment state derives invoice settlement; no client may set total, paid amount, outstanding, QR amount or status.
- Policy and source snapshots preserve historical finance/attendance meaning.
- High-impact mutations reconcile by school-scoped idempotency operation after timeout.

### 5.4 Replacement implementation boundary

**Remove/replace:** `Admin`, `InvoiceTemplate`, `InvoiceTemplateItem`, global `Class`/`Student`, old invoice unique/lifecycle, `/invoice-template`, old batch endpoint, completion-only reports and their old UI surfaces.

**Keep principles, not old schema:** Google OAuth, isolated Parent PWA, REST, API-only money/QR/authorization, VND `BIGINT`, PostgreSQL transactions, snapshot/audit, origin validation, CSRF, idempotency and operation reconciliation.

## 6. Implementation handoff

### Classification

**Major: fundamental replan required.**

### Responsibilities

| Role | Deliverable |
| --- | --- |
| Product Manager | New PassionEdu initiative PRD with release boundaries, platform versus school role/capability matrix, `SUPERADMIN_EMAIL` bootstrap/provisioning behavior, finance policy decisions and open-question resolution |
| Solution Architect | New architecture spine: tenant and control-plane model, pending owner identity binding, authorization request context, schema ownership, portal/cookie topology, lifecycle/ledger invariants, API conventions and verification matrix |
| UX Designer | Platform Operations provisioning UI; Admin/Staff chooser and scoped shell; finance run/receipt/debt flows; Parent school chooser and finance read flows; permission/empty/revoked states |
| Developer | Only after new artifacts are final: target Prisma schema/seed, scoped guard/API, rebuild modules and UI in epic order, tests from acceptance criteria |
| QA | Tenant-isolation, authorization/revoke, ledger/concurrency/idempotency and Parent cross-school E2E coverage |

### Handoff order

1. Product Manager and Solution Architect create superseding PRD and architecture spine from this proposal and the discovery documents.
2. UX Designer creates superseding Admin/Staff and Parent experience spines from the new contracts.
3. Product Manager creates replacement epics/stories and refreshes sprint status, marking E1 backlog.
4. Developer performs the clean-break implementation only after the above are approved.

## 7. Checklist record

| Checklist item | Status | Finding |
| --- | --- | --- |
| 1.1 Trigger | Done | Discovery of Kidsonline finance/roster/settings/multi-school, not a single faulty story |
| 1.2 Core problem | Done | Original single-school invoice MVP no longer matches target product/domain |
| 1.3 Evidence | Done | Direct read-only UI observations plus five discovery documents |
| 2.1-2.5 Epic impact | Done | All existing epics superseded; new order starts multi-school authorization |
| 3.1 PRD conflict | Done | Scope/lifecycle/roles/tenant assumptions conflict |
| 3.2 Architecture conflict | Done | Identity, schema ownership, routes, operation scope and finance model conflict |
| 3.3 UX conflict | Done | Single workspace and invoice-first IA conflict |
| 3.4 Secondary impact | Done | Schema, seed, tests, origins/cookies and route clients affected |
| 4.1 Direct adjustment | Done, not viable | Would preserve incompatible dual models |
| 4.2 Rollback | Done, not selected | Code is useful reference; git history remains |
| 4.3 MVP review | Done | MVP must be redefined as foundation-first releases |
| 4.4 Recommended path | Done | Same repo, clean-break domain replan |
| 5.1-5.5 Proposal/handoff | Done | This document defines scope, impacts, approach and owners |
| 6.1-6.2 Review | Done | Proposal checked against current PRD, epics, architecture, UX and discovery inputs |
| 6.3 Approval | Action-needed | User approval required before artifact or code replacement |
| 6.4 Sprint status | Action-needed | Update only after approval and replacement epics exist |
| 6.5 Final handoff | Action-needed | Starts upon approval |

## 8. Approval request

Approve this proposal to authorize creation of superseding PRD, architecture, UX and epics. Approval does **not** authorize modifying the frozen `final` artifacts directly and does not yet authorize schema/code implementation; those begin after replacement planning artifacts are approved.
