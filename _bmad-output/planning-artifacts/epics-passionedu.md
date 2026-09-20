---
stepsCompleted:
  - step-01-validate-prerequisites
  - step-02-design-epics
  - step-03-create-stories
  - step-04-final-validation
inputDocuments:
  - prds/prd-passionedu-2026-09-04/prd.md
  - architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - ../specs/spec-passionedu/SPEC.md
  - ux-designs/ux-passionedu-2026-09-04/DESIGN.md
  - ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md
supersedes:
  - epics.md
  - epics-parent-pwa.md
status: final
updated: 2026-09-16
---

# PassionEdu - Epic Breakdown

## Overview

Tai lieu nay phan ra initiative PassionEdu da truong thanh cac epic va story co the trien khai. PRD PassionEdu, Architecture Spine, SPEC va UX spines la nguon quyet dinh. Hai artifact epic Anh Hoa legacy duoc giu nguyen de truy vet va khong mo ta pham vi thay the nay.

## UX and Mockup Traceability

Khi implement mot story co bề mặt portal, `DESIGN.md` va `EXPERIENCE.md` la UX contract bat buoc; mockup duoi day la mốc visual/interaction de giam lech implementation. Neu mockup mau thuan voi hai UX spine, UX spine thang. `MOCKUP-COVERAGE.md` la inventory va diem vao review; mockup HTML la static, khong thay the REST, authorization, state transition, money hay Operation contract cua API.

| Stories | UX/mocking reference | Implementation boundary |
| --- | --- | --- |
| 1.1 | `mockups/review.html`, `MOCKUP-COVERAGE.md` | Scaffold shell cua bon portal theo inventory; khong tai su dung shell legacy. |
| 1.2, 1.4, 1.6 | `EXPERIENCE.md` §§ Information Architecture, State Patterns, Accessibility Floor; `mockups/admin/admin-operational-queue.html`, `mockups/teacher/teacher.html`, `mockups/parent/parent.html`, `mockups/ops/ops.html` | Session, switch/revoke va capability van do API quyet dinh; mockup chi dinh nghia safe state va visible context. |
| 1.3 | `mockups/ops/ops.html` | Ops chi provision/suspend/reactivate, khong co School business-data destination. |
| 1.5 | `EXPERIENCE.md` §§ State Patterns, Interaction Primitives | Story API/security; chi implement cac error/reconciliation state khi endpoint da co. |
| 2.1 | `mockups/admin/roster/school-year-classes.html`, `mockups/admin/roster/roster.html` | Table, error summary, visible School/SchoolYear context. |
| 2.2 | `mockups/admin/roster/student-enrollment.html`, `mockups/admin/roster/roster.html` | Profile/enrollment va history la surfaces tach biet. |
| 2.3 | `mockups/admin/roster/student-parent-links.html`, `mockups/parent/parent.html` | Revoke phai dan toi Parent safe state, khong chi cap nhat row Admin. |
| 2.4 | `mockups/admin/roster/staff-assignments.html` | Tach Staff record, assignment va login/role state. |
| 2.5 | `mockups/admin/roster/roster-transition.html` | Preview -> named confirmation -> Operation reconciliation. |
| 3.1, 3.2, 3.3, 3.4 | `mockups/admin/school-settings.html` | Bon tab Settings; Parent access khong la tab/configuration. |
| 4.1 | `mockups/admin/admin-operational-queue.html`, `mockups/parent/parent.html` | Admin review-only; Parent leave surface chi duoc build trong Epic 7. |
| 4.2, 4.3, 4.4, 4.7 | `mockups/teacher/teacher.html`, `mockups/parent/parent.html` | Teacher la portal mutation duy nhat; Parent khong bao gio nhan evidence/Staff facts. |
| 4.5 | `mockups/admin/receivable-configuration.html`, `mockups/admin/invoice-detail-review.html` | Chi hien server-returned adjustment/refund outcome; khong co auto-fee affordance. |
| 4.6 | `mockups/admin/admin-operational-queue.html` | Tong quan theo School/ngay, table-first va server-returned counts. |
| 5.1 | `mockups/admin/receivable-configuration.html` | Catalog, scope matrix va policy version la UI Finance configuration. |
| 5.2, 5.3, 5.7 | `mockups/admin/invoice-generation.html` | CollectionRun list/detail, server preview/skips va reconciliation; `PREPAID_COVERAGE` khong la run rieng. |
| 5.4, 5.5, 5.6, 5.8 | `mockups/admin/invoice-detail-review.html`, `mockups/parent/parent.html` | Invoice la deep destination; Parent chi thay effective obligation sau khi API projection ton tai. |
| 6.1, 6.2, 6.3, 6.4, 6.6 | `mockups/admin/invoice-detail-review.html`, `EXPERIENCE.md` §§ Invoice review and receipt, Adjustment/carry/refund review | Actual Receipt closes mot Invoice; outcome/carry/refund deu server-returned. |
| 6.5 | `mockups/admin/finance-run-preview.html`, `EXPERIENCE.md` § Finance report | Bon workspace bao cao va CSV la server ledger-derived; mockup mốc nay khong mo rong lifecycle Finance. |
| 7.1, 7.2, 7.4, 7.5, 7.7, 7.8 | `mockups/parent/parent.html`, `mockups/parent/parent-home.html` | Mobile-first, clear protected state truoc safe fallback, khong cache protected API data. |
| 7.3 | `mockups/parent/parent-inbox.html` | Inbox deep link phai re-authorize School/Student/date. |
| 7.6 | `mockups/parent/parent.html`, `EXPERIENCE.md` § Payment instruction | Read-only effective Invoice; khong hien correction/ledger provenance hay payment mutation. |
| 8.1, 8.2, 8.3 | `mockups/admin/payroll-overview.html` | Navigation/deep link chi xuat hien sau entitlement va capability server grant. |
| 9.1, 9.2, 9.3 | `mockups/admin/payroll-timekeeping-import.html` | Import -> preview -> commit -> review; khong suy dien tien tu handover. |
| 10.1, 10.2, 10.3 | `mockups/admin/payroll-run-review.html` | Snapshot, different-identity approval, reopen va payout la server-confirmed states. |
| 11.1, 11.2 | `mockups/admin/payroll-correction.html` | Paid source read-only; correction/ky luong rieng theo approval/payout boundary. |

**Story delivery rule:** Implementation spec tao cho mot story phai copy cac link o bang nay vao phan `context`, ghi ro mockup route/state dang build, va them visual/E2E assertion cho loading, validation, revoke/permission-denied, timeout reconciliation va responsive behavior neu story co portal surface. Story API-only khong duoc tao UI local/optimistic thay cho server contract.

## Requirements Inventory

### Functional Requirements

FR-1: Platform Operator provision, suspend/reactivate School va bootstrap School Admin dau tien theo email, khong co quyen du lieu nghiep vu mac dinh.

FR-2: Identity co the co membership/role khac nhau o nhieu School; Admin/Staff chon School qua chooser/switcher va server cap quyen theo membership/capability active cho moi request.

FR-3: Moi aggregate, query, unique constraint, audit va Operation nghiep vu deu School-scoped, khong the truy cap cheo tenant qua URL, UUID, filter, header hay client state.

FR-4: School Admin quan ly School profile, calendar va typed, versioned finance/Parent/attendance/handover policies theo effective date, audit va ly do khi can.

FR-5: School Admin quan ly mot SchoolYear active, Class, Student va StudentEnrollment lifecycle; chuyen lop/chuyen nam/close-year bao toan lich su enrollment, snapshot va audit.

FR-6: School Admin quan ly Parent-Hoc sinh link active/revoked, Parent pending binding va Staff profile/assignment effective-dated ma khong tu cap Staff login hay role.

FR-7: Finance Manager hoac School Admin quan ly receivable catalog, ChargeRule va PromotionPolicy co version scoped theo School, co precedence, effective period, stacking va immutable historical snapshot.

FR-8: Finance Manager tao CollectionRun, xem server-authoritative preview va generate Invoice DRAFT idempotent theo lifecycle va eligibility/skip policy.

FR-9: Finance Manager issue Invoice DRAFT voi audited override/adjustment, active BankAccount va immutable obligation/Payment instruction snapshot; server so huu VND total, outstanding va settlement state.

FR-10: Finance Manager ghi actual Receipt de dong mot Invoice, tao carry shortfall/overpayment co provenance sang dot thang sau, va chi issue `PREPAID_COVERAGE` sau Invoice dong `EXACT`; sua sai bang revision/cancellation hoac append-only reversal/refund co policy approval, reason, audit va idempotency.

FR-11: He thong gop prior debt trong cung SchoolYear mot cach truy vet, settlement year-end va bon workspace bao cao ledger `asOf` theo gross, promotion discount/refund, actual receipt, SettlementDifference/carry, revision/cancellation, coverage va outstanding; Finance Manager/School Admin export CSV server-authorized cua dung result.

FR-12: Parent gui leave request cho Student duoc uy quyen; Teacher co capability ghi attendance, handover va DailyJournal trong Class duoc phan cong; Admin/Finance quan ly service enrollment; Finance chi tao meal adjustment source-linked, khong tu dong tinh fee.

FR-13: Authorized Staff ghi handover picked-up time theo policy lam operational reference co audit, khong tu dong tao late-pickup fee hoac pickup authorization.

FR-14: Platform Operations cap Payroll opt-in theo School; tai School enabled, `FINANCE_MANAGER` persona Ke toan va School Admin chi quan ly employment terms, machine-code mapping, file-based timekeeping, reviewed workdays va late-care assignments khi co capability rieng.

FR-15: Finance Manager persona Ke toan prepare/materially edit/reconcile/submit Payroll versioned tu source snapshot/policy typed; School Admin co identity khong tham gia cac action do approve/refuse va reopen unpaid run; Finance Manager co capability rieng xac nhan payout. Payroll tach biet voi Student receivables, co payout/advance/thirteenth-month semantics rieng.

FR-16: Parent dung portal multi-School de xem dung Student duoc active link uy quyen, attendance history DTO toi thieu, DailyJournal/media duoc cap quyen va in-app notification 30 ngay; revoke/session expiry xoa protected state va Parent khong mutate operational data.

FR-17: Parent xem read-only Invoice hieu luc `ISSUED` con outstanding hoac `CLOSED` moi nhat va Payment instruction snapshot khi du dieu kien; Parent khong post Receipt, xac nhan payment, chon uu dai/refund hay sua finance, va khong co VietQR/copy/deep link trong release nay.

### NonFunctional Requirements

NFR-1: API la nguon chan ly cho authorization, policy, money VND integer, snapshots, transitions, report va Parent DTO; bon portal React/Vite chi goi REST va session/audience cach ly.

NFR-2: Cookie-auth mutation dung origin validation va double-submit CSRF; workflow high-impact dung UUID Idempotency-Key va GET Operation reconciliation truoc retry sau timeout.

NFR-3: Child/Parent data dung minimum DTO, server-side authorization, revoke/status thay hard delete, audit va retention; Parent protected response khong service-worker cache.

NFR-4: VND luu PostgreSQL BIGINT va REST safe JSON integer; issued obligation/instruction immutable, finance posting append-only va settlement client khong the set.

NFR-5: Tenant isolation, revoke, concurrency/idempotency ledger va Parent cross-School E2E la release-blocking proof; E1 isolation gate block cac release sau.

NFR-6: P95 read API <= 500 ms; preview/report <= 3 s; generate 1,000 Student <= 60 s va co Operation progress trong fixture acceptance. WCAG 2.1 AA cho ca bon portal.

NFR-7: Pilot dung mot VPS Docker Compose, source build, TLS proxy va PostgreSQL durable volume; secrets ngoai Git, migration deploy truoc API can no, khong destructive rollback. Production controls la gate Spine rieng.

NFR-8: Workspace pnpm/Turborepo dung Node 22, TypeScript, React/Vite, NestJS/Prisma/PostgreSQL; API modular monolith va portal apps khong import nhau/API internals.

### Additional Requirements

- Scaffold clean-break workspace `apps/api`, `apps/web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui` va `deploy/compose`; reset seed/dev/test theo target schema, khong compatibility layer hay migration production.
- API domain modules la `identity`, `schools`, `memberships`, `authorization`, `roster`, `settings`, `finance`, `attendance`, `parents`, `parent-auth`, `parent-portal`, `operations`; controller chi goi owning service va domain export contract hep.
- Payroll modules la `school-features`, `workforce`, `timekeeping`, `payroll`; Payroll khong ghi/read truc tiep aggregate cua nhau ma dung narrow export, va khong tai su dung Student Invoice/Receipt/CollectionRun.
- Staff route dung `/schools/:schoolId/`; Parent route dung `/api/parent/schools/:schoolId/`; mo resolver context va query/write scoped School trong cung transaction, relation dung composite tenant graph khi ho tro.
- Google OAuth bind UserIdentity; audience callbacks, host-only Secure/httpOnly/SameSite=Lax cookie va origin allowlist rieng cho `app`, `parent`, `ops`, `api` hosts. `SUPERADMIN_EMAIL` chi bootstrap PlatformOperatorGrant.
- School suspended bi chan o business request ke tiep; Platform grant khong suy ra School membership; Parent pending email binding atomic va active StudentParent recheck truoc session issue.
- Timezone nghiep vu `Asia/Ho_Chi_Minh`; effective interval `[effectiveFrom, effectiveTo)`; SchoolYear la boundary va Student code server-generated, School-unique, immutable/never reused.
- Finance owns CollectionRun, Invoice, settlement, source snapshot va locking boundary; CollectionRun/Invoice lifecycles, scoped uniqueness, ledger limits, debt transfer atomic va two-step approval phai duoc enforce server-side.
- Attendance owns leave/evidence eligibility; evidence REQUIRED/OPTIONAL, chi Staff capability/Admin xem, blob/preview delete sau hai thang lich. Attendance event idempotent va Parent projection rechecks active StudentParent per Student.
- Parent retention server-side: operational/sensitive data 30 ngay sau enrollment endedOn; issued finance den settlement roi ParentAccessPolicy versioned mac dinh 12 thang. Parent DTO khong chua Staff, internal reason, evidence/media, class list hay profile khac.
- Unit test transition/calculation; PostgreSQL integration test tenant graph/isolation, uniqueness, revoke, transactions, ledger concurrency, idempotency/evidence cleanup; E2E test audience/session, chooser/switcher va Parent cross-School.

### UX Design Requirements

UX-DR1: Implement token system in `DESIGN.md`: calm green/canvas/surface hierarchy, semantic attendance/status colors with text labels, Be Vietnam Pro/Inter typography, spacing, radii and AA focus/contrast pairs.

UX-DR2: Build separate desktop-first Admin/Staff and Ops shells plus mobile-first Parent shell, each with its own session/audience; show selected School visibly and move route focus to the `h1`.

UX-DR3: Build accessible School chooser/switch guard that blocks dirty or uncertain mutation context; offer remain, discard-before-submit or Operation reconciliation, never auto-save.

UX-DR4: Build Ops School list/provision/suspend-reactivate confirmation and reconciliation states without any School business-data destination.

UX-DR5: Build Admin morning operational queue, prefiltered date/class/status destinations and server-authoritative counts; finance is secondary.

UX-DR6: Build typed policy forms, SchoolYear/roster forms and transition wizard with effective date, reason, server preview, confirmation, field error, history and Operation states.

UX-DR7: Build Finance catalog, CollectionRun configure/scope/preview/generate wizard and Invoice issue review showing server calculation version, skips, VND totals, immutable snapshots and lifecycle locks.

UX-DR8: Build settlement, promotion coverage, debt, correction/refund and four report workspaces with immutable source facts, server-returned limits/as-of time/filter/version, authorized CSV export, explicit two-step approval and no client-computed authority.

UX-DR9: Build attendance/handover/service/long-leave flows with required evidence, calendar/leave conflicts, source-linked adjustment outcome and no automatic fee affordance.

UX-DR10: Build Parent Today cards, child date history, leave request and inbox with exact safe copy, `NOT_RECORDED` neutral treatment, authorized re-check deep links and protected-state clearing.

UX-DR11: Build Parent effective-Invoice Payment instruction as read-only snapshot: obligation code, period, issued total, actual receipt/outcome/current outstanding, state/time, receiving bank, account, holder and transfer content; hide payment invitation when no outstanding and never expose correction or ledger provenance.

UX-DR12: Implement shared accessibility state patterns: skeletons without cross-School stale data, focusable error summary, dialog focus trap/return, keyboard tables, 44px Parent targets, text status, responsive table scroll/cards and offline no-queue behavior.

### FR Coverage Map

FR-1: Epic 1 - Platform provision va School lifecycle.

FR-2: Epic 1 - Membership, role va School context.

FR-3: Epic 1 - Tenant isolation va provenance.

FR-4: Epic 3 - Typed/versioned School policy governance.

FR-5: Epic 2 - SchoolYear, Class va StudentEnrollment co lich su.

FR-6: Epic 2 - Parent/Staff record va effective-dated assignment.

FR-7: Epic 5 - Finance catalog, discount va ChargeRule truoc khi tao nghia vu.

FR-8: Epic 5 - CollectionRun preview/generate.

FR-9: Epic 5 - Invoice issue va immutable snapshot.

FR-10: Epic 6 - Receipt, allocation, promotion coverage source settlement, reversal va refund.

FR-11: Epic 6 - Prior debt, settlement va ledger report.

FR-12: Epic 4 - Leave/attendance/service domain, evidence va source-linked adjustment; Epic 7 - Parent-authorized leave request entry va state view.

FR-13: Epic 4 - Handover operational reference.

FR-14: Epic 8 - Payroll entitlement, workforce va policy foundation; Epic 9 - timekeeping va late-care facts.

FR-15: Epic 10 - Regular Payroll/payout; Epic 11 - correction va thirteenth-month pay.

FR-16: Epic 7 - Parent authorization, attendance read model va notification inbox.

FR-17: Epic 7 - Read-only Parent obligation va Payment instruction snapshot.

## Epic List

### Epic 1: Vận hành nền tảng đa trường và truy cập có kiểm soát

Platform Operator provision, suspend/reactivate School; Admin/Staff dang nhap, chon School va chi thuc hien capability hien hanh trong tenant do. E1 cung chung minh tenant isolation truoc khi bat ky nghiep vu School nao duoc phat hanh.

**FRs covered:** FR-1, FR-2, FR-3.

### Epic 2: Thiết lập trường học và danh bộ có lịch sử

School Admin thiet lap SchoolYear, Class, Student enrollment, Parent links va Staff assignment theo effective date ma khong pha lich su van hanh.

**FRs covered:** FR-5, FR-6.

**Depends on:** Epic 1.

### Epic 3: Chính sách trường học theo phiên bản

School Admin thiet lap profile, calendar va typed policy theo effective date, audit va ly do de truong co quy tac ro rang truoc khi van hanh lop hoc hay thu tien.

**FRs covered:** FR-4.

**Depends on:** Epic 1, Epic 2.

### Epic 4: Vận hành lớp học có kiểm soát

Teacher co capability ghi attendance/handover/DailyJournal trong Class duoc phan cong; School Admin/Finance quan ly service va long leave; leave state, evidence, conflict va Finance adjustment source duoc bao toan ma khong tu dong tinh fee.

**FRs covered:** FR-12 (domain operations), FR-13.

**Depends on:** Epic 1, Epic 2, Epic 3.

### Epic 5: Tạo và phát hành nghĩa vụ thu

Finance cau hinh catalog/rule va chinh sach uu dai co version, tao CollectionRun, kiem tra preview do server tinh, generate Invoice DRAFT chong trung, xu ly adjustment hop le va issue immutable Payment instruction snapshot.

**FRs covered:** FR-7, FR-8, FR-9.

**Depends on:** Epic 1, Epic 2, Epic 3, Epic 4. Epic 4 only delivers immutable adjustment eligibility sources; Epic 5 owns materialization onto Invoice DRAFT.

### Epic 6: Thu tiền, đối soát công nợ và báo cáo sổ cái

Finance ghi Receipt/Allocation, settle exact promotion coverage source Invoice, thuc hien reversal/refund/debt transfer dung policy va xem report ledger co the reconcile.

**FRs covered:** FR-10, FR-11.

**Depends on:** Epic 5.

### Epic 7: Parent portal đa trường, read-first

Parent dung portal mobile-first de chon School, xem attendance an toan, inbox, gui/quan ly leave request khi duoc phep va xem Invoice/Payment instruction snapshot; Parent khong the mutate attendance hoac settlement.

**FRs covered:** FR-12 (Parent leave entry), FR-16, FR-17.

**Depends on:** Epic 1, Epic 2, Epic 4, Epic 6.

### Epic 8: Payroll entitlement, workforce và policy foundation

Platform Operations chi cap Payroll theo School; School enabled co workforce terms effective-dated, typed Payroll policy va capability an toan truoc khi xu ly cham cong hay tien luong.

**FRs covered:** FR-14.

**Depends on:** Epic 1, Epic 2, Epic 3.

### Epic 9: Chấm công nhân sự và ca trông muộn

Finance Manager persona Ke toan/School Admin co capability upload va ra soat file may cham cong, chot ngay cong va xac nhan ca trong muon lam source fact cho Payroll, khong suy dien khoan tra them tu handover hay presence.

**FRs covered:** FR-14.

**Depends on:** Epic 8.

### Epic 10: Payroll thường kỳ, phê duyệt và payout

Finance Manager persona Ke toan tinh/materially edit/reconcile/submit Payroll versioned theo contract, policy va reviewed facts; School Admin co identity khong tham gia cac action do approve/refuse/reopen unpaid run; Finance Manager xac nhan payout co doi soat.

**FRs covered:** FR-15.

**Depends on:** Epic 8, Epic 9.

### Epic 11: Payroll correction và lương tháng 13

Sai sot sau payout tao correction delta bat bien; luong thang 13 dung ky/run rieng va cung approval boundary.

**FRs covered:** FR-15.

**Depends on:** Epic 10.

### Epic 12: Payroll extensions có hợp đồng riêng

Mo rong Payroll chi sau khi policy/compliance contract tuong ung duoc duyet: bonus theo si so, nhieu ca/partial-day, direct timeclock integration va tax/BHXH filing.

**FRs covered:** FR-14, FR-15.

**Depends on:** Epic 11.

## Epic 1: Vận hành nền tảng đa trường và truy cập có kiểm soát

Platform Operator provision, suspend/reactivate School; Admin/Staff dang nhap, chon School va chi thuc hien capability hien hanh trong tenant do. Tenant isolation duoc chung minh truoc khi phat hanh nghiep vu School.

### Story 1.1: Khởi tạo nền tảng target đa portal

As a Platform Operator,
I want a clean-break PassionEdu workspace voi cac portal va API doc lap,
So that cac luong da truong co mot nen tang trien khai va kiem thu dung boundary ngay tu dau.

**Acceptance Criteria:**

**Given** repository dang o clean-break initiative
**When** workspace duoc scaffold
**Then** co `apps/api`, `apps/web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui` va `deploy/compose` theo Architecture Spine
**And** portal khong import app khac hoac API internals; packages chi chua pure contract, formatter hoac stateless UI primitives.

**Given** workspace target khoi dong
**When** Teacher portal duoc build/deploy
**Then** `apps/teacher-web` la PWA rieng tai `teacher.passionedu.org` va khong import `apps/web`, `apps/parent-web`, `apps/ops-web` hay API internals
**And** Admin shell khong co attendance, handover hay DailyJournal mutation destination.

**Given** API target khoi dong
**When** schema/migration/seed duoc tao
**Then** Prisma chi nam tai `apps/api/prisma` va seed/dev/test chi target multi-school model
**And** khong co legacy single-school schema, lifecycle, compatibility layer hoac `db push` production path.

**Given** pilot Compose duoc cau hinh
**When** images duoc build tu source tren VPS
**Then** TLS proxy route tach `app`, `parent`, `ops` va `api` toi container tuong ung, PostgreSQL dung durable volume va secrets khong nam trong Git
**And** migrations chay truoc API version can migration, destructive rollback bi tu choi.

### Story 1.2: Đăng nhập Google và cô lập session theo audience

As a user of one PassionEdu portal,
I want to sign in bang Google chi vao dung audience cua portal do,
So that session Admin/Staff, Parent va Ops khong the bi dung cheo.

**Acceptance Criteria:**

**Given** mot Google identity hop le bat dau OAuth tu `app.passionedu.org`, `parent.passionedu.org` hoac `ops.passionedu.org`
**When** callback thanh cong
**Then** API tao hoac bind canonical `UserIdentity` va chi issue session cho audience khoi tao flow
**And** callback URL va origin phai thuoc allowlist cua audience do.

**Given** mot Google identity bat dau OAuth tu `teacher.passionedu.org`
**When** callback thanh cong
**Then** API chi issue teacher audience session voi cookie host-only cua Teacher
**And** session `app`, `teacher`, `parent` va `ops` bi tu choi khi dung cheo audience.

**Given** mot audience session duoc issue
**When** browser gui session sang endpoint audience khac
**Then** request bi tu choi truoc khi tra protected data
**And** cookie la host-only, `Secure`, `httpOnly`, `SameSite=Lax`, co session audience rieng va khong dung `.passionedu.org`.

**Given** portal khoi dong hoac nhan `401`, expiry hay logout
**When** user identity/session state thay doi
**Then** protected memory/query state bi xoa truoc protected view tiep theo
**And** Parent service worker khong cache authenticated response, payment instruction, media hay evidence URL.

**Given** Parent Google callback da bind ParentProfile
**When** API kiem tra active `StudentParent` links truoc session issue
**Then** khong co active link thi Parent session bi tu choi, dung mot active School thi session/home context duoc xac dinh khong can chooser, va nhieu active School thi chi cac School do duoc chooser
**And** E1 integration/E2E test Parent callback, audience cookie, session isolation va active-link school-selection authorization truoc release gate; `ParentSchoolContext` o E7 dung lai contract da phat hanh nay cho moi scoped query.

### Story 1.3: Provision và lifecycle School qua Ops

As a Platform Operator,
I want to provision, suspend va reactivate mot School voi owner bootstrap atomic,
So that truong moi hoat dong doc lap ma toi khong nhan quyen van hanh cua truong do.

**Acceptance Criteria:**

**Given** user co `PlatformOperatorGrant` bootstrap tu `SUPERADMIN_EMAIL` va Ops audience session
**When** ho provision mot School voi owner email chuan hoa
**Then** transaction atomically tao hoac tai su dung pending owner `UserIdentity`, pending `SchoolMembership` va `SCHOOL_ADMIN` grant
**And** failure khong de lai partial identity, membership hoac grant; Platform grant khong tao School membership cho actor.

**Given** provision request timeout hoac duoc gui lai
**When** Platform Operator dung `Idempotency-Key` cung route/fingerprint
**Then** server replay cung outcome va Ops reconcile Operation truoc retry
**And** fingerprint khac bi conflict, khong tao School hay pending owner grant duplicate.

**Given** pending owner dang nhap Google bang verified email khop
**When** subject chua bind hoac khop binding hop le
**Then** server bind Google subject va owner di vao dung School shell
**And** subject mismatch hoac email reassigned bi tu choi cho toi khi Admin revoke/gan lai theo audit flow.

**Given** Platform Operator suspend hoac reactivate mot School
**When** action duoc xac nhan hoac timeout
**Then** action dung idempotency/Operation reconciliation va Ops chi hien thi server-confirmed state
**And** School bi suspend chan business request ke tiep nhung khong xoa School hay global identity session o context khac.

### Story 1.4: Membership, capability và School context an toàn

As an Admin or Staff user,
I want to chon mot School duoc cap quyen va chi thay/thuc hien capability hop le,
So that toi khong the thao tac du lieu ngoai tenant hoac vuot role cua minh.

**Acceptance Criteria:**

**Given** UserIdentity co nhieu `SchoolMembership` active voi role grants khac nhau
**When** user chon School qua chooser hoac truy cap operational route `/schools/:schoolId/`
**Then** server resolve active membership va capability o moi request, khong tin URL, UUID, filter, header hoac browser state lam authorization proof
**And** navigation chi hien capability server grant; heading luon hien thi selected School.

**Given** School Admin co capability quan ly access trong selected School
**When** ho tao, revoke hoac thay doi `SchoolMembership` va preset `SchoolRoleGrant`
**Then** server chi cap `SCHOOL_ADMIN`, `FINANCE_MANAGER` hoac role/capability da duoc phat hanh cho dung School, luu actor/reason/audit va ap dung o request ke tiep
**And** Staff profile/assignment khong tu tao login, membership hay role; School A access change khong anh huong membership hop le o School B.

**Given** membership tai School A bi revoke trong khi membership tai School B van active
**When** user gui request tiep theo toi A hoac B
**Then** A bi tu choi va B van hoat dong
**And** protected client state cua A bi xoa, khong co cross-School stale content.

**Given** form dirty hoac mutation da submit nhung ket qua chua chac chan
**When** user doi School
**Then** switch guard chi cho remain, discard truoc submit hoac reconcile Operation
**And** app khong auto-save draft, khong silently doi School va disable retry cho toi khi Operation duoc doi soat.

### Story 1.5: Tenant graph, mutation protection và audit provenance

As a School operator,
I want every School business request duoc co lap, audited va chong retry trung,
So that du lieu tenant va tac dong van hanh van dung khi co concurrent request hoac timeout.

**Acceptance Criteria:**

**Given** mot request doc/ghi aggregate School-scoped
**When** API truy van, update hoac delete resource
**Then** query/write match ca record ID va `schoolId` trong cung transaction
**And** tenant-owned relation dung composite `(schoolId, id)` key/FK khi kha dung hoac owning command verify toan graph trong transaction.

**Given** cookie-auth mutation
**When** origin, double-submit CSRF hoac capability khong hop le
**Then** mutation bi tu choi truoc state transition
**And** audit luu School, actor identity/reference, actor membership khi co, timestamp, provenance va reason khi bat buoc.

**Given** high-impact mutation su dung `Idempotency-Key`
**When** cung actor context gui lai fingerprint giong nhau sau timeout
**Then** API replay saved outcome va `GET /operations/:operationId` chi authorize dung actor context tao Operation
**And** reuse key voi request fingerprint khac bi conflict; cung key o School khac khong conflict.

### Story 1.6: Release gate về tenant isolation và audience access

As a release owner,
I want automated proof of tenant, audience va revoke boundaries,
So that Epic 2 tro di khong duoc phat hanh tren authorization chua duoc xac minh.

**Acceptance Criteria:**

**Given** it nhat hai School, nhieu SchoolMembership va session audience Admin, Teacher, Parent, Ops trong PostgreSQL integration fixture
**When** release suite chay moi route/query/write scoped ma Epic 1 da phat hanh
**Then** cross-School UUID, route, header, membership/Operation reference va tenant-owned relation insert deu bi tu choi
**And** scoped unique constraints, audit/Operation provenance, origin/CSRF denial va idempotency scope duoc kiem tra bang automated tests.

**Given** mot SchoolMembership hoac School bi revoke/suspend
**When** request ke tiep va portal foreground/deep-link dien ra
**Then** server tu choi context khong hop le, portal xoa protected state va dua user ve chooser hoac signed-out safe state
**And** valid context khac cua cung UserIdentity van dung duoc.

**Given** Parent audience chua co active StudentParent domain o Epic 1
**When** callback, session hoac protected request duoc thu
**Then** server va Parent portal fail-closed, khong issue Parent session va khong lo protected DTO/cache
**And** Parent-link/cross-School chooser/revoke proof la release gate cua Story 2.3 sau khi StudentParent ton tai.

**Given** portal E2E suite chay
**When** user chuyen audience hoac School trong cac trang thai sach, dirty va timeout
**Then** audience/session isolation, visible School context, switch guard, focus/error state va Operation reconciliation deu pass
**And** Epic 1 khong duoc danh dau complete neu tenant-isolation suite con loi.

## Epic 2: Thiết lập trường học và danh bộ có lịch sử

School Admin thiet lap SchoolYear, Class, Student enrollment, Parent links va Staff assignment theo effective date ma khong pha lich su van hanh.

### Story 2.1: Quản lý SchoolYear và Class trong tenant

As a School Admin,
I want to tao va quan ly SchoolYear active cung cac Class thuoc dung nam hoc,
So that danh bo co mot ranh gioi thoi gian ro rang truoc khi nhan hoc sinh.

**Acceptance Criteria:**

**Given** School Admin co capability trong mot active School context
**When** tao hoac cap nhat SchoolYear va Class
**Then** server chi cho toi da mot `SchoolYear` active trong School va Class luon thuoc mot SchoolYear
**And** Class khong the duoc tai su dung sang SchoolYear khac hoac School khac.

**Given** SchoolYear/Class form co validation error hoac context bi revoke
**When** server tra loi
**Then** UI giu du lieu nhap, hien thi `fieldErrors` canh dung field va focus error summary
**And** khong tao local placeholder hoac hien thi du lieu tu School context truoc do.

**Given** School Admin mo Danh bo
**When** route tai thanh cong
**Then** selected School va SchoolYear context hien thi ro trong heading/navigation
**And** list/table co caption, keyboard row action, responsive scroll/card treatment va chi tra School-scoped data.

### Story 2.2: Tạo học sinh và enrollment có vòng đời bảo toàn lịch sử

As a School Admin,
I want to tao Student voi enrollment thuoc Class/SchoolYear va quan ly lifecycle,
So that chi cac tre du dieu kien moi di vao van hanh hoac thu tien ma lich su van con nguyen.

**Acceptance Criteria:**

**Given** active SchoolYear va Class thuoc selected School
**When** School Admin tao Student enrollment
**Then** server sinh `studentCode` theo prefix/sequence unique khong phan biet hoa-thuong trong School
**And** enrollment persist `effectiveFrom` va optional `endedOn` theo interval `[effectiveFrom, endedOn)`, actor/audit va as-of SchoolYear/Class facts; code khong the bi client nhap, sua hoac tai su dung sau khi da duoc tham chieu.

**Given** Student da ton tai
**When** tao hoac thay doi enrollment lifecycle
**Then** moi Student co toi da mot enrollment trong cung SchoolYear va lifecycle chi dung `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`
**And** server tu choi effective interval khong hop le/overlap va chi `ENROLLED` tai as-of date mac dinh du dieu kien cho attendance va CollectionRun.

**Given** Student hoac enrollment da co lich su van hanh
**When** School Admin ngung hoac thay doi trang thai
**Then** server giu record va audit, khong hard-delete
**And** UI hien thi lifecycle/history theo server state, khong suy luan kha nang tham gia tu client.

### Story 2.3: Liên kết Parent pending và revoke theo từng học sinh

As a School Admin,
I want to tao, xem va revoke Parent-Hoc sinh link theo tung Student,
So that Parent chi co the nhan dung school context va du lieu cua tre duoc uy quyen.

**Acceptance Criteria:**

**Given** Student thuoc selected School
**When** School Admin tao Parent pending link
**Then** form yeu cau normalized email, full name va phone number; server tao hoac tai su dung ParentProfile pending va `StudentParent` active theo Student
**And** ParentProfile la global nhung link/query/audit duoc tenant-scoped, khong tao Parent login hoac role mac dinh.

**Given** Parent verified Google login khop pending email
**When** server bind identity
**Then** binding duoc thuc hien atomically voi recheck `StudentParent` active truoc Parent session issue
**And** subject mismatch hoac email da reassigned bi tu choi cho toi khi School Admin revoke/gan lai voi audit.

**Given** PostgreSQL integration va portal E2E fixture co it nhat hai School, nhieu StudentParent active/revoked cua mot ParentProfile va Parent session da bind
**When** Parent truy cap route, UUID, filter, School chooser hoac child context khong nam trong active link
**Then** ParentSchoolContext tu choi truoc protected query, DTO/cache khong lo Student/School khac va session issue chi xay ra sau atomic active-link recheck.

**Given** School Admin revoke mot StudentParent link
**When** Parent gui request ke tiep hoac mo protected child context
**Then** server tu choi child/school data dua tren link do va portal xoa protected state ve chooser hoac signed-out safe state
**And** audit giu lich su link/revoke; Parent van co the xem Student/School khac neu link khac con active.

### Story 2.4: Quản lý Staff, Chức danh và phân công theo capability/effective-date

As a School Admin,
I want to cau hinh Staff profile, Chuc danh, login binding va phan cong theo capability/effective date,
So that SchoolPosition tro thanh nguon quyen Staff duy nhat truoc khi cac write van hanh lop duoc phat hanh.

**Prerequisite migration/configuration story:** Story nay phai hoan tat one-way migration tu `StaffType`/`staffType` va preset-role authorization sang SchoolPosition capability grants truoc khi build Story 4.2 hoac Story 4.4. Story 4.1 da hoan tat theo contract cu khong bi rollback; follow-up migration decision va verification cua no nam trong Story nay.

**Acceptance Criteria:**

**Given** School moi duoc provision hoac School Admin mo quan ly Chuc danh trong selected School
**When** server tra SchoolPosition configuration
**Then** co seed Hieu truong, Quan ly truong, Ke toan, Giao vien, Nhan vien tuyen sinh, Bep va Y te, moi Position School-scoped co code/name School-unique, lifecycle `ACTIVE | INACTIVE` va capability tu Platform catalog gioi han
**And** School Admin chi co the tao, doi ten, inactivate Position hoac gan capability catalog duoc phep qua transaction, UUID `Idempotency-Key`, Operation reconciliation, audit reason; khong the tao free-form capability/script hoac gan capability Platform/Parent/Ops.

**Given** School Admin tao hoac cap nhat Staff profile va primary Position/login binding
**When** luu thong tin trong selected School
**Then** he thong chi luu ho ten, email, so dien thoai, ngay sinh, gioi tinh, dia chi, mot primary Position active va toi da mot audited active binding den SchoolMembership/UserIdentity cung School
**And** StaffProfile khong tu tao password, HR/payroll record, membership hay quyen; server resolve operational capability tu StaffProfile active, primary SchoolPosition active, binding active va Position capability, khong tu Position name hay browser state.

**Given** School Admin tao, thay doi hoac ket thuc StaffClassAssignment
**When** Staff/Class thuoc selected SchoolYear duoc validate
**Then** assignment dung interval `[effectiveFrom, effectiveTo)`, timezone `Asia/Ho_Chi_Minh`, actor va ly do audit, chi tham chieu StaffProfile, va chi duoc tao khi Staff active va Position cho capability van hanh lop tuong ung
**And** server tu choi Staff/Position inactive, cross-School/Class, capability khong hop le hoac khoang thoi gian khong hop le; assignment khong la prerequisite cua `HANDOVER_WRITE`.

**Given** `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER` preset grants hoac `StaffType`/`staffType` ton tai tu implementation cu
**When** one-way migration chay trong transaction
**Then** server migrate effective access sang seeded/created Position capability grants, giu audit/Operation snapshot lich su va khong mat quyen trong migration
**And** sau completion, `StaffType`/`staffType` va preset-role authorization bi loai bo, khong con dual authorization source; inactive Position, Staff, binding hoac capability revoke deny request ke tiep.

### Story 2.5: Chuyển lớp, chuyển năm và close-year bằng preview có đối soát

As a School Admin,
I want to chuyen mot hoac nhieu Student sang Class/SchoolYear moi qua preview va confirmation,
So that qua trinh chuyen danh bo khong mat lich su hoac tao enrollment trung.

**Acceptance Criteria:**

**Given** source enrollment, destination SchoolYear/Class va School Admin capability hop le
**When** School Admin mo transition wizard
**Then** server tra preview theo tung Student gom record co the chuyen va categorized record khong the chuyen
**And** UI hien thi source history, destination context, effective date, reason va khong cho client force-move record bi loai.

**Given** School Admin xac nhan class transfer, year transition hoac close-year batch
**When** command chay voi `Idempotency-Key`
**Then** transaction tao enrollment/assignment moi chi tai destination da chon, giu source history va snapshot/audit actor/reason
**And** timeout chuyen sang Operation reconciliation; retry fingerprint giong nhau replay ket qua, fingerprint khac bi conflict.

**Given** close-year hoan tat
**When** lich su duoc doc lai
**Then** class assignment ket thuc nhung enrollment lich su `ENROLLED` duoc giu
**And** `GRADUATED` chi duoc dung khi tre thuc su roi truong; re-enrollment can ly do/audit va khong ghi de enrollment cu.

## Epic 3: Chính sách trường học theo phiên bản

School Admin thiet lap profile, calendar va typed policy theo effective date, audit va ly do de truong co quy tac ro rang truoc khi van hanh lop hoc hay thu tien.

### Story 3.1: Quản lý School profile và calendar có version

As a School Admin,
I want to cau hinh School profile va calendar theo effective date,
So that ngay van hanh/nghi le duoc server su dung nhat quan ma khong ghi de lich su.

**Acceptance Criteria:**

**Given** School Admin co capability trong selected School
**When** tao hoac cap nhat School profile va calendar version
**Then** moi record thuoc School context, co effective date, actor, timestamp va audit old/new value
**And** client khong tu suy luan ngay nghi, ngay hoat dong hoac school context tu cached state.

**Given** calendar version moi conflict voi version active hoac co effective date khong hop le
**When** server validate request
**Then** request bi tu choi voi `fieldErrors` va active/proposed values van doc duoc
**And** UI focus error summary, khong noi policy da doi truoc khi server confirm.

**Given** mot operational record hoac finance snapshot da ton tai
**When** calendar/profile hien hanh thay doi
**Then** snapshot/history da phat sinh khong bi rewrite
**And** API tra policy/calendar theo as-of date trong business timezone `Asia/Ho_Chi_Minh`.

### Story 3.2: Cấu hình FinancePolicy và tài khoản nhận tiền có lịch sử

As a School Admin,
I want to thiet lap FinancePolicy va quan ly BankAccount active/inactive,
So that Finance co cac rule nen va tai khoan hop le de phat hanh nghia vu ma khong lam thay doi Invoice lich su.

**Acceptance Criteria:**

**Given** School Admin mo FinancePolicy trong selected School
**When** tao mot version policy
**Then** policy co due date, tax-treatment label, SchoolYear debt settings va reversal mode `DIRECT` hoac `SCHOOL_ADMIN_APPROVAL`
**And** moi thay doi co effective date, actor, old/new value, reason khi duoc yeu cau va server validation.

**Given** School Admin tao hoac thay doi lifecycle mot BankAccount
**When** luu
**Then** account thuoc dung School, co receiving bank, account number, account-holder name va validated transfer-content template, co trang thai active/inactive va khong hard-delete
**And** inactive account khong the duoc dung cho Invoice moi nhung account/snapshot lich su van doc duoc; malformed/blank source field hoac account khac School bi tu choi.

**Given** policy/account form dang dirty hoac mutation outcome chua chac chan
**When** user doi School hoac request timeout
**Then** switch guard chan silent context change va cho reconcile Operation khi applicable
**And** UI chi hien thi server-confirmed active policy/account state.

### Story 3.3: Cấu hình evidence điểm danh và trả trẻ theo policy typed

As a School Admin,
I want to cấu hình evidence cho điểm danh và trả trẻ,
So that lop hoc ap dung rule da duoc phe duyet thay vi JSON tu do hoac logic client.

**Acceptance Criteria:**

**Given** School Admin chon attendance hoac handover evidence policy
**When** tao version moi
**Then** policy chi nhan `photoEvidenceMode` la `REQUIRED` hoac `OPTIONAL`, cung audit
**And** policy `REQUIRED` tro thanh server-enforced input cho tuong ung attendance `PRESENT` hoac handover `pickedUpAt` write, khong phai UI hint.

**Given** School Admin xem Settings
**When** evidence mode dang ap dung duoc render
**Then** UI hien thi ro rieng yeu cau anh cho `PRESENT` va `pickedUpAt`, khong co free-form key-value JSON, cutoff, grace hay block policy.

**Given** School Admin cau hinh DailyJournalPolicy
**When** tao version policy moi
**Then** policy typed luu 30-ngay Parent journal/media retention sau `StudentEnrollment.endedOn`, MIME `JPEG | PNG | WEBP`, gioi han 10 MB moi anh va no-count-limit per journal, cung effective date va audit/reason
**And** API server-enforce policy o journal/media write-read boundary; client khong the mo rong retention, MIME, kich thuoc hay tu tao permanent media URL.

### Story 3.4: Audit và verification cho policy isolation/versioning

As a release owner,
I want automated proof rang policy version chi tac dong dung School va thoi diem,
So that cau hinh tien, access va attendance khong bi leak hoac rewrite lich su.

**Acceptance Criteria:**

**Given** it nhat hai School voi policy versions, BankAccounts va as-of records khac nhau
**When** PostgreSQL integration suite doc/ghi policy hoac account
**Then** cross-School ID/route/filter access bi tu choi va query chi chon dung effective version trong School context
**And** unique/lifecycle constraint, active-account eligibility va School-scoped audit deu duoc kiem tra.

**Given** policy moi duoc de xuat, conflict hoac bi tu choi
**When** Admin/Staff portal render response
**Then** active va proposed value duoc giu ro, error accessible bang keyboard/screen reader
**And** khong co client-calculated policy result hoac stale School data trong UI.

**Given** attendance, finance hoac Parent domain truy van policy
**When** policy version thay doi sau khi source/snapshot da duoc tao
**Then** domain nhan typed as-of result tu server theo contract
**And** test chung minh snapshot evidence lich su khong bi rewrite boi setting hien hanh.

## Epic 4: Vận hành lớp học có kiểm soát

Nhan su co capability ghi attendance/handover; School Admin/Finance quan ly service va long leave; leave state, evidence, conflict va Finance adjustment source duoc bao toan ma khong tu dong tinh fee.

### Story 4.1: Leave domain theo calendar, policy và capability

As an authorized School user,
I want to tao, review va quyet dinh leave request theo calendar/policy hien hanh,
So that trang thai nghi hoc va eligibility van hanh duoc quan ly nhat quan.

**Acceptance Criteria:**

**Given** Student co enrollment hop le trong selected School va ngay duoc chon
**When** authorized actor tao leave request
**Then** server kiem tra School calendar, enrollment status va policy as-of date
**And** request/audit/source luon School-scoped, khong duoc tao qua Student UUID cua School khac.

**Given** leave request truoc deadline policy hoac sau deadline
**When** server xu ly request
**Then** request truoc deadline auto-approve theo policy; request sau deadline yeu cau capability approval duoc cau hinh
**And** approval/rejection bat buoc `Idempotency-Key`, persist actor-scoped `Operation`, replay identical outcome, reject changed fingerprint va reconcile truoc retry; client khong tu chon approved state.

**Given** leave request dang `PENDING` hoac da quyet dinh
**When** Staff/Admin xem operational record
**Then** API tra state va conflict facts can thiet theo capability
**And** Parent-facing status/internal approval mechanics, notification projection va Parent edit/cancel khong thuoc story nay.

**Completed-history follow-up:** Story nay da hoan tat theo contract `staffType`/preset-role cu. Khong rewrite persistence, Parent boundary, idempotency hay Staff login binding da phat hanh. Truoc khi Story 4.2 hoac Story 4.4 duoc build, Story 2.4 phai quyet dinh va hoan tat migration de `CLASS_LEAVE_READ` duoc resolve tu active primary SchoolPosition capability va StaffClassAssignment effective trong Class phu hop; khong duoc gia dinh authorization cu van ton tai sau migration.

### Story 4.2: Staff ghi attendance có conflict validation và evidence policy

As a Staff member with `ATTENDANCE_WRITE`,
I want to ghi attendance theo Student/ngay voi evidence khi policy yeu cau,
So that trang thai lop hoc dang tin cay ma leave/calendar conflict khong bi ghi de.

**Acceptance Criteria:**

**Given** Staff dang dung teacher audience, co StaffProfile active, primary SchoolPosition active cap `ATTENDANCE_WRITE`, binding active, StaffClassAssignment effective, selected School/Class/date hop le va Student `ENROLLED`
**When** Staff submit attendance status
**Then** server resolve capability tu Position, khong tu `staffType`, preset role, Position name hay browser state, va chi cho phep StaffProfile da bind audited voi SchoolMembership/UserIdentity active va Class assignment effective tai as-of date ghi trang thai trong School context, audit actor/time/provenance va tra updated server state
**And** client khong the dung Class, Student hoac date tu School khac de bypass capability/assignment.

**Given** selected date la holiday/non-operating hoac Student co leave request conflict
**When** Staff co ghi attendance trai dieu kien
**Then** server tu choi hoac tra conflict theo policy, dac biet `PRESENT` conflict voi leave duoc xac nhan
**And** UI hien thi server explanation va refresh state, khong co local override.

**Given** active AttendancePolicy la `REQUIRED`
**When** Staff submit `PRESENT` khong co evidence hop le
**Then** server tu choi request
**And** khi evidence hop le, record chi chua access-controlled reference, khong dua media URL vao Parent hoac unprivileged DTO.

### Story 4.3: Evidence lifecycle và notification source an toàn

As a School Admin,
I want evidence duoc giu, gioi han quyen xem va don dung retention; attendance event duoc tao idempotent,
So that anh tre em khong bi lo hay ton tai vo thoi han va Parent projection co nguon dung.

**Acceptance Criteria:**

**Given** attendance hoac handover record co evidence
**When** Staff khong co capability tuong ung, School khac hoac Parent truy cap evidence/media route
**Then** request bi tu choi va Parent DTO/event khong co media URL, preview, Staff identity hoac internal reason
**And** authorized capability-bearing Staff/School Admin chi xem evidence trong dung School scope.

**Given** attendance hoac handover evidence da xac nhan duoc hai thang lich
**When** retention cleanup chay
**Then** blob/preview bi xoa, audit metadata ve deletion van con
**And** Staff/Admin doc record sau cleanup thay thong bao audit-safe "Tep bang chung da het han".

**Given** mot attendance hoac handover write thanh cong hoac retry idempotent
**When** transaction hoan tat
**Then** domain emit dung mot in-app notification source event co School/Student/date va, voi handover, chi confirmed picked-up time, nhung khong chua evidence hoac internal facts
**And** delivery/read projection chi co the duoc Parent portal xu ly sau khi recheck active `StudentParent` o Epic 7.

### Story 4.4: Staff ghi handover School-wide như operational reference

As a Staff member with `HANDOVER_WRITE`,
I want to ghi picked-up time cua mot Student theo ngay,
So that School co lich su ban giao ma khong tao mot khoan phi tu dong.

**Acceptance Criteria:**

**Given** Staff dang dung teacher audience, co StaffProfile active, primary SchoolPosition active cap `HANDOVER_WRITE`, binding active, Student/enrollment/day thuoc selected School
**When** Staff submit picked-up time
**Then** server resolve `HANDOVER_WRITE` tu Position, khong tu `staffType`, preset role, Position name hay browser state, va validate StaffProfile binding, membership, School, Student enrollment, date, state va `HandoverPolicy.photoEvidenceMode` ma khong yeu cau StaffClassAssignment; REQUIRED tu choi picked-up time khong co evidence hop le va snapshot evidence reference/audit vao confirmed operational record
**And** Student/Class UUID School khac, missing/revoked capability, inactive Position/binding, already-recorded state hoac validation error tra ly do server va UI refresh record.

**Given** Finance hoac Staff xem handover record
**When** record duoc trinh bay
**Then** UI label no la operational reference voi School/date/Student context va Finance co the doc immutable audit-safe handover snapshot de giai thich dong `MANUAL`
**And** khong tinh, goi y, tao hoac tu dong post late-pickup fee; khong bien no thanh pickup authorization.

### Story 4.5: Service enrollment và long leave làm nguồn Finance có kiểm soát

As a School Admin or Finance Manager,
I want to quan ly service enrollment va long leave source theo effective date,
So that CollectionRun eligibility va adjustment/refund tuong lai dua tren nguon co audit thay vi credit thu cong.

**Acceptance Criteria:**

**Given** School Admin hoac Finance Manager co capability phu hop
**When** tao/huy `StudentServiceEnrollment`
**Then** server luu status, effective dates, actor/audit va chi cho record thuoc selected School/Student
**And** Parent khong co service-cancel action hoac endpoint.

**Given** Parent hoac School Admin khoi tao long leave source
**When** School Admin duyet/tu choi va chon effective date
**Then** effective date khong truoc request date, approval loai Student khoi future CollectionRun eligibility
**And** approval/rejection bat buoc `Idempotency-Key`, persist actor-scoped `Operation`, replay identical outcome, reject changed fingerprint va reconcile truoc retry; Invoice da issue khong bi sua va Finance nhan source hop le cho adjustment/refund path.

**Given** approved leave/long leave du dieu kien meal adjustment
**When** Finance chuan bi tao/issue CollectionRun o Epic 5
**Then** API tra immutable adjustment eligibility source theo School/Student/day/receivable voi provenance
**And** Epic 4 khong tao hoac tim Invoice DRAFT; Epic 5 finance-only command moi materialize negative line idempotent va luu no-target, issued/voided target hoac retry outcome.

### Story 4.6: Hàng đợi vận hành buổi sáng

As a School Admin or authorized Staff member,
I want to xem hang doi diem danh thieu va don nghi dang cho xu ly theo lop/ngay,
So that toi biet lop nao can xu ly truoc ma khong phai tu tim tung man hinh.

**Acceptance Criteria:**

**Given** selected School, working date va actor capability hop le
**When** actor mo Tong quan
**Then** server tra attendance-gap va pending-leave counts theo School/date/class tu state hien hanh
**And** UI hien School/date, text count va one-line explanation; khong optimistic cap nhat count hay dua finance len thanh primary queue.

**Given** actor mo mot queue card
**When** chon attendance gap hoac pending leave theo lop/ngay
**Then** app dieu huong toi destination da prefilter bang date/class/status trong URL va server re-authorize School/capability truoc khi tra list
**And** count/list refresh tu server sau attendance hoac leave decision, khong hien stale cross-School data.

**Given** queue khong co record, request bi tu choi hoac School switch xay ra
**When** UI render state
**Then** empty/error state giu School/date context, accessible va khong suy dien zero la confirmed khi response loi
**And** dirty/pending mutation dung switch guard va Operation reconciliation theo contract.

### Story 4.7: Kiểm thử release gate cho vận hành lớp

As a release owner,
I want automated proof cho authorization, conflict, evidence retention va adjustment provenance,
So that attendance/handover khong lam lo du lieu tre em hoac bien thanh pricing engine.

**Acceptance Criteria:**

**Given** PostgreSQL fixture co nhieu School, policy version, enrollment, leave, evidence va adjustment source
**When** integration suite chay write/read/cleanup/adjustment scenarios
**Then** cross-tenant/capability access, required-evidence violation, holiday/leave-`PRESENT` conflict, source/target mismatch va duplicate adjustment deu bi tu choi
**And** test xac minh cross-School Position/capability denial, inactive Position/Staff/binding/capability revoke denial, khong co authorization tu `staffType` hay preset role sau Story 2.4 migration, `ATTENDANCE_WRITE`/`CLASS_LEAVE_READ` class restriction, `HANDOVER_WRITE` cross-class trong cung School, blob cleanup sau hai thang lich, audit retention va khong co Parent-accessible evidence field.

**Given** Admin/Staff portal E2E chay attendance/handover flows
**When** user gap missing capability, conflict, validation error, timeout hoac School switch
**Then** UI hien thi server-confirmed status/reason, accessible error/focus, switch guard va Operation reconciliation theo contract
**And** attendance chi available khi Position cap `ATTENDANCE_WRITE` va Class assignment effective, handover available cho `HANDOVER_WRITE` trong selected School khong suy dien/yeu cau Class assignment, va khong co automatic fee UI, local status override hoac stale cross-School class data.

**Given** attendance write hoan tat nhieu lan do retry
**When** notification source duoc kiem tra
**Then** chi mot idempotent event source ton tai cho attendance event
**And** Parent projection/delivery chi duoc kiem thu tai Epic 7 voi active StudentParent recheck.

## Epic 5: Tạo và phát hành nghĩa vụ thu

Finance cau hinh catalog/rule va PromotionPolicy co version, tao CollectionRun, kiem tra preview do server tinh, generate Invoice DRAFT chong trung, xu ly adjustment hop le va issue immutable Payment instruction snapshot.

### Story 5.1: Quản lý receivable catalog, ChargeRule và chính sách ưu đãi có phiên bản

As a Finance Manager,
I want to quan ly khoan thu, ChargeRule va chinh sach uu dai co version theo School scope,
So that CollectionRun co rule ro rang ma Invoice lich su khong bi thay doi.

**Acceptance Criteria:**

**Given** Finance Manager hoac School Admin co capability trong selected School
**When** tao/inactivate `ReceivableGroup`, `Receivable`, `ChargeRule`, `PromotionPolicy` hoac tao version moi cua policy
**Then** record la School-scoped, co audit/effective period/source, va catalog inactive khong the dung cho flow moi nhung van doc duoc trong snapshot lich su
**And** ma khoan la optional nhung unique trong School khi duoc cung cap; money persist PostgreSQL `BIGINT` va REST chi tra JSON-safe integer, khong dung float.

**Given** ChargeRule cung Receivable ap dung o nhieu scope
**When** server chon rule cho Student trong CollectionRun
**Then** precedence la `STUDENT > CLASS > SCHOOL`
**And** conflict cung muc dac hieu bi tu choi, khong chon ngau nhien hoac theo client order.

**Given** Finance Manager cau hinh quantity/price/promotion policy
**When** request duoc validate
**Then** ChargeRule chi nhan `FIXED` hoac `MANUAL`; policy version co mot hoac nhieu Receivable targets, typed unit/applied quantity, fixed-VND hoac percentage, fulfillment mode, priority, stacking/exclusivity va effective period
**And** assignment, neu policy yeu cau, duoc gan cho Student theo effective interval/reason/audit; policy khong tao tong am hoac anonymous credit va khong co auto-pricing tu attendance, handover hay service enrollment.

**Given** School Admin cau hinh policy version `PREPAID_COVERAGE`
**When** activate, deactivate hoac tao version moi
**Then** server validate target unit/applied quantity, optional consecutive-period business rule, target School graph, stacking/exclusivity va effective interval
**And** version cu/coverage da issue khong bi thay doi; `StudentPromotionAssignment` la generic mechanism, khong tu suy luan quan he gia dinh.

**Given** finance API persist va tra money field
**When** unit/integration test chay calculation, catalog va Invoice fixture
**Then** VND math dung integer `BIGINT` end-to-end va REST reject/khong serialize gia tri khong JSON-safe
**And** client total khong duoc dung lam persistence authority.

### Story 5.2: Tạo CollectionRun và server-authoritative preview

As a Finance Manager,
I want to cau hinh CollectionRun va xem preview authoritative theo SchoolYear/scope/ky thu,
So that toi biet chinh xac Student nao du dieu kien, bi skip vi sao va tong tien do server tinh truoc generate.

**Acceptance Criteria:**

**Given** Finance Manager tao `MONTHLY` CollectionRun trong selected SchoolYear
**When** luu cau hinh DRAFT hoac yeu cau preview
**Then** `billingMonth` bat buoc dung `YYYY-MM` va SchoolYear chi co mot CollectionRun cho billingMonth do; UI mo run hien co thay vi tao run moi
**And** lifecycle chi cho `DRAFT -> READY -> GENERATED -> CLOSED`; rule/scope edit o DRAFT, server chi dua READY khi hop le.

**Given** Finance Manager hoac School Admin va Parent da thoa thuan truc tiep ve mot policy `PREPAID_COVERAGE` active
**When** actor chon policy version cho mot hoac nhieu Student trong preview cua `MONTHLY` run
**Then** API validate authority, policy version, SchoolYear, target applied quantity, optional consecutive-period rule, Receivable eligibility va overlap; start period luon la `billingMonth` cua run
**And** Parent khong co request/selection endpoint hoac UI; client khong tu tinh gia goc, discount, ky coverage hay total.

**Given** run o DRAFT voi rule/scope hop le
**When** Finance Manager mo preview
**Then** server dung cung selection/calculation service voi generate va tra School, period, scope, eligible rows, categorized skips gom `COVERED_BY_PROMOTIONAL_COVERAGE`, per-target promotion evaluation/reason, prior-debt context, amount composition, whole-VND totals, calculation time/version
**And** client khong gui hoac tu thay tong, eligibility, skip reason hay policy result.

**Given** preview invalid, stale hoac run state doi
**When** Finance Manager co generate
**Then** server tu choi va UI giu server error/context, quay lai edit hoac refresh preview
**And** preview/generate view dung visible School/period, keyboard stepper, accessible errors va switch guard khi form dirty.

### Story 5.3: Generate Invoice DRAFT idempotent theo snapshot roster/rule

As a Finance Manager,
I want to generate Invoice DRAFT tu READY CollectionRun qua mot Operation,
So that moi Student du dieu kien chi co mot obligation trong run va timeout khong sinh duplicate.

**Acceptance Criteria:**

**Given** CollectionRun `READY`, active School context va Idempotency-Key hop le
**When** Finance Manager xac nhan generate
**Then** transaction dung roster as-of snapshot va rule/scope snapshot tu server de tao toi da mot DRAFT Invoice cho moi Student eligible, snapshot promotion evaluation va chi bo qua cap Student/Receivable/ky co issued promotion coverage
**And** unique `(schoolId, studentId, collectionRunId)` duoc enforce; Invoice luu enrollment/class/source facts can cho lich su.

**Given** generate hoan tat, bi retry hoac mot Student khong the tao Invoice
**When** client doc Operation outcome
**Then** outcome phan loai it nhat Invoice da ton tai, enrollment khong du dieu kien, khong co Class active va khong co rule
**And** identical retry replay result; changed fingerprint conflict; timeout buoc reconcile truoc retry.

**Given** CollectionRun da `GENERATED`
**When** Finance Manager thay doi rule/scope hoac them Student
**Then** rule/scope goc bi lock; chi Student eligible chua co Invoice moi co the duoc them bang dung mot DRAFT Invoice tu rule snapshot
**And** khoan phat sinh sau Issue phai di qua source-linked adjustment/refund workflow, khong tao supplemental run hoac sua run/Invoice cu; receivable khong nam trong coverage van generate binh thuong.

### Story 5.4: Rà soát Invoice DRAFT, adjustment và promotion coverage có audit

As a Finance Manager,
I want to xem va dieu chinh Invoice DRAFT, dong thoi lap promotion coverage theo Student trong boundary duoc cap quyen,
So that exception duoc giai thich/audit truoc khi obligation bi khoa.

**Acceptance Criteria:**

**Given** Invoice dang `DRAFT` trong selected School
**When** Finance Manager override quantity, default price hoac them adjustment
**Then** server validate authority, whole-VND integer, rule/discount constraints va bat buoc note/reason audit
**And** client khong duoc set total, outstanding hoac settlement status; server tra amount composition va total authoritative.

**Given** adjustment dua tren attendance/long leave source
**When** Finance Manager xem hoac request outcome
**Then** UI hien thi immutable source, target DRAFT Invoice hoac no-target/issued/voided result va negative amount tu server
**And** khong the tao duplicate/non-source-linked automatic adjustment hoac bien attendance/handover thanh auto-pricing.

**Given** Epic 4 tra immutable adjustment eligibility source
**When** Finance materialize adjustment trong Invoice `DRAFT`
**Then** finance-only command chon target, tao negative line idempotent theo source/day/receivable va luu provenance
**And** no-target, issued/voided target hoac retry outcome duoc tra tu server; khong duplicate, rematerialize hay tu tao charge.

**Given** Finance Manager them dong `MANUAL` cho ngay thu Bay
**When** dong thu duoc validate trong Invoice `DRAFT`
**Then** server kiem tra active `StudentServiceEnrollment` cua Student bao phu ngay do
**And** dong thu bi tu choi khi khong co coverage hoac trung charge voi service da duoc cover; attendance/handover khong tu dong tinh charge.

**Given** Finance Manager hoac School Admin chon policy `PREPAID_COVERAGE` active cho Student trong preview `MONTHLY` sau thoa thuan truc tiep voi Parent
**When** API tao Invoice DRAFT duy nhat cua Student trong run
**Then** Invoice chua toan bo named future receivable-period pairs cua policy target quantity, gia goc, policy reduction/version, service interval va ly do; chi co them Receivable khong nam trong coverage cua billingMonth dang mo, khong co charge future khong lien quan
**And** API tra overlap/eligibility truoc khi tao; coverage chi issue sau khi Invoice dong `EXACT`, luu policy version/Invoice/Receipt paid provenance, reject non-positive eligible operating days va issued coverage trung Student/Receivable/ky; Parent khong co catalog, request hay selection action.

**Given** Invoice khong con DRAFT hoac School context mismatch
**When** user gui edit request
**Then** server tu choi state/capability violation va UI refresh immutable server state
**And** data table/detail hien thi VND right-aligned, state text label, source/audit context va accessible lifecycle explanation.

### Story 5.5: Issue Invoice với Payment instruction snapshot bất biến

As a Finance Manager,
I want to issue mot reviewed Invoice bang BankAccount active cua School,
So that Parent va Finance cung tham chieu mot obligation/payment instruction khong bi thay doi boi cau hinh sau nay.

**Acceptance Criteria:**

**Given** Invoice DRAFT hop le va Finance Manager chon active BankAccount cung School
**When** ho xac nhan issue voi Idempotency-Key
**Then** transaction khoa obligation content, luu source/enrollment facts va snapshot receiving bank, account number, account holder, validated transfer content, student code/class name va issued total
**And** BankAccount o School khac hoac inactive bi tu choi; timeout chi duoc retry sau Operation reconciliation.

**Given** promotion evaluation cua Invoice DRAFT da thay doi truoc Issue
**When** server re-evaluate policy, assignment, usage, stacking hoac coverage trong issue transaction
**Then** server tu choi Issue voi `PROMOTION_REVIEW_REQUIRED` va tra projection moi de Kế toán ra soat
**And** Invoice issue snapshot tung policy application/version/target/base/discount/priority/reason va assignment provenance neu co.

**Given** Invoice DRAFT cua `MONTHLY` CollectionRun co policy `PREPAID_COVERAGE` duoc chon
**When** Finance Manager issue
**Then** Invoice snapshot named coverage receivable-period pairs, gia goc, policy version/reduction, service interval va coverage source facts
**And** issued overlap cho cung Student/Receivable/ky bi tu choi va monthly CollectionRun sau do chi skip coverage facts do.

**Given** Invoice da `ISSUED`
**When** Finance Manager hoac client co sua line, quantity, price, discount, BankAccount, Payment instruction, total hoac state
**Then** server tu choi mutation; chi actual-receipt close hoac Story 5.8 revision workflow co the transition Invoice
**And** parent/client khong the set outstanding, settlement outcome, payment status hay `CANCELLED` state.

**Given** Finance Manager xem issue confirmation hay issued Invoice
**When** server tra result
**Then** UI neu ro School, Student, period, immutable obligation, Payment instruction snapshot va ledger-derived outstanding
**And** action destructive/issue co named confirmation, focus management, lifecycle conflict refresh va khong hien thi live account nhu historical snapshot.

### Story 5.6: Kiểm thử CollectionRun và Invoice issuance release gate

As a release owner,
I want automated proof cho calculation, scope, snapshot, concurrency va issue lifecycle,
So that CollectionRun/Invoice khong duplicate, tinh sai VND hoac expose du lieu cross-tenant.

**Acceptance Criteria:**

**Given** fixture co nhieu School, SchoolYear, enrollment lifecycle, rules, promotion policy versions/assignments, bank accounts va CollectionRuns
**When** unit/integration suite chay preview/generate/issue scenarios
**Then** preview va generate dung cung outcome; scope/precedence/promotion evaluation/stacking/whole-VND math, coverage overlap/skip, roster snapshot, unique Invoice va lifecycle locks deu duoc kiem tra
**And** cross-School relation/query, inactive/wrong-School bank account, client total/status injection va Invoice mutation after issue deu bi tu choi.

**Given** concurrent hoac retried generate/issue requests
**When** suite thuc hien timeout, identical retry va changed fingerprint cases
**Then** moi Student/run co toi da mot Invoice, Operation outcome duoc reconcile, audit/provenance du va duplicate post khong xay ra
**And** Finance UI E2E cho preview/generate/issue hien thi server values, switch guard, timeout reconciliation, text state, focus/error va no stale School data.

**Given** pilot performance fixture 1,000 Student
**When** CollectionRun generate chay
**Then** Operation co progress observable va hoan tat trong <= 60 giay
**And** failure tra outcome/retry-safe state, khong tra mot client-estimated success.

### Story 5.7: Đóng CollectionRun đã generate

As a Finance Manager,
I want to dong mot CollectionRun da `GENERATED` sau khi ra soat ket qua,
So that cau hinh va pham vi cua dot thu duoc khoa ro rang truoc khi chi con xem/bao cao.

**Acceptance Criteria:**

**Given** CollectionRun `GENERATED` trong selected School va Finance Manager co capability hop le
**When** Finance Manager xac nhan close voi `Idempotency-Key`
**Then** server chi transition run sang `CLOSED` khi moi Invoice trong run da `ISSUED`, `CLOSED` hoac `CANCELLED`, persist actor/reason/audit va `Operation`, replay identical retry va reconcile truoc retry sau timeout
**And** run o `DRAFT`, `READY`, da `CLOSED`, con Invoice `DRAFT`, wrong School/capability hoac changed fingerprint bi tu choi.

**Given** CollectionRun da `CLOSED`
**When** Finance hoac API co tao/sua rule, scope, Invoice hoac them Student trong run
**Then** server tu choi mutation va UI chi cho read/filter/report voi server explanation
**And** integration test chung minh lifecycle `DRAFT -> READY -> GENERATED -> CLOSED` va create/edit lock o `CLOSED`.

### Story 5.8: Revision Invoice đã phát hành và huỷ bản cũ

As a Finance Manager,
I want to prepare and issue a corrected replacement for an `ISSUED` Invoice,
So that a Parent receives the corrected obligation while the original Invoice history remains auditable.

**Acceptance Criteria:**

**Given** an `ISSUED` Invoice in the selected School needs correction
**When** Finance submits a revision request with source Invoice, reason and `Idempotency-Key`
**Then** the server creates one replacement `DRAFT` from immutable source facts with revision lineage and audit
**And** no source line, payment instruction, issue snapshot, Receipt or audit record is overwritten.

**Given** source and replacement share the same CollectionRun
**When** the server persists revision lineage
**Then** `revisesInvoiceId` must reference exactly one `CANCELLED` source of the same School, Student and run
**And** a second replacement, missing lineage or cross-School/Student/run lineage is rejected without weakening normal one-Invoice-per-Student/run generation.

**Given** the replacement DRAFT is reviewed and issued
**When** Finance confirms issue with `Idempotency-Key`
**Then** one transaction issues the replacement and changes the source Invoice to `CANCELLED`
**And** a failed, duplicate or changed-fingerprint request cannot leave both the cancelled source and replacement in an ambiguous state.

**Given** the source Invoice has a confirmed Receipt
**When** the replacement is issued
**Then** the server writes only append-only settlement-transfer provenance from source Receipt/Invoice to replacement
**And** any final shortage/excess follows Story 6.1 SettlementDifference/carry rules; it does not rewrite the original Receipt.

**Given** Parent opens the source or replacement obligation
**When** the authorized projection is returned
**Then** only the replacement is payable/current-effective and the source is not a payment target
**And** correction reason, ledger transfer and internal audit remain absent from Parent DTOs.

## Epic 6: Thu tiền, đối soát công nợ và báo cáo sổ cái

Finance ghi actual Receipt de dong Invoice, carry chenh lech sang dot thu sau, settle exact source Invoice cua policy `PREPAID_COVERAGE`, hoan tien coverage theo operating-day preview co override/audit, va doi soat toan bo bang append-only ledger.

> **Supersession (2026-09-16):** Epic 5/6 normal-settlement wording that requires exact Receipt, derives `PAID`/`VOIDED`, permits void, or rejects shortfall/excess is replaced. Finance closes exactly one normal `ISSUED` Invoice with actual received VND. The server derives `EXACT`, `SHORTFALL` or `OVERPAYMENT`, appends one source-linked SettlementDifference for a non-exact close, and only materializes its remaining amount as bounded `SHORTFALL_CARRY`/`OVERPAYMENT_CARRY` in the next eligible same-Student/School/SchoolYear MONTHLY Invoice DRAFT. No generic balance, unallocated Receipt or cross-Student/School/SchoolYear carry exists. An issued-content correction prepares/issues a replacement and atomically changes the source to `CANCELLED`; source snapshots and confirmed Receipt remain immutable, with any replacement settlement represented only by append-only transfer provenance.

### Story 6.1: Ghi actual Receipt, dong Invoice va carry chenh lech

As a Finance Manager,
I want to ghi so tien thuc nhan va dong mot Invoice cua mot Student,
So that phan thieu hoac thua duoc truy vet va dua sang dot thu sau thay vi bi mat hoac thanh so du chung.

**Acceptance Criteria:**

> **Superseded acceptance (2026-09-16):** The following exact multi-Invoice criteria are replaced by this contract.

**Given** Finance Manager selects one `ISSUED` Invoice in the selected School
**When** they enter the verified actual amount received and confirm with an `Idempotency-Key`
**Then** one transaction appends the Receipt, closes that Invoice and derives server-side `EXACT`, `SHORTFALL` or `OVERPAYMENT`
**And** client cannot set status, difference or carry, and duplicate/concurrent close attempts replay or reject through the same Operation.

**Given** actual Receipt differs from the issued amount
**When** the Invoice closes
**Then** the server appends exactly one immutable SettlementDifference linked to that Invoice and Receipt: positive for shortfall and negative for overpayment
**And** it creates no unallocated Receipt, generic balance, StudentPrepayment or cross-Student/School/SchoolYear entitlement.

**Given** a later eligible `MONTHLY` CollectionRun generates a DRAFT Invoice for that same Student, School and SchoolYear
**When** Finance views/generates the DRAFT
**Then** the server materializes the remaining source difference as `SHORTFALL_CARRY` or `OVERPAYMENT_CARRY` with source provenance
**And** an overpayment carry is capped so target Invoice total never becomes negative; any remainder stays source-linked for a later eligible run and cannot be manually applied twice.

**Given** Finance reviews an actual-receipt close or carry result
**When** the UI renders
**Then** it shows server-returned issued amount, actual receipt, outcome, difference and next-run carry status with Operation reconciliation after timeout
**And** neither UI nor Parent can alter finance posting, carry amount or lineage.


### Story 6.2: Dong exact Invoice co promotion coverage

As a Finance Manager,
I want to dong exact Invoice cua policy `PREPAID_COVERAGE` trong `MONTHLY` CollectionRun,
So that toan bo cac ky tuong lai da mua chi duoc cover sau khi School nhan dung so tien da issue va khong tao generic credit.

**Acceptance Criteria:**

**Given** Finance Manager chon Invoice `ISSUED` cua `MONTHLY` CollectionRun co future coverage facts
**When** ho submit Receipt bang dung outstanding cua Invoice do
**Then** transaction post Receipt/Allocation append-only, source Invoice dong `CLOSED` voi outcome `EXACT` va issue `StudentPromotionalCoverage` cho tung receivable-period fact da snapshot
**And** coverage luu policy version, Invoice/Receipt paid provenance, gia goc, reduction, service interval, calendar version/timezone va chi monthly run sau do skip fact issued nay.

**Given** Receipt khong bang exact outstanding cua Invoice, Invoice `CANCELLED`, policy version/SchoolYear khong hop le, fact overlap hoac concurrent posting da doi state
**When** Finance Manager submit
**Then** server tu choi entire posting va khong issue coverage hay generic balance
**And** request bat buoc `Idempotency-Key`, persist `Operation` va reconcile truoc retry; client amount injection, partial, excess, cross-Student/cross-School/cross-SchoolYear use deu bi tu choi.

**Given** Finance mo Invoice detail co promotion coverage
**When** settlement control render
**Then** UI hien immutable policy version, covered months/Receivables, original price, reduction, exact outstanding, coverage issue outcome va as-of state
**And** khong co Parent selection/payment action, generic balance editor hay partial-payment affordance.

### Story 6.3: Correction và hoàn tiền promotion coverage theo operating-day preview

As a School Admin or Finance Manager,
I want to tao correction va refund review co source/audit, bao gom promotion coverage khi Student nghi, chuyen truong hoac huy dich vu hop le,
So that sai sot va phan coverage chua su dung duoc xu ly nhat quan ma khong sua ledger lich su.

**Acceptance Criteria:**

**Given** Student withdrawal, transfer hoac eligible service cancellation co issued, paid `StudentPromotionalCoverage` con ky bao phu
**When** authorized actor yeu cau refund preview
**Then** server dung tung coverage fact co Receivable/period/service interval nam tron trong ky, paid snapshot amount va School calendar version/timezone da snapshot de tra coverage/Invoice/Receipt source, `eligibleOperatingDays`, `remainingOperatingDays` loai tru withdrawal effective date, va `calculatedAmount` VND
**And** moi fact reject neu `eligibleOperatingDays <= 0`, `remainingOperatingDays` khong vuot eligible days, va tong `calculatedAmount` bang tong `floor(paidSnapshotAmount * remainingOperatingDays / eligibleOperatingDays)` nhung khong vuot paid source con lai sau refund/reversal; khong dung catalog/policy hien hanh hoac client calculation.

**Given** School Admin hoac Finance Manager sua `approvedAmount` khac `calculatedAmount`
**When** ho submit refund request
**Then** server yeu cau override reason, validate `approvedAmount` khong am va khong vuot paid source con lai cua tung fact, luu calculated/approved amount, actor, coverage/Invoice/Receipt provenance va Idempotency Operation
**And** request van di qua `DIRECT` hoac `SCHOOL_ADMIN_APPROVAL`; requester khong self-approve trong two-step mode.

**Given** Receipt, Allocation hoac coverage da issue co sai sot, hoac refund co source hop le
**When** School Admin hoac Finance Manager tao reversal/refund request voi amount va reason
**Then** server validate source/available limit, tao posting/request append-only co Idempotency Operation va khong sua record goc
**And** `DIRECT` cho actor duoc quyen post; `SCHOOL_ADMIN_APPROVAL` yeu cau Finance Manager request va School Admin khac actor approve/refuse, khong self-approve.

**Given** refund duoc post, refused, retry hoac source da co correction
**When** Finance xem source/result
**Then** refund la append-only va khong sua Invoice, Receipt, Allocation hay coverage goc
**And** duplicate/cross-School/cross-Student/excess-source refund bi tu choi, UI refresh outcome server-confirmed.

**Given** correction/refund request pending, refused, approved hoac posted
**When** requester hay approver mo ledger correction dialog
**Then** UI hien immutable source, amount/reason, available impact, required approver va server-confirmed state
**And** direct post, approval va refusal deu bat buoc `Idempotency-Key`, persist `Operation` va reconcile truoc retry; requester khong thay approve action trong two-step policy va khong double post.

### Story 6.4: Chuyển prior debt và year-end settlement an toàn

As a Finance Manager,
I want to dua prior debt con mo vao obligation trong cung SchoolYear va xu ly settlement cuoi nam co audit,
So that cong no duoc thu dung mot lan va khong tu carry sang nam hoc moi.

**Acceptance Criteria:**

**Given** Invoice/source obligation co outstanding hop le trong cung SchoolYear
**When** Finance Manager tao debt transfer vao Invoice moi
**Then** transaction append-only tao `PRIOR_DEBT` traceable va atomically giam outstanding nguon truoc khi target duoc expose
**And** request bat buoc `Idempotency-Key`, persist `Operation` voi actor/reason/fingerprint, dung shared finance posting lock va reconcile truoc retry; retry/concurrent request khong tao double collection hoac source/target cross-School/cross-SchoolYear.

**Given** target Invoice co `PRIOR_DEBT` duoc thanh toan
**When** Finance post Receipt
**Then** target dong theo actual-receipt contract va moi shortfall/overpayment tao SettlementDifference/carry co source
**And** khong co client-side carryover, generic balance hay double collection cua debt source.

**Given** SchoolYear ket thuc
**When** Finance xem debt/open balances
**Then** system khong auto-carryover sang SchoolYear moi
**And** write-off, adjustment hoac payment phai la workflow audited rieng, khong sua truc tiep balance.

### Story 6.5: Báo cáo finance reconcile từ ledger

As a Finance Manager,
I want to xem bon workspace report va CSV scoped theo School/run/period/group/class/status tu ledger,
So that toi doi soat duoc gross, promotion discount/refund, receipt, allocation, coverage va outstanding.

**Acceptance Criteria:**

**Given** Finance Manager hoac School Admin co quyen chon School context va report period/filter hop le
**When** API tao report
**Then** server authorize membership truoc aggregate lookup va aggregate ledger/snapshot theo School, CollectionRun, period, ReceivableGroup, Class va status trong mot trong bon workspace: overview, run reconciliation, outstanding/debt hoac cash/adjustment ledger
**And** response tra `asOf`, `generatedAt`, `Asia/Ho_Chi_Minh`, normalized filter va report-definition version; chi ledger event posted khong muon hon `asOf` duoc tinh, billed nhom theo Invoice `billingMonth`, cash nhom theo Receipt/refund/reversal posting time
**And** totals tach rieng gross, promotion discount theo policy/version, refund, net billed, actual Receipt, settlement outcome, open/materialized SettlementDifference, carry adjustment, revision/cancellation, coverage va outstanding bang VND integer.

**Given** promotion coverage hoac coverage refund ap dung
**When** report/detail duoc tao
**Then** report giu coverage/refund source provenance theo contract
**And** reversal/refund hien theo posting time; revision/cancellation giu audit lineage nhung obligation total chi tinh current-effective Invoice server projection, va source catalog, Student/Class, policy hoac BankAccount da doi sau posting khong rewrite finance lich su.

**Given** authorized actor da nhan report result
**When** ho yeu cau CSV
**Then** API tao CSV tu dung result/filter da authorize, kem `asOf`, timezone, filter va definition version; request/download duoc audit, file reference opaque va het han, download re-authorize School membership
**And** cross-School filter/object access, CSV client-side, Parent/Payroll data va PDF/XLSX/scheduled export deu bi tu choi.

**Given** khong co ledger activity khop filter, report load/error hoac responsive view
**When** Finance UI render
**Then** UI giu School/period/filter, neu khong co hoat dong thay vi xac nhan "0 collected" khong co as-of context
**And** VND right-align, table caption/keyboard access, server error and accessible empty/loading/expired-export states; khong co period close/reopen, custom dashboard/report hay Payroll report trong release nay.

### Story 6.6: Release gate cho actual Receipt, carry và promotion coverage refund

As a release owner,
I want automated proof rang moi posting va report reconcile dung duoi retry/concurrency,
So that duplicate posting, cross-tenant settlement hoac report sai khong vao pilot.

**Acceptance Criteria:**

**Given** PostgreSQL fixture co nhieu School/Student/Invoice/Receipt, `MONTHLY` CollectionRun, policy version, coverage va ledger state
**When** integration suite chay settlement, reversal/refund, debt transfer va report scenarios dong thoi
**Then** one-Invoice actual close produces exact, shortfall and overpayment outcomes once; unallocated, cross-School and duplicate posting are rejected
**And** next-run carry is bounded, source-linked, same-Student/School/SchoolYear and never duplicated; Invoice co future coverage facts chi dong `EXACT` va issue coverage khi `CLOSED`; generic balance va `Student Prepayment` deu bi tu choi; lock order, append-only history va Operation idempotency deu duoc kiem tra.

**Given** issued promotion coverage va withdrawal/transfer/eligible-service-cancellation fixture
**When** suite chay coverage/refund scenarios
**Then** overlap bi chan, monthly run chi skip covered receivable-period, operating-day calculation loai tru withdrawal date va floor VND dung
**And** paid-source gate, service interval/calendar snapshot, non-positive denominator, SchoolYear boundary, remaining refund limit, override cap/reason, approval outcome va append-only coverage/Invoice/Receipt provenance deu duoc kiem tra.

**Given** Finance portal E2E chay settlement/correction/report flows
**When** user gap concurrent state change, timeout, policy approval boundary, no-data hoac School switch
**Then** UI refresh server limits/state, vao Operation reconciliation, khong double submit va giu accessible source/error/as-of context
**And** report fixture prove event truoc/sau `asOf`, reversal/refund, revision/cancellation, carry, debt va coverage reconcile nhat quan giua bon workspace; CSV chi co dung server result/metadata, audit va deny cross-School/expired/revoked download
**And** Epic 6 khong complete neu reconciliation fixture hoac ledger concurrency suite con fail.

## Epic 7: Parent portal đa trường, read-first

Parent dung PWA mobile-first de xem dung Student duoc uy quyen, attendance/DailyJournal/inbox, gui leave request khi con `PENDING`, va xem obligation hieu luc `ISSUED`/`CLOSED` cung Payment instruction snapshot. Parent khong co finance policy/coverage, refund hay operational mutation.

### Story 7.1: Khởi tạo Parent context đa trường an toàn

As a Parent,
I want to dang nhap truc tiep vao dung School co Student duoc lien ket active,
So that toi chi vao duoc portal context co du lieu con minh duoc uy quyen.

**Acceptance Criteria:**

**Given** Google identity da bind ParentProfile
**When** Parent hoan tat Parent audience callback
**Then** server recheck active `StudentParent` truoc khi cap Parent session
**And** neu khong con active link o bat ky School nao, server tu choi session va portal chi hien safe signed-out/access-denied state.

**Given** ParentProfile co active StudentParent link tai dung mot School
**When** Parent session duoc cap
**Then** portal di thang vao Parent home cua School do
**And** khong render School chooser hoac yeu cau Parent nhap/chon School.

**Given** ParentProfile co active StudentParent links tai nhieu School
**When** Parent session duoc cap
**Then** portal hien chooser chi gom cac School dang co active link
**And** selected School sau do van phai duoc `ParentSchoolContext` re-authorize tai moi request.

**Given** Parent chuyen School, logout, session expiry, `401` hoac StudentParent link bi revoke
**When** protected navigation hoac foreground return dien ra
**Then** app xoa protected memory/query state truoc khi render context khac
**And** neu khong con active School nao thi chuyen ve safe signed-out/access-denied state; neu con nhieu School thi ve chooser.

### Story 7.2: Parent xem Today, attendance và DailyJournal được ủy quyền

As a Parent,
I want to xem trang thai attendance va DailyJournal hom nay/theo ngay cua tung con duoc uy quyen,
So that toi biet truong da ghi nhan gi ma khong thay du lieu noi bo hoac cua tre khac.

**Acceptance Criteria:**

**Given** ParentSchoolContext hop le va active StudentParent link cho tung Student duoc tra ve
**When** Parent mo home hoac child attendance history
**Then** API list/detail join va filter active `StudentParent` cho dung tung `studentId`
**And** DTO chi co `studentId`, Student display-name snapshot, date, `PRESENT`/`ABSENT`/`ON_LEAVE`/`NOT_RECORDED` va necessary updated time.

**Given** ParentSchoolContext hop le, active StudentParent link va DailyJournal current version trong operational retention
**When** Parent mo Today hoac child detail theo ngay
**Then** API re-authorize tung requested/returned `studentId` va tra DTO journal rieng gom Student display-name snapshot, journal date, current text, updated time va protected media metadata toi thieu
**And** media chi tai qua request duoc re-authorize, khong preload/cache, khong co permanent URL, Teacher identity, Class facts, audit/version history hay attendance evidence.

**Given** attendance chua duoc ghi trong ngay van hanh
**When** Parent xem Today card hoac date history
**Then** UI hien "Truong chua ghi nhan" voi neutral state, khong goi do la vang mat
**And** holiday/non-operating date co calendar label, khong suy dien missing attendance.

**Given** Parent co truy cap attendance/journal cua Student khac, Teacher/internal reason, attendance evidence, journal audit/media khong duoc cap quyen hoac class data
**When** server hoac deep-link resolver xu ly request
**Then** request bi tu choi hoac safe-fallback truoc khi protected content render
**And** Parent khong co attendance/journal edit affordance, endpoint hoac cached alternate data.

### Story 7.3: Parent inbox attendance có re-authorization

As a Parent,
I want to nhan va mo in-app attendance notification cho dung con va ngay,
So that toi theo doi cap nhat gan day ma revoke khong lam lo event cu.

**Acceptance Criteria:**

**Given** Epic 4 da emit one idempotent attendance event source
**When** Parent inbox query chay
**Then** `parent-portal` chi project/read event cho ParentProfile co active `StudentParent` link tai read/delivery time
**And** event DTO chi co School context, child display-name snapshot, text event, date/time va unread/read state; khong co Staff, reason, evidence hoac media.

**Given** Parent mo notification hoac app nhan deep link
**When** destination resolver re-authorizes School, Student va retention
**Then** app chi mo authorized child/date history hoac safe inbox fallback
**And** previous child/date content bi xoa truoc khi denied/revoked destination duoc trinh bay.

**Given** event qua 30 ngay, Parent link bi revoke hoac data vuot operational retention
**When** inbox/list/detail duoc truy van
**Then** event/data khong con tra ve va unread badge chi tinh event con authorized
**And** khong co SMS, email, Zalo hoac chat delivery.

### Story 7.4: Parent tạo và quản lý leave request được phép

As a Parent,
I want to tao, sua hoac huy leave request con `PENDING` cho con duoc uy quyen,
So that toi thong bao nghi hoc ma khong thay doi workflow noi bo hoac finance.

**Acceptance Criteria:**

**Given** ParentSchoolContext va active StudentParent link hop le
**When** Parent tao leave request tu child detail
**Then** server kiem tra Student authorization, calendar, enrollment va leave policy, tao request bang ParentProfile actor context cung Idempotency-Key
**And** Parent chi thay result `PENDING`, approved hoac rejected, khong thay deadline, approval internals hoac Staff identity.

**Given** Parent leave request con `PENDING`
**When** Parent sua hoac huy request
**Then** server cho phep mutation chi cho ParentProfile/Student context da tao va audit/Operation reconciliation ap dung
**And** request da approved/rejected, cross-School/cross-Student ID, missing CSRF/origin hoac changed idempotency fingerprint deu bi tu choi.

**Given** attendance da confirmed `PRESENT`, ngay khong hoat dong hoac server tra conflict
**When** Parent submit/modify leave request
**Then** UI giu input/server response, focus accessible error va khong noi leave da tao hay finance adjustment se xay ra
**And** Parent khong the tao long-leave approval, service cancellation hoac attendance mutation.

**Given** ParentSchoolContext va active StudentParent link hop le
**When** Parent khoi tao long leave cho Student tu child detail
**Then** server tao source request bang ParentProfile actor context, School/Student scope va `Idempotency-Key`, de School Admin duyet/tu choi effective date sau do
**And** Parent chi xem request state/result, khong tu chon effective date, approve/refuse, huy service hay tao finance adjustment; timeout vao Operation reconciliation.

### Story 7.5: Parent tự cập nhật số điện thoại có audit

As a Parent,
I want to cap nhat so dien thoai cua minh trong Parent portal,
So that School co thong tin lien lac hien hanh ma quyen va lien ket cua toi van duoc bao toan.

**Acceptance Criteria:**

**Given** Parent session hop le va ParentProfile da bind
**When** Parent cap nhat so dien thoai hop le
**Then** server chi thay doi so dien thoai cua bound ParentProfile va luu old/new value, actor, timestamp va audit
**And** Parent khong the sua Google identity, email binding, StudentParent link, School context hay quyen cua minh.

**Given** Parent submit phone update voi missing CSRF/origin, session/revoke khong hop le hoac validation error
**When** server xu ly mutation
**Then** request bi tu choi truoc khi cap nhat va UI hien field error accessible
**And** timeout dung Idempotency Operation reconciliation, khong ghi trung hoac giu protected state sau revoke.

### Story 7.6: Parent xem obligation hiệu lực và Payment instruction snapshot

As a Parent,
I want to xem Invoice hieu luc va payment instruction snapshot cho dung Student,
So that toi co the thuc hien thanh toan ngoai he thong ma khong thay doi trang thai finance.

**Acceptance Criteria:**

**Given** Parent authorized cho Student va Invoice hieu luc `ISSUED` con outstanding hoac `CLOSED` trong retention
**When** Parent mo obligation detail
**Then** API tra minimum read model gom obligation code, period, issued Invoice total snapshot, server-derived actual Receipt/outcome/current outstanding VND, state/update time, receiving bank, account number, account holder va transfer content
**And** issued total/current outstanding duoc label rieng; API khong tra audit noi bo, live account, data tre khac hoac finance source khong can thiet.

**Given** Invoice `CANCELLED`, Invoice khong con hieu luc, hoac vuot Parent finance retention
**When** Parent list/detail duoc tai
**Then** Payment instruction/payment invitation khong duoc hien thi
**And** Parent khong thay SettlementDifference, carry, Receipt/allocation detail, correction reason, promotion coverage, refund control, "I paid", VietQR, copy-field hoac bank deep-link action.

**Given** issued Invoice da duoc settle nhung coverage refund lien quan van chua settlement trong Parent finance retention
**When** Parent xem finance history authorized cho Student
**Then** API giu minimum read model can thiet cua issued obligation va settlement/refund state cho toi khi coverage refund deu settled
**And** DTO khong lo Receipt/allocation detail, audit noi bo, promotion coverage source, live account hay bat ky Parent finance mutation nao.

**Given** Parent thay route, Student link revoke hoac School context khong con hop le trong luc xem obligation
**When** API/deep-link re-authorizes
**Then** protected content bi xoa va app chuyen safe chooser/inbox/signed-out state
**And** Parent khong co POST mutation cho Receipt, payment confirmation, package selection hay refund.

### Story 7.7: Parent PWA accessibility, retention và cross-school release gate

As a release owner,
I want automated proof cho Parent authorization, retention, payment read model va mobile accessibility,
So that Parent portal khong leak du lieu tre em hoac finance va van dung duoc tren thiet bi chinh.

**Acceptance Criteria:**

**Given** fixture co Parent voi nhieu Student/School, active/revoked links, attendance events, Invoice `ISSUED`/`CLOSED`/`CANCELLED`, replacement lineage, promotion coverage va refunds
**When** API/PostgreSQL integration va Parent E2E suites chay
**Then** cross-School/cross-Student route, UUID, filter, deep-link, finance-field, attendance evidence, unauthorized journal media/audit va Parent mutation attempt deu bi tu choi
**And** recheck per returned/requested `studentId`, revoke, expiry, 30-day operational retention cua attendance/journal va finance retention deu pass.

**Given** Parent PWA load, navigate, receive `401`, go offline hoac render empty/error state
**When** accessibility/mobile checks chay
**Then** one route `h1`, text status, 44x44px targets, keyboard/focus management, screen-reader error behavior, no-hover dependency, no protected service-worker caching va safe state clearing deu pass
**And** offline khong queue hoac gia vo hoan tat mutation.

**Given** Parent opens payment instruction or notification
**When** state is unauthorized, expired, obsolete `CANCELLED`, revoked or retention-expired
**Then** app hides protected detail/action and renders server-confirmed safe fallback
**And** Epic 7 khong complete neu Parent cross-school, retention, notification re-authorization hoac payment read-model test con fail.

### Story 7.8: Pilot performance và accessibility release gate

As a release owner,
I want fixture-based performance va WCAG verification cho ca bon portal truoc pilot,
So that latency va kha nang su dung khong duoc suy doan tu happy path.

**Acceptance Criteria:**

**Given** acceptance fixture va telemetry harness da duoc cau hinh
**When** read API, CollectionRun preview va finance report benchmark chay trong target pilot topology
**Then** P95 read API <= 500 ms, preview/report <= 3 s, va CollectionRun generate 1,000 Student <= 60 giay voi Operation progress observable
**And** benchmark report luu fixture, environment, timing va failure outcome; client khong tu claim success khi server chua terminal.

**Given** Admin, Teacher, Ops va Parent portal routes/components trong release
**When** WCAG 2.1 AA automated va manual keyboard/screen-reader verification chay
**Then** contrast, text status, heading/route focus, dialog focus, table semantics, responsive treatment va Parent 44x44 touch target deu pass theo UX contract
**And** blocked finding la release gate; khong portal nao duoc mien tru chi vi khong phai Parent.

## Epic 8: Payroll entitlement, workforce và policy foundation

### Story 8.1: Payroll entitlement và pilot admission theo School

As a Platform Operator,
I want to admit, suspend va retire Payroll theo tung School,
So that feature thu nghiem khong mo cho tenant chua san sang va khong mat lich su khi dung.

**Acceptance Criteria:**

**Given** School chua duoc Payroll entitlement
**When** actor goi direct Payroll/workforce/timekeeping route, job hoac UUID cua resource
**Then** server tu choi truoc aggregate access va navigation/discovery khong expose feature
**And** entitlement khong tu cap role hay capability.

**Given** Ops chuyen School qua `PILOT_ENABLED`, `ENABLED`, `SUSPENDED` hoac `RETIRED`
**When** mutation duoc submit/retry
**Then** state, actor, rollout version, reason va Operation audit duoc persist idempotent
**And** suspend/retire bi chan, tra blocker ro rang neu con import, approved unpaid run, advance reservation hoac payout can resolve.

**Given** School `SUSPENDED` hoac `RETIRED`
**When** actor authorized doc lich su Payroll
**Then** approved/paid record va audit duoc giu read-only theo policy
**And** khong co job hay mutation moi lam thay doi Payroll data.

### Story 8.2: EmploymentContract và compensation terms effective-dated

As an authorized School operator,
I want to quan ly dieu khoan lao dong theo thoi gian hieu luc,
So that luong thu viec, luong co ban, muc dong bao hiem va phu cap duoc snapshot dung ky.

**Acceptance Criteria:**

**Given** School co Payroll enabled va actor co `WORKFORCE_MANAGE`
**When** actor tao/sua EmploymentContract hoac CompensationTerm
**Then** server validate School scope, `[effectiveFrom, effectiveTo)`, khong overlap term cung loai va luu reason/audit
**And** base salary, probation salary/rate, insurance salary base va fixed allowance la cac gia tri doc lap.

**Given** term da duoc Payroll calculated snapshot tham chieu
**When** actor can sua gia tri qua khu
**Then** server tu choi overwrite va chi cho phep them term revised effective-dated
**And** cross-School Staff/contract reference bi tu choi trong transaction.

### Story 8.3: Typed PayrollPolicyVersion và capability governance

As a School Admin,
I want to quan ly version policy luong co schema ro rang,
So that API tinh nhat quan ma khong cho phep cong thuc tuy y.

**Acceptance Criteria:**

**Given** Payroll enabled School
**When** School Admin tao effective PayrollPolicyVersion
**Then** server chi nhan typed schema cho attendance bonus, late-care rate, insurance rate/cap, PIT bracket/reduction va thirteenth-month policy
**And** JavaScript, SQL, Excel formula va arbitrary expression bi tu choi.

**Given** policy da duoc Payroll snapshot
**When** policy moi duoc effective
**Then** policy cu giu immutable provenance va policy moi khong rewrite calculation history
**And** policy/capability mutation co audit, reason va tenant-isolation integration proof.

## Epic 9: Chấm công nhân sự và ca trông muộn

### Story 9.1: Mapping mã máy và import preview/commit

As a Finance Manager acting as Accountant,
I want to upload va preview file CSV/XLSX may cham cong,
So that toi resolve duoc ma may, loi dong va duplicate truoc khi raw event duoc dung.

**Acceptance Criteria:**

**Given** Payroll enabled School va actor co `TIMEKEEPING_IMPORT`
**When** upload file chua machine code, source name, timestamp va IN/OUT
**Then** server tao batch `UPLOADED -> PREVIEWED`, tra row-level parse/mapping errors va khong tao usable event truoc commit
**And** source name chi la evidence; mapping effective-dated machine code chi active voi mot Staff trong School/source tai mot thoi diem.

**Given** preview valid hoac da resolve row error
**When** actor commit idempotent batch
**Then** raw event append-only co batch/source provenance va dedupe duoc enforce
**And** committed batch khong silently delete; draft batch co the discard/replace co audit.

### Story 9.2: Review ngày công và correction thủ công

As a Finance Manager acting as Accountant,
I want to review ket qua ngay cong tu raw event va correction,
So that Payroll dung source fact da kiem tra thay vi suy dien lai tu may.

**Acceptance Criteria:**

**Given** common School work schedule policy va raw event hop le
**When** server materialize workday
**Then** ket qua la `PRESENT`, `LATE`, `EARLY_LEAVE`, `PAID_LEAVE`, `UNPAID_LEAVE`, `ABSENT_UNEXCUSED` hoac `MANUAL`, giu policy/source facts
**And** MVP chi materialize full workday, khong half-day/hourly.

**Given** thieu/sai raw event va Finance Manager Accountant hoac School Admin co `TIMEKEEPING_REVIEW`
**When** actor them StaffTimeCorrection hoac review outcome
**Then** correction co reason/actor/audit va khong update raw event goc
**And** approved Payroll source lock duoc enforce; correction muon phai di qua reopen/correction Payroll flow.

### Story 9.3: Xác nhận ca trông muộn

As either a Finance Manager acting as Accountant or a School Admin,
I want to xac nhan Staff theo ngay/ca trong muon,
So that phu cap trông muộn co source ro rang de tinh luong.

**Acceptance Criteria:**

**Given** Payroll enabled School, late-care shift definition hop le va mot Finance Manager Accountant hoac School Admin co `LATE_CARE_MANAGE`
**When** actor tao/xac nhan LateCareShiftAssignment
**Then** server validate Staff/School/date/shift, luu confirmation/audit va expose source fact cho Payroll snapshot
**And** handover record, IN/OUT presence hoac checkout muon khong tu dong tao payable assignment.

## Epic 10: Payroll thường kỳ, phê duyệt và payout

### Story 10.1: Calculate Payroll versioned từ snapshot

As a Finance Manager acting as Accountant,
I want to calculate regular Payroll tu contract, reviewed workday va policy snapshot,
So that tung component co the giai thich va doi soat voi Excel.

**Acceptance Criteria:**

**Given** Payroll enabled School, period va source facts hop le
**When** Finance Manager co `PAYROLL_PREPARE` calculate bang `Idempotency-Key`
**Then** server transactionally tao PayrollRunVersion va mot entry per eligible Staff, snapshot input/policy/calculator version/component VND
**And** tinh base/probation salary, paid/unpaid leave, attendance bonus, fixed/late-care allowance, insurance, PIT, advance va manual adjustment theo typed policy.

**Given** source/policy thay doi truoc approval
**When** Finance Manager co `PAYROLL_PREPARE` recalculate
**Then** version draft moi thay the current draft ma khong overwrite version da co audit
**And** browser khong set total, component hay net payable authority.

### Story 10.2: Reconcile, approve và reopen unpaid Payroll

As a Finance Manager acting as Accountant and a separate School Admin,
I want to reconcile va phe duyet Payroll theo separation of duties,
So that bang luong chi khoa sau khi nguoi co tham quyen ra soat.

**Acceptance Criteria:**

**Given** PayrollRunVersion calculated va Finance Manager co `PAYROLL_RECONCILE`
**When** actor them override/adjustment co ly do de reconcile
**Then** component co reason/reference/audit va hien ro trong approval review
**And** submit current version chi duoc phep khi cung actor co `PAYROLL_PREPARE`; submit la idempotent Operation va chuyen version sang `SUBMITTED`.

**Given** PayrollRunVersion `SUBMITTED`
**When** School Admin co `PAYROLL_APPROVE` review de approve hoac refuse
**Then** UserIdentity approver phai khac moi preparer/material editor va submitter; server tu choi cung identity ke ca khi actor co nhieu grant
**And** submit/approve/refuse timeout phai reconcile Operation truoc retry; refusal giu submitted version bat bien va mo revision path co audit.

**Given** approved version chua payout
**When** School Admin co `PAYROLL_REOPEN` reopen co reason
**Then** approved version van immutable/audited, advance reservation duoc release va current draft version moi duoc tao
**And** reopen timeout phai reconcile Operation truoc retry.

### Story 10.3: Payroll payout và đối soát báo cáo

As a Finance Manager acting as Accountant,
I want to confirm payout va xem report component/source,
So that tien da chi va expected Excel result co the doi soat.

**Acceptance Criteria:**

**Given** approved Payroll entry
**When** Finance Manager co `PAYROLL_PAYOUT_CONFIRM` record payout sau approval
**Then** server luu paid amount/date/method/reference/note idempotent va atomically giam reserved SalaryAdvance balance
**And** School Admin khong duoc xac nhan payout; paid version khong the reopen hoac mutate.

**Given** Payroll fixture anonymized
**When** report/reconciliation suite chay
**Then** tung component/source/policy snapshot va total reconcile voi expected Excel output
**And** duplicate calculate/approve/payout bi tu choi/replay dung Operation outcome.

## Epic 11: Payroll correction và lương tháng 13

### Story 11.1: Correction run cho Payroll đã chi

As a Finance Manager acting as Accountant and a separate School Admin,
I want to post correction delta cho Payroll da chi,
So that sai sot duoc sua ngay ma khong rewrite lich su.

**Acceptance Criteria:**

**Given** Payroll version da `PAID`
**When** Finance Manager co `PAYROLL_PREPARE` tao va submit correction voi source version, delta duong/am va reason
**Then** server tao correction run rieng, snapshot provenance va khong sua Payroll goc
**And** School Admin co `PAYROLL_APPROVE` va identity khac moi preparer/material editor cung submitter approve/refuse; sau approve Finance Manager co `PAYROLL_PAYOUT_CONFIRM` xac nhan payout, dung transaction/idempotency/audit nhu Payroll thuong.

### Story 11.2: Kỳ lương tháng 13 riêng

As a Finance Manager acting as Accountant,
I want to create `THIRTEENTH` Payroll period/run rieng,
So that luong thang 13 khong lam sai lifecycle payroll thang 12.

**Acceptance Criteria:**

**Given** typed thirteenth-month policy effective
**When** Finance Manager co `PAYROLL_PREPARE` calculate period `THIRTEENTH`
**Then** server dung fixed hoac eligible-month proportional rule duoc policy cho phep va snapshot input
**And** approval/payout/correction workflow giong Payroll regular nhung khong duplicate hay mutate regular monthly period.
