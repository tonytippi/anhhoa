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
---

# PassionEdu - Epic Breakdown

## Overview

Tai lieu nay phan ra initiative PassionEdu da truong thanh cac epic va story co the trien khai. PRD PassionEdu, Architecture Spine, SPEC va UX spines la nguon quyet dinh. Hai artifact epic Anh Hoa legacy duoc giu nguyen de truy vet va khong mo ta pham vi thay the nay.

## Requirements Inventory

### Functional Requirements

FR-1: Platform Operator provision, suspend/reactivate School va bootstrap School Admin dau tien theo email, khong co quyen du lieu nghiep vu mac dinh.

FR-2: Identity co the co membership/role khac nhau o nhieu School; Admin/Staff chon School qua chooser/switcher va server cap quyen theo membership/capability active cho moi request.

FR-3: Moi aggregate, query, unique constraint, audit va Operation nghiep vu deu School-scoped, khong the truy cap cheo tenant qua URL, UUID, filter, header hay client state.

FR-4: School Admin quan ly School profile, calendar va typed, versioned finance/Parent/attendance/handover policies theo effective date, audit va ly do khi can.

FR-5: School Admin quan ly mot SchoolYear active, Class, Student va StudentEnrollment lifecycle; chuyen lop/chuyen nam/close-year bao toan lich su enrollment, snapshot va audit.

FR-6: School Admin quan ly Parent-Hoc sinh link active/revoked, Parent pending binding va Staff profile/assignment effective-dated ma khong tu cap Staff login hay role.

FR-7: Finance Manager hoac School Admin quan ly receivable catalog, discount, ChargeRule va Student promotional coverage scoped theo School, co precedence, effective period va immutable historical snapshot.

FR-8: Finance Manager tao CollectionRun, xem server-authoritative preview va generate Invoice DRAFT idempotent theo lifecycle va eligibility/skip policy.

FR-9: Finance Manager issue Invoice DRAFT voi audited override/adjustment, active BankAccount va immutable obligation/Payment instruction snapshot; server so huu VND total, outstanding va settlement state.

FR-10: Finance Manager ghi exact Receipt settlement va exceptional Student Prepayment; sua sai bang append-only reversal/refund co policy approval, reason, audit va idempotency.

FR-11: He thong gop prior debt trong cung SchoolYear mot cach truy vet, settlement year-end va bao cao ledger theo gross, discount/refund, receipt, allocation, Prepayment va outstanding.

FR-12: Parent gui leave request cho Student duoc uy quyen; Staff co capability ghi attendance va handover; Admin/Finance quan ly service enrollment; Finance chi tao meal adjustment source-linked, khong tu dong tinh fee.

FR-13: Authorized Staff ghi handover picked-up time theo policy lam operational reference co audit, khong tu dong tao late-pickup fee hoac pickup authorization.

FR-14: Parent dung portal multi-School de xem dung Student duoc active link uy quyen, attendance history DTO toi thieu va in-app notification 30 ngay; revoke/session expiry xoa protected state va Parent khong mutate attendance.

FR-15: Parent xem read-only `ISSUED` Invoice obligation va Payment instruction snapshot khi con outstanding; Parent khong post Receipt, xac nhan payment, chon uu dai/refund hay sua finance, va khong co VietQR/copy/deep link trong release nay.

### NonFunctional Requirements

NFR-1: API la nguon chan ly cho authorization, policy, money VND integer, snapshots, transitions, report va Parent DTO; ba portal React/Vite chi goi REST va session/audience cach ly.

NFR-2: Cookie-auth mutation dung origin validation va double-submit CSRF; workflow high-impact dung UUID Idempotency-Key va GET Operation reconciliation truoc retry sau timeout.

NFR-3: Child/Parent data dung minimum DTO, server-side authorization, revoke/status thay hard delete, audit va retention; Parent protected response khong service-worker cache.

NFR-4: VND luu PostgreSQL BIGINT va REST safe JSON integer; issued obligation/instruction immutable, finance posting append-only va settlement client khong the set.

NFR-5: Tenant isolation, revoke, concurrency/idempotency ledger va Parent cross-School E2E la release-blocking proof; E1 isolation gate block cac release sau.

NFR-6: P95 read API <= 500 ms; preview/report <= 3 s; generate 1,000 Student <= 60 s va co Operation progress trong fixture acceptance. WCAG 2.1 AA cho ca ba portal.

NFR-7: Pilot dung mot VPS Docker Compose, source build, TLS proxy va PostgreSQL durable volume; secrets ngoai Git, migration deploy truoc API can no, khong destructive rollback. Production controls la gate Spine rieng.

NFR-8: Workspace pnpm/Turborepo dung Node 22, TypeScript, React/Vite, NestJS/Prisma/PostgreSQL; API modular monolith va portal apps khong import nhau/API internals.

### Additional Requirements

- Scaffold clean-break workspace `apps/api`, `apps/web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui` va `deploy/compose`; reset seed/dev/test theo target schema, khong compatibility layer hay migration production.
- API domain modules la `identity`, `schools`, `memberships`, `authorization`, `roster`, `settings`, `finance`, `attendance`, `parents`, `parent-auth`, `parent-portal`, `operations`; controller chi goi owning service va domain export contract hep.
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

UX-DR8: Build settlement, prepayment, debt, correction/refund and report views with immutable source facts, server-returned limits/as-of time, explicit two-step approval and no client-computed authority.

UX-DR9: Build attendance/handover/service/long-leave flows with required evidence, calendar/leave conflicts, source-linked adjustment outcome and no automatic fee affordance.

UX-DR10: Build Parent Today cards, child date history, leave request and inbox with exact safe copy, `NOT_RECORDED` neutral treatment, authorized re-check deep links and protected-state clearing.

UX-DR11: Build Parent outstanding Payment instruction as read-only snapshot: obligation code, period, issued total, current outstanding, state/time, receiving bank, account, holder and transfer content; hide payment invitation when no outstanding.

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

FR-10: Epic 6 - Receipt, allocation, Prepayment, reversal va refund.

FR-11: Epic 6 - Prior debt, settlement va ledger report.

FR-12: Epic 4 - Leave/attendance/service domain, evidence va source-linked adjustment; Epic 7 - Parent-authorized leave request entry va state view.

FR-13: Epic 4 - Handover operational reference.

FR-14: Epic 7 - Parent authorization, attendance read model va notification inbox.

FR-15: Epic 7 - Read-only Parent obligation va Payment instruction snapshot.

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

Nhan su co capability ghi attendance/handover; School Admin/Finance quan ly service va long leave; leave state, evidence, conflict va Finance adjustment source duoc bao toan ma khong tu dong tinh fee.

**FRs covered:** FR-12 (domain operations), FR-13.

**Depends on:** Epic 1, Epic 2, Epic 3.

### Epic 5: Tạo và phát hành nghĩa vụ thu

Finance cau hinh catalog/rule, tao CollectionRun, kiem tra preview do server tinh, generate Invoice DRAFT chong trung, xu ly adjustment hop le va issue immutable Payment instruction snapshot.

**FRs covered:** FR-7, FR-8, FR-9.

**Depends on:** Epic 1, Epic 2, Epic 3, Epic 4.

### Epic 6: Thu tiền, đối soát công nợ và báo cáo sổ cái

Finance ghi Receipt/Allocation/Prepayment, thuc hien reversal/refund/debt transfer dung policy va xem report ledger co the reconcile.

**FRs covered:** FR-10, FR-11.

**Depends on:** Epic 5.

### Epic 7: Parent portal đa trường, read-first

Parent dung portal mobile-first de chon School, xem attendance an toan, inbox, gui/quan ly leave request khi duoc phep va xem Invoice/Payment instruction snapshot; Parent khong the mutate attendance hoac settlement.

**FRs covered:** FR-12 (Parent leave entry), FR-14, FR-15.

**Depends on:** Epic 1, Epic 2, Epic 4, Epic 6.

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

**Given** it nhat hai School, nhieu membership/Parent link va cac audience sessions trong PostgreSQL integration fixture
**When** suite chay cac route/query/write/report scoped
**Then** cross-School UUID, filter, route, header, join, aggregate va relation insert deu bi tu choi
**And** scoped unique constraints va audit/Operation provenance duoc kiem tra bang automated tests.

**Given** mot membership, Parent link hoac School bi revoke/suspend
**When** request ke tiep va portal foreground/deep-link dien ra
**Then** server tu choi context khong hop le, portal xoa protected state va dua user ve chooser hoac signed-out safe state
**And** valid context khac cua cung UserIdentity van dung duoc.

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

**Given** School Admin revoke StudentParent link
**When** Parent gui request ke tiep hoac mo protected child context
**Then** server tu choi child/school data dua tren link do va portal xoa protected state
**And** audit giu lich su link/revoke; Parent van co the xem Student/School khac neu link khac con active.

### Story 2.4: Quản lý Staff profile và phân công theo effective date

As a School Admin,
I want to ghi nhan Staff profile va phan cong vao Class theo thoi gian hieu luc,
So that lop hoc co nhan su phu hop ma ho so khong tu bien thanh quyen dang nhap.

**Acceptance Criteria:**

**Given** School Admin tao hoac cap nhat Staff profile
**When** luu thong tin
**Then** he thong chi luu ho ten, email, so dien thoai, ngay sinh, gioi tinh va dia chi trong selected School
**And** khong tao password, HR/payroll record, login grant hoac phan loai giao vien chinh/phu.

**Given** Staff va Class thuoc selected SchoolYear
**When** School Admin tao, thay doi hoac ket thuc class assignment
**Then** assignment dung interval `[effectiveFrom, effectiveTo)`, timezone `Asia/Ho_Chi_Minh`, actor va ly do audit
**And** server tu choi cross-School/Class hoac khoang thoi gian khong hop le.

**Given** assignment ket thuc hay SchoolYear dong
**When** danh bo duoc xem lai
**Then** lich su assignment con doc duoc va khong bi ghi de boi current-state field
**And** UI phan biet ro Staff record, assignment va login/role state.

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
**Then** policy co due date, tax-treatment label, SchoolYear debt/prepayment settings va reversal mode `DIRECT` hoac `SCHOOL_ADMIN_APPROVAL`
**And** moi thay doi co effective date, actor, old/new value, reason khi duoc yeu cau va server validation.

**Given** School Admin tao hoac thay doi lifecycle mot BankAccount
**When** luu
**Then** account thuoc dung School, co receiving bank, account number, account-holder name va validated transfer-content template, co trang thai active/inactive va khong hard-delete
**And** inactive account khong the duoc dung cho Invoice moi nhung account/snapshot lich su van doc duoc; malformed/blank source field hoac account khac School bi tu choi.

**Given** policy/account form dang dirty hoac mutation outcome chua chac chan
**When** user doi School hoac request timeout
**Then** switch guard chan silent context change va cho reconcile Operation khi applicable
**And** UI chi hien thi server-confirmed active policy/account state.

### Story 3.3: Cấu hình attendance, handover và Parent access theo policy typed

As a School Admin,
I want to version cac policy attendance, handover va Parent access,
So that lop hoc va Parent portal ap dung rule da duoc phe duyet thay vi JSON tu do hoac logic client.

**Acceptance Criteria:**

**Given** School Admin chon attendance policy
**When** tao version moi
**Then** policy chi nhan `photoEvidenceMode` la `REQUIRED` hoac `OPTIONAL`, cung effective date va audit/reason
**And** policy `REQUIRED` tro thanh server-enforced input cho attendance write, khong phai UI hint.

**Given** School Admin tao handover hoac Parent-access policy version
**When** request hop le
**Then** handover policy luu cutoff time, grace period va block/reference behavior typed, cung effective date, audit va lay dung version theo School/as-of date
**And** UI hien thi active/proposed/history ro rang, khong co free-form key-value JSON thay cho domain schema.

**Given** Parent operational/finance retention phai duoc danh gia
**When** enrollment ket thuc hoac obligation settlement hoan tat
**Then** server ap dung 30 ngay operational/sensitive retention va ParentAccessPolicy versioned voi default 12 thang sau settlement
**And** client khong the keo dai retention qua query parameter, cache hoac stale route.

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
**And** test chung minh snapshot lich su khong bi rewrite boi policy hien hanh.

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

### Story 4.2: Ghi attendance có conflict validation và evidence policy

As an attendance-capable Staff member,
I want to ghi attendance theo Student/ngay voi evidence khi policy yeu cau,
So that trang thai lop hoc dang tin cay ma leave/calendar conflict khong bi ghi de.

**Acceptance Criteria:**

**Given** Staff co attendance capability, selected School/Class/date hop le va Student `ENROLLED`
**When** Staff submit attendance status
**Then** server ghi trang thai trong School context, audit actor/time/provenance va tra updated server state
**And** client khong the dung Class, Student hoac date tu School khac de bypass capability.

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

**Given** attendance record co evidence
**When** Staff khong co attendance capability, School khac hoac Parent truy cap evidence/media route
**Then** request bi tu choi va Parent DTO/event khong co media URL, preview, Staff identity hoac internal reason
**And** authorized attendance Staff/School Admin chi xem evidence trong dung School scope.

**Given** evidence da xac nhan duoc hai thang lich
**When** retention cleanup chay
**Then** blob/preview bi xoa, audit metadata ve deletion van con
**And** Staff/Admin doc record sau cleanup thay thong bao audit-safe "Tep bang chung da het han".

**Given** mot attendance write thanh cong hoac retry idempotent
**When** transaction hoan tat
**Then** domain emit dung mot in-app notification source event co School/Student/date nhung khong chua evidence hoac internal facts
**And** delivery/read projection chi co the duoc Parent portal xu ly sau khi recheck active `StudentParent` o Epic 7.

### Story 4.4: Ghi handover như operational reference

As a handover-capable Staff member,
I want to ghi picked-up time cua mot Student theo ngay,
So that lop co lich su ban giao ma khong tao mot khoan phi tu dong.

**Acceptance Criteria:**

**Given** Staff co handover capability, Student/Class/day thuoc selected School
**When** Staff submit picked-up time
**Then** server validate state/capability, danh gia handover policy as-of date va snapshot cutoff/grace/block reference cung audit vao confirmed operational record
**And** missing capability, already-recorded state hoac validation error tra ly do server va UI refresh record.

**Given** Finance hoac Staff xem handover record
**When** record duoc trinh bay
**Then** UI label no la operational reference voi School/date/Student context va Finance co the doc immutable cutoff/grace/block snapshot de giai thich dong `MANUAL`
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
**When** Finance yeu cau materialize adjustment
**Then** finance-only command tao negative line idempotent theo source/day/receivable tren Invoice DRAFT ke tiep
**And** ket qua no-target, issued/voided target hoac retry duoc luu provenance; khong duplicate, khong rematerialize va khong tu tao charge.

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
**And** test xac minh blob cleanup sau hai thang lich, audit retention va khong co Parent-accessible evidence field.

**Given** Admin/Staff portal E2E chay attendance/handover flows
**When** user gap missing capability, conflict, validation error, timeout hoac School switch
**Then** UI hien thi server-confirmed status/reason, accessible error/focus, switch guard va Operation reconciliation theo contract
**And** khong co automatic fee UI, local status override hoac stale cross-School class data.

**Given** attendance write hoan tat nhieu lan do retry
**When** notification source duoc kiem tra
**Then** chi mot idempotent event source ton tai cho attendance event
**And** Parent projection/delivery chi duoc kiem thu tai Epic 7 voi active StudentParent recheck.

## Epic 5: Tạo và phát hành nghĩa vụ thu

Finance cau hinh catalog/rule, tao CollectionRun, kiem tra preview do server tinh, generate Invoice DRAFT chong trung, xu ly adjustment hop le va issue immutable Payment instruction snapshot.

### Story 5.1: Quản lý receivable catalog, discount và ChargeRule có precedence

As a Finance Manager,
I want to quan ly khoan thu, discount va ChargeRule theo School/Class/Student scope,
So that CollectionRun co rule ro rang ma Invoice lich su khong bi thay doi.

**Acceptance Criteria:**

**Given** Finance Manager hoac School Admin co capability trong selected School
**When** tao/cap nhat/inactivate `ReceivableGroup`, `Receivable`, `DiscountPolicy` hoac `ChargeRule`
**Then** record la School-scoped, co audit/effective period/source, va catalog inactive khong the dung cho flow moi nhung van doc duoc trong snapshot lich su
**And** ma khoan la optional nhung unique trong School khi duoc cung cap; money persist PostgreSQL `BIGINT` va REST chi tra JSON-safe integer, khong dung float.

**Given** ChargeRule cung Receivable ap dung o nhieu scope
**When** server chon rule cho Student trong CollectionRun
**Then** precedence la `STUDENT > CLASS > SCHOOL`
**And** conflict cung muc dac hieu bi tu choi, khong chon ngau nhien hoac theo client order.

**Given** Finance Manager cau hinh quantity/price/discount
**When** request duoc validate
**Then** ChargeRule chi nhan `FIXED` hoac `MANUAL`; DiscountPolicy chi la percent hoac whole-VND amount voi School/Class/Student va Receivable scope/effective period
**And** discount khong tao tong am hoac anonymous credit; recurring catalog rules khong tao `StudentPromotionalCoverage`, va khong co auto-pricing tu attendance, handover hay service enrollment.

**Given** finance API persist va tra money field
**When** unit/integration test chay calculation, catalog va Invoice fixture
**Then** VND math dung integer `BIGINT` end-to-end va REST reject/khong serialize gia tri khong JSON-safe
**And** client total khong duoc dung lam persistence authority.

### Story 5.2: Tạo CollectionRun và server-authoritative preview

As a Finance Manager,
I want to cau hinh CollectionRun va xem preview authoritative theo SchoolYear/scope/ky thu,
So that toi biet chinh xac Student nao du dieu kien, bi skip vi sao va tong tien do server tinh truoc generate.

**Acceptance Criteria:**

**Given** Finance Manager tao `MONTHLY`, `ANNUAL` hoac `ONE_OFF` CollectionRun trong selected SchoolYear
**When** luu cau hinh DRAFT hoac yeu cau preview
**Then** `MONTHLY` dung `billingMonth` `YYYY-MM`; `ANNUAL`/`ONE_OFF` dung user-entered `periodKey`; cac ky nay khong bi unique giua runs
**And** lifecycle chi cho `DRAFT -> READY -> GENERATED -> CLOSED`; rule/scope edit o DRAFT, server chi dua READY khi hop le.

**Given** run o DRAFT voi rule/scope hop le
**When** Finance Manager mo preview
**Then** server dung cung selection/calculation service voi generate va tra School, period, scope, eligible rows, categorized skips gom `COVERED_BY_PROMOTIONAL_COVERAGE`, prior-debt context, amount composition, whole-VND totals, calculation time/version
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
**Then** transaction dung roster as-of snapshot va rule/scope snapshot tu server de tao toi da mot DRAFT Invoice cho moi Student eligible va chi bo qua cap Student/Receivable/ky co issued promotional coverage
**And** unique `(schoolId, studentId, collectionRunId)` duoc enforce; Invoice luu enrollment/class/source facts can cho lich su.

**Given** generate hoan tat, bi retry hoac mot Student khong the tao Invoice
**When** client doc Operation outcome
**Then** outcome phan loai it nhat Invoice da ton tai, enrollment khong du dieu kien, khong co Class active va khong co rule
**And** identical retry replay result; changed fingerprint conflict; timeout buoc reconcile truoc retry.

**Given** CollectionRun da `GENERATED`
**When** Finance Manager thay doi rule/scope hoac them Student
**Then** rule/scope goc bi lock; chi Student eligible chua co Invoice moi co the duoc them bang dung mot DRAFT Invoice tu rule snapshot
**And** khoan thu moi cho Invoice da issue phai di qua supplemental run, khong sua run/Invoice cu; receivable khong nam trong coverage van generate binh thuong.

### Story 5.4: Rà soát Invoice DRAFT, adjustment và promotional coverage có audit

As a Finance Manager,
I want to xem va dieu chinh Invoice DRAFT, dong thoi lap promotional coverage theo Student trong boundary duoc cap quyen,
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

**Given** Finance Manager them dong `MANUAL` cho ngay thu Bay
**When** dong thu duoc validate trong Invoice `DRAFT`
**Then** server kiem tra active `StudentServiceEnrollment` cua Student bao phu ngay do
**And** dong thu bi tu choi khi khong co coverage hoac trung charge voi service da duoc cover; attendance/handover khong tu dong tinh charge.

**Given** School Admin hoac Finance Manager lap uu dai cho Student sau thoa thuan truc tiep
**When** ho chon named receivable-period pairs, gia/discount va ly do
**Then** server tao `StudentPromotionalCoverage` School/Student-scoped va tra overlap/eligibility result truoc khi tao DRAFT obligation
**And** Parent khong co catalog, request hay selection action; issued coverage trung Student/Receivable/ky bi tu choi.

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

**Given** Invoice DRAFT duoc tao tu StudentPromotionalCoverage
**When** Finance Manager issue
**Then** Invoice snapshot named coverage receivable-period pairs, price/discount va coverage source facts
**And** issued overlap cho cung Student/Receivable/ky bi tu choi va CollectionRun sau do chi skip coverage facts do.

**Given** Invoice da `ISSUED`
**When** Finance Manager hoac client co sua line, quantity, price, discount, BankAccount, Payment instruction, total hoac state
**Then** server tu choi mutation va chi finance settlement workflow sau nay moi co the derive `PAID` hay transition `VOIDED` khi chua allocation/prepayment
**And** parent/client khong the set outstanding hoac payment status.

**Given** Invoice `ISSUED` chua co Allocation hoac Prepayment application
**When** Finance Manager hoac School Admin yeu cau void voi reason va `Idempotency-Key`
**Then** server transition Invoice sang `VOIDED`, luu audit/Operation va immutable obligation snapshot van doc duoc
**And** Invoice co settlement, wrong School/capability hoac retry fingerprint thay doi bi tu choi; retry giong nhau replay terminal outcome.

**Given** Finance Manager xem issue confirmation hay issued Invoice
**When** server tra result
**Then** UI neu ro School, Student, period, immutable obligation, Payment instruction snapshot va ledger-derived outstanding
**And** action destructive/issue co named confirmation, focus management, lifecycle conflict refresh va khong hien thi live account nhu historical snapshot.

### Story 5.6: Kiểm thử CollectionRun và Invoice issuance release gate

As a release owner,
I want automated proof cho calculation, scope, snapshot, concurrency va issue lifecycle,
So that CollectionRun/Invoice khong duplicate, tinh sai VND hoac expose du lieu cross-tenant.

**Acceptance Criteria:**

**Given** fixture co nhieu School, SchoolYear, enrollment lifecycle, rules, discounts, bank accounts va CollectionRuns
**When** unit/integration suite chay preview/generate/issue scenarios
**Then** preview va generate dung cung outcome; scope/precedence/discount/whole-VND math, promotional coverage overlap/skip, roster snapshot, unique Invoice va lifecycle locks deu duoc kiem tra
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
**Then** server transition run sang `CLOSED`, persist actor/reason/audit va `Operation`, replay identical retry va reconcile truoc retry sau timeout
**And** run o `DRAFT`, `READY`, da `CLOSED`, wrong School/capability hoac changed fingerprint bi tu choi.

**Given** CollectionRun da `CLOSED`
**When** Finance hoac API co tao/sua rule, scope, Invoice hoac them Student trong run
**Then** server tu choi mutation va UI chi cho read/filter/report voi server explanation
**And** integration test chung minh lifecycle `DRAFT -> READY -> GENERATED -> CLOSED` va create/edit lock o `CLOSED`.

## Epic 6: Thu tiền, đối soát công nợ và báo cáo sổ cái

Finance xac nhan thanh toan Invoice theo exact settlement, xu ly phan du nhu Prepayment ngoai le, hoan tien uu dai theo operating-day preview co override/audit, va doi soat toan bo bang append-only ledger.

### Story 6.1: Ghi exact Receipt settlement cho một Student

As a Finance Manager,
I want to ghi mot Receipt settle du mot hoac nhieu Invoice cua cung Student,
So that van hanh thanh toan thong thuong chi co chua tra hoac da tra du, khong co partial payment.

**Acceptance Criteria:**

**Given** Finance Manager co capability trong selected School va chon mot Student
**When** server tra cac Invoice `ISSUED` con outstanding cua Student do
**Then** UI hien thi tung Invoice, outstanding server-returned va tong exact amount de settle toan bo cac Invoice duoc chon
**And** khong cho chon Invoice khac School hoac khac Student.

**Given** Finance Manager submit Receipt cung cac target Invoice
**When** so Receipt bang dung tong outstanding hien tai cua moi target
**Then** finance posting transaction tao Receipt/Allocation append-only va moi Invoice target derive `PAID` cung ledger as-of time
**And** request bat buoc `Idempotency-Key`, persist `Operation` theo actor/School/route/fingerprint va retry giong nhau replay terminal outcome; `PARTIALLY_PAID` khong ton tai, client khong the set Invoice total, outstanding hay status.

**Given** Receipt thap hon tong target, target khong cung Student, khong co target, Invoice voided hoac concurrent posting lam outstanding thay doi
**When** Finance Manager submit
**Then** server tu choi toan bo normal settlement truoc khi ghi posting
**And** UI giu immutable source facts, refresh server limits/state va khong the retry truoc Operation reconciliation.

### Story 6.2: Xử lý Receipt excess bằng Student Prepayment explicit

As a Finance Manager,
I want to ghi phan Receipt excess thanh Prepayment explicit cho dung Student,
So that ngoai le chuyen du khong tro thanh partial settlement hay generic credit.

**Acceptance Criteria:**

**Given** Receipt lon hon tong outstanding cua cac Invoice duoc settle du cho mot Student
**When** Finance Manager xac nhan explicit excess handling
**Then** transaction post cac Allocation exact settlement va mot Prepayment append-only voi nguon, amount, Student, School, actor va audit
**And** request bat buoc `Idempotency-Key` va persist `Operation`; neu excess khong duoc xac nhan thanh Prepayment, entire posting bi tu choi; khong co normal unallocated Receipt balance.

**Given** Finance Manager ap dung Prepayment vao Invoice tuong lai
**When** source Prepayment va target Invoice cung School/Student, target `ISSUED` con outstanding
**Then** posting boundary khoa va chi cho application bang dung full outstanding target
**And** request bat buoc `Idempotency-Key`, persist `Operation` va reconcile truoc retry; source/target over-application, cross-Student/cross-School use, partial target application, voided Invoice va client amount injection deu bi tu choi.

**Given** Finance mo Prepayment detail
**When** settlement control render
**Then** UI hien immutable source, available amount server-returned, target obligation va as-of state
**And** khong co Parent Prepayment action, generic balance editor hoac partial-payment affordance.

### Story 6.3: Correction và hoàn tiền promotional coverage theo operating-day preview

As a School Admin or Finance Manager,
I want to tao correction va refund review co source/audit, bao gom promotional coverage khi Student nghi hoac chuyen truong,
So that sai sot va phan coverage chua su dung duoc xu ly nhat quan ma khong sua ledger lich su.

**Acceptance Criteria:**

**Given** Student withdrawal/transfer co issued, paid `StudentPromotionalCoverage` con ky bao phu
**When** authorized actor yeu cau refund preview
**Then** server dung coverage price/discount snapshot va applicable School calendar de tra coverage/Invoice/Receipt source, `eligibleOperatingDays`, `remainingOperatingDays` loai tru withdrawal effective date, va `calculatedAmount` VND
**And** `calculatedAmount` bang `floor(snapshotCoverageAmount * remainingOperatingDays / eligibleOperatingDays)`; khong dung catalog/policy hien hanh hoac client calculation.

**Given** School Admin hoac Finance Manager sua `approvedAmount` khac `calculatedAmount`
**When** ho submit refund request
**Then** server yeu cau override reason, luu calculated/approved amount, actor, coverage/Invoice/Receipt provenance va Idempotency Operation
**And** request van di qua `DIRECT` hoac `SCHOOL_ADMIN_APPROVAL`; requester khong self-approve trong two-step mode.

**Given** Receipt, Allocation hoac Prepayment da post co sai sot, hoac refund co source hop le
**When** School Admin hoac Finance Manager tao reversal/refund request voi amount va reason
**Then** server validate source/available limit, tao posting/request append-only co Idempotency Operation va khong sua record goc
**And** `DIRECT` cho actor duoc quyen post; `SCHOOL_ADMIN_APPROVAL` yeu cau Finance Manager request va School Admin khac actor approve/refuse, khong self-approve.

**Given** refund duoc post, refused, retry hoac source da co correction
**When** Finance xem source/result
**Then** refund la append-only va khong sua Invoice, Receipt, Allocation, Prepayment hay coverage goc
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
**Then** target van phai duoc settle dung toan bo theo exact settlement
**And** khong co partial debt settlement state hay client-side carryover.

**Given** SchoolYear ket thuc
**When** Finance xem debt/open balances
**Then** system khong auto-carryover sang SchoolYear moi
**And** write-off, adjustment hoac payment phai la workflow audited rieng, khong sua truc tiep balance.

### Story 6.5: Báo cáo finance reconcile từ ledger

As a Finance Manager,
I want to xem report scoped theo School/run/period/group/class/status tu ledger,
So that toi doi soat duoc gross, discount/refund, receipt, allocation, prepayment va outstanding.

**Acceptance Criteria:**

**Given** Finance Manager chon School context va report period/filter hop le
**When** API tao report
**Then** server aggregate ledger/snapshot theo School, CollectionRun, period, ReceivableGroup, Class va status, tra as-of timestamp
**And** totals tach rieng gross, discount/refund, net billed, receipt, allocation, Prepayment va outstanding bang VND integer, khong co grouping `PARTIALLY_PAID`.

**Given** promotional coverage hoac promotional refund ap dung
**When** report/detail duoc tao
**Then** report giu coverage/refund source provenance theo contract
**And** source catalog, Student/Class, policy hoac BankAccount da doi sau posting khong rewrite finance lich su.

**Given** khong co ledger activity khop filter, report load/error hoac responsive view
**When** Finance UI render
**Then** UI giu School/period/filter, neu khong co hoat dong thay vi xac nhan "0 collected" khong co as-of context
**And** VND right-align, table caption/keyboard access, server error and accessible empty/loading states; khong co export trong release nay.

### Story 6.6: Release gate cho exact settlement và promotional refund

As a release owner,
I want automated proof rang moi posting va report reconcile dung duoi retry/concurrency,
So that duplicate posting, cross-tenant settlement hoac report sai khong vao pilot.

**Acceptance Criteria:**

**Given** PostgreSQL fixture co nhieu School/Student/Invoice/Receipt/Prepayment, promotional coverage va ledger state
**When** integration suite chay settlement, reversal/refund, debt transfer va report scenarios dong thoi
**Then** exact multi-Invoice settlement cho cung Student pass; partial, unallocated, mixed-Student, cross-School va duplicate posting bi tu choi
**And** Receipt excess chi tao explicit Student Prepayment; lock order, append-only history va Operation idempotency deu duoc kiem tra.

**Given** issued promotional coverage va withdrawal/transfer fixture
**When** suite chay coverage/refund scenarios
**Then** overlap bi chan, monthly run chi skip covered receivable-period, operating-day calculation loai tru withdrawal date va floor VND dung
**And** override reason, approval outcome va append-only coverage/Invoice/Receipt provenance deu duoc kiem tra.

**Given** Finance portal E2E chay settlement/correction/report flows
**When** user gap concurrent state change, timeout, policy approval boundary, no-data hoac School switch
**Then** UI refresh server limits/state, vao Operation reconciliation, khong double submit va giu accessible source/error/as-of context
**And** Epic 6 khong complete neu reconciliation fixture hoac ledger concurrency suite con fail.

## Epic 7: Parent portal đa trường, read-first

Parent dung PWA mobile-first de xem dung Student duoc uy quyen, attendance/inbox, gui leave request khi con `PENDING`, va xem obligation `ISSUED` cung Payment instruction snapshot. Parent khong co finance, promotional coverage, refund hay payment mutation.

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

### Story 7.2: Parent xem Today và attendance history tối thiểu

As a Parent,
I want to xem trang thai attendance hom nay va theo ngay cua tung con duoc uy quyen,
So that toi biet truong da ghi nhan gi ma khong thay du lieu noi bo hoac cua tre khac.

**Acceptance Criteria:**

**Given** ParentSchoolContext hop le va active StudentParent link cho tung Student duoc tra ve
**When** Parent mo home hoac child attendance history
**Then** API list/detail join va filter active `StudentParent` cho dung tung `studentId`
**And** DTO chi co `studentId`, Student display-name snapshot, date, `PRESENT`/`ABSENT`/`ON_LEAVE`/`NOT_RECORDED` va necessary updated time.

**Given** attendance chua duoc ghi trong ngay van hanh
**When** Parent xem Today card hoac date history
**Then** UI hien "Truong chua ghi nhan" voi neutral state, khong goi do la vang mat
**And** holiday/non-operating date co calendar label, khong suy dien missing attendance.

**Given** Parent co truy cap attendance cua Student khac, Staff/internal reason, evidence/media hoac class data
**When** server hoac deep-link resolver xu ly request
**Then** request bi tu choi hoac safe-fallback truoc khi protected content render
**And** Parent khong co attendance edit/confirm affordance, endpoint hoac cached alternate data.

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

### Story 7.6: Parent xem obligation ISSUED và Payment instruction snapshot

As a Parent,
I want to xem Invoice con outstanding va payment instruction snapshot cho dung Student,
So that toi co the thuc hien thanh toan ngoai he thong ma khong thay doi trang thai finance.

**Acceptance Criteria:**

**Given** Parent authorized cho Student va Invoice `ISSUED` con outstanding trong retention
**When** Parent mo obligation detail
**Then** API tra minimum read model gom obligation code, period, issued Invoice total snapshot, server-derived current outstanding VND, state/update time, receiving bank, account number, account holder va transfer content
**And** issued total/current outstanding duoc label rieng; API khong tra audit noi bo, live account, data tre khac hoac finance source khong can thiet.

**Given** Invoice `PAID`, `VOIDED`, khong con outstanding hoac vuot Parent finance retention
**When** Parent list/detail duoc tai
**Then** Payment instruction/payment invitation khong duoc hien thi
**And** Parent khong thay `PARTIALLY_PAID`, Receipt/allocation, Prepayment, promotional coverage, refund control, "I paid", VietQR, copy-field hoac bank deep-link action.

**Given** issued Invoice da duoc settle nhung Prepayment hoac refund lien quan van chua settlement trong Parent finance retention
**When** Parent xem finance history authorized cho Student
**Then** API giu minimum read model can thiet cua issued obligation va settlement/refund state cho toi khi balance, Prepayment va refund deu settled
**And** DTO khong lo Receipt/allocation detail, audit noi bo, promotional coverage source, live account hay bat ky Parent finance mutation nao.

**Given** Parent thay route, Student link revoke hoac School context khong con hop le trong luc xem obligation
**When** API/deep-link re-authorizes
**Then** protected content bi xoa va app chuyen safe chooser/inbox/signed-out state
**And** Parent khong co POST mutation cho Receipt, payment confirmation, package selection hay refund.

### Story 7.7: Parent PWA accessibility, retention và cross-school release gate

As a release owner,
I want automated proof cho Parent authorization, retention, payment read model va mobile accessibility,
So that Parent portal khong leak du lieu tre em hoac finance va van dung duoc tren thiet bi chinh.

**Acceptance Criteria:**

**Given** fixture co Parent voi nhieu Student/School, active/revoked links, attendance events, Invoice `ISSUED`/`PAID`/`VOIDED`, promotional coverage va refunds
**When** API/PostgreSQL integration va Parent E2E suites chay
**Then** cross-School/cross-Student route, UUID, filter, deep-link, finance-field, evidence/media va Parent mutation attempt deu bi tu choi
**And** recheck per returned/requested `studentId`, revoke, expiry, 30-day operational retention va finance retention deu pass.

**Given** Parent PWA load, navigate, receive `401`, go offline hoac render empty/error state
**When** accessibility/mobile checks chay
**Then** one route `h1`, text status, 44x44px targets, keyboard/focus management, screen-reader error behavior, no-hover dependency, no protected service-worker caching va safe state clearing deu pass
**And** offline khong queue hoac gia vo hoan tat mutation.

**Given** Parent opens payment instruction or notification
**When** state is unauthorized, expired, no outstanding, `PAID`, `VOIDED`, revoked or retention-expired
**Then** app hides protected detail/action and renders server-confirmed safe fallback
**And** Epic 7 khong complete neu Parent cross-school, retention, notification re-authorization hoac payment read-model test con fail.

### Story 7.8: Pilot performance và accessibility release gate

As a release owner,
I want fixture-based performance va WCAG verification cho ca ba portal truoc pilot,
So that latency va kha nang su dung khong duoc suy doan tu happy path.

**Acceptance Criteria:**

**Given** acceptance fixture va telemetry harness da duoc cau hinh
**When** read API, CollectionRun preview va finance report benchmark chay trong target pilot topology
**Then** P95 read API <= 500 ms, preview/report <= 3 s, va CollectionRun generate 1,000 Student <= 60 giay voi Operation progress observable
**And** benchmark report luu fixture, environment, timing va failure outcome; client khong tu claim success khi server chua terminal.

**Given** Admin/Staff, Ops va Parent portal routes/components trong release
**When** WCAG 2.1 AA automated va manual keyboard/screen-reader verification chay
**Then** contrast, text status, heading/route focus, dialog focus, table semantics, responsive treatment va Parent 44x44 touch target deu pass theo UX contract
**And** blocked finding la release gate; khong portal nao duoc mien tru chi vi khong phai Parent.
