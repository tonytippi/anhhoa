---
title: "PRD Initiative - PassionEdu: Nen tang van hanh da truong"
status: final
created: 2026-09-04
updated: 2026-09-08
supersedes:
  - prds/prd-anhhoa-2026-08-18/prd.md
  - prds/prd-anhhoa-parent-pwa-2026-08-22/prd.md
---

# PRD: PassionEdu - Nen tang van hanh da truong

## 0. Muc dich tai lieu

PRD nay la nguon yeu cau thay the cho hai PRD single-school da `final`; cac artifact cu van duoc giu nguyen de truy vet. Tai lieu dinh nghia initiative noi bo PassionEdu cho Product, Architecture, UX, Epics va QA: mot nen tang da truong, an toan du lieu tre em, co danh bo theo nam hoc, so thu tien va cac luong van hanh lop hoc. Chi tiet thuc thi, schema, endpoint va cac lua chon ky thuat duoc luu tai `addendum.md` de Architecture Spine chot truoc khi scaffold hay clean-break implementation.

## 1. Tam nhin

PassionEdu giup moi truong mam non van hanh tren mot nen tang chung, trong khi du lieu, chinh sach va quyen cua tung truong luon doc lap. Anh Hoa la `School` tenant dau tien, khong phai ranh gioi cua san pham.

Nen tang thay the dashboard thu hoc phi single-school bang mot he thong foundation-first: nhan dang va phan quyen theo truong; danh bo va nam hoc; nghia vu thu, thu tien va cong no co so cai; sau do la diem danh, nghi phep, dich vu va ban giao tre. Parent la surface read-first, tu xem nghia vu va huong dan thanh toan trong dung school context; khong tu xac nhan da thu tien.

Clean-break la chu dich: du lieu hien tai chi la seed/dev/test. Product khong duy tri hai mo hinh finance hay authorization song song.

## 2. Nguoi dung muc tieu

### 2.1 Cong viec can hoan thanh

- Platform Operator can provision va suspend `School` ma khong mac dinh thay du lieu nghiep vu cua truong.
- School Admin can quan ly nam hoc, danh bo, Parent, Staff, role va cau hinh cua rieng truong minh.
- Finance Manager can cau hinh khoan thu, xem preview, phat hanh nghia vu, ghi nhan thu tien, xu ly nộp truoc/cong no va bao cao dung so cai.
- Teacher can dung portal rieng de ghi nhan van hanh lop hoc, bao gom nhan tre, tra tre va nhan xet hang ngay theo tung Student trong Class duoc phan cong.
- Parent can chon dung truong/con, xem nghia vu, nhan xet hang ngay va anh duoc uy quyen, gui don nghi va lay huong dan thanh toan ma khong xem du lieu noi bo hay cua tre khac.

### 2.2 Khong phai nguoi dung release dau

- Nguoi dung khong co `UserIdentity`, `SchoolMembership` hay lien ket Parent-Hoc sinh active khong truy cap du lieu nghiep vu.
- Platform Operator khong la School Admin mac dinh.
- Parent khong la nguoi ghi receipt, sua finance, xac nhan thanh toan, sua danh bo hay xem bang chung diem danh.

### 2.3 Hanh trinh chinh

- **UJ-1. Linh provision truong moi.** Linh la Platform Operator, dang nhap Ops portal va tao `School`, suspend/reactivate khi can, dong thoi bootstrap owner theo email. Khi owner dang nhap Google, ho chi vao dung school shell va Linh khong tu nhien co quyen doc du lieu cua truong.
- **UJ-2. Hoa thiet lap nam hoc va danh bo.** Hoa la School Admin cua Anh Hoa. Chi trong school context Anh Hoa, Hoa tao `SchoolYear` active, lop, hoc sinh, lien ket Parent va Staff assignment. Chuyen nam/doi lop tao lich su enrollment thay vi sua qua khu.
- **UJ-3. Minh phat hanh dot thu.** Minh la Finance Manager, chon `CollectionRun`, xem ma tran preview do server tinh, tao `DRAFT`, ra soat/ghi ly do cho dieu chinh, chon tai khoan nhan tien va issue. Minh ghi receipt va phan bo tien; so tien con no duoc suy ra tu so cai, khong tu trang thai client.
- **UJ-4. Mai kiem tra ngay hoc cua con.** Mai co con tai mot hoac nhieu `School`, chon dung school va xem trang thai attendance theo ngay cua con, sau do gui don nghi khi can. Notification attendance mo dung trang thai cua con; `NOT_RECORDED` duoc hien thi la truong chua ghi nhan, khong phai vang mat. Mai co the xem nghia vu/huong dan thanh toan da duoc cap quyen, nhung khong the gui receipt, xac nhan thanh toan hay thay doi du lieu truong.
- **UJ-5. An ghi nhan ngay hoc.** An la nhan vien duoc cap capability, ghi diem danh va ban giao tre theo policy cua truong. Don nghi, lich truong va attendance conflict duoc server xu ly; Finance chi tham chieu du lieu nay khi ra soat dong `MANUAL` hoac dieu chinh tien an.
- **UJ-6. An cap nhat nhan xet ngay hoc.** An dang nhap Teacher portal, chi chon lop dang duoc phan cong, ghi nhan xet va anh cho tung tre. Parent chi xem ban hien hanh cua dung con trong thoi han operational retention.

## 3. Thuat ngu

- **School** - Tenant root; moi du lieu nghiep vu va policy thuoc mot School.
- **UserIdentity** - Identity Google canonical toan platform, khong chua role hay `schoolId`.
- **SchoolMembership** - Quyen truy cap active cua UserIdentity tai mot School.
- **SchoolRoleGrant** - Role preset gan cho SchoolMembership de cap capability.
- **SchoolYear** - Ranh gioi du lieu nam hoc cua mot School; toi da mot SchoolYear active.
- **StudentEnrollment** - Trang thai va lop cua Student trong mot SchoolYear.
- **ParentProfile** - Persona Parent toan platform; school context suy ra tu lien ket Parent-Hoc sinh.
- **StudentParent** - Lien ket active/revoked giua ParentProfile va Student; la nguon duy nhat cap Parent school context va quyen portal.
- **Staff assignment** - Gan Staff vao mot hoac nhieu Class theo effective date; khong tu cap login, role hay phan biet giao vien chinh/phu. Staff chi la actor van hanh khi School Admin bind StaffProfile voi SchoolMembership/UserIdentity active va cap capability phu hop.
- **ReceivableGroup / Receivable** - Nhom va khoan thu scoped theo School; danh muc co the inactive nhung khong sua snapshot lich su.
- **ChargeRule** - Rule scoped theo School, Class hoac Student trong CollectionRun; quantity chi `FIXED` hoac `MANUAL`.
- **PromotionPolicy / PromotionPolicyVersion** - Chinh sach uu dai School-scoped va phien ban effective-dated, co target Receivable, don vi/so luong ap dung, dieu kien typed, giam VND/phan tram, fulfillment, stacking va snapshot.
- **CollectionRun** - Dot thu cua SchoolYear de preview va tao nghia vu cho hoc sinh.
- **Invoice** - Nghia vu thu theo mot Student va mot CollectionRun; noi dung khoa sau khi issue.
- **Receipt** - Khoan thu da ghi nhan; phan bo vao Invoice qua so cai append-only.
- **StudentPromotionAssignment** - Gan mot PromotionPolicyVersion cho mot Student theo effective interval, ly do va audit; khong tu suy luan quan he gia dinh.
- **StudentPromotionalCoverage** - Bao phu theo tung Student/Receivable/ky chi do server phat hanh sau khi source Invoice cua policy `PREPAID_COVERAGE` trong `PREPAID` CollectionRun da duoc settle exact; luu policy version va paid-source provenance bat bien.
- **Payment instruction** - Ban chup tai khoan nhan va noi dung chuyen khoan cua Invoice da issue.
- **Operation** - Ban ghi doi soat cua mutation idempotent, scoped theo School va actor membership.
- **Payroll entitlement** - Trang thai capability Payroll opt-in cua School; chi server co quyen cho phep dung Payroll, khong phai menu frontend hay role grant.
- **EmploymentContract** - Dieu khoan lao dong effective-dated cua Staff, bao gom luong co ban, luong thu viec, muc dong bao hiem doc lap va phu cap co dinh.
- **StaffWorkdayRecord** - Ket qua ngay cong da ra soat tu event may cham cong va correction thu cong; la nguon tinh Payroll, khong phai raw event.
- **PayrollRun** - Bang luong versioned cua mot ky; version da duyet/da chi la snapshot bat bien, sai sot sau chi dung correction run rieng.
- **Ke toan (Accountant)** - Persona hien thi cua actor co active same-School `FINANCE_MANAGER` grant, Payroll entitlement va capability chuyen biet; khong phai preset role `ACCOUNTANT` moi.

## 4. Tinh nang va yeu cau chuc nang

### 4.1 Nen tang da truong, identity va phan quyen

**Mo ta:** PassionEdu tach Platform Operations, Admin, Teacher va Parent thanh cac surface/session doc lap. Moi request nghiep vu chi duoc xu ly trong School context va sau khi server kiem tra quyen hien hanh. Realizes UJ-1, UJ-2, UJ-4, UJ-5, UJ-6.

#### FR-1: Provision va vong doi School

Platform Operator co the tao, suspend, reactivate School va bootstrap School Admin dau tien theo email.

**He qua kiem thu:**
- Suspend chan business request ke tiep cua School ma khong can xoa global identity session.
- School khong hard-delete.
- Platform capability khong tu dong cap quyen doc/ghi du lieu School.
- `SUPERADMIN_EMAIL` chi bootstrap `PlatformOperatorGrant` qua environment; Ops authorize bang audience `ops` va grant nay, khong tao OpsUser hay password mac dinh.
- Provisioning tao/tai su dung UserIdentity pending theo normalized email cua owner va atomically tao SchoolMembership pending cung `SCHOOL_ADMIN` grant. Google subject chi bind khi owner dang nhap Google, sau do owner vao dung School shell; failure khong duoc de lai identity, membership hay grant partial.
- Provisioning la high-impact mutation dung `Idempotency-Key` va PlatformOperator-scoped Operation truoc khi School ton tai; identical retry replay outcome, changed fingerprint bi conflict va Ops phai reconcile `GET /operations/:operationId` truoc retry sau timeout.

#### FR-2: Membership, role va school context

UserIdentity co the co role khac nhau o nhieu School; Admin/Staff chon School qua chooser/switcher va URL giu school context. Server cap quyen theo SchoolMembership active va capability route tai thoi diem request.

**He qua kiem thu:**
- Revoke membership o School A chan request tiep theo o A nhung giu quyen hop le o B.
- Route, UUID, filter, header va local storage khong duoc thay the authorization server-side.
- Chuyen School khong lam mat silently form hay mutation dang xu ly.
- Preset release dau la `SCHOOL_ADMIN`, `FINANCE_MANAGER`, `CLASS_TEACHER`; capability attendance/handover chi duoc cap khi E4 phat hanh.
- E1 chot va test Parent portal callback, cookie, session audience va school-selection authorization contract; E7 chi them Parent finance UI/read model.

#### FR-3: Tenant isolation va provenance

Moi aggregate, truy van, unique constraint, audit va idempotent operation nghiep vu phai thuoc School context. Realizes UJ-1 den UJ-5.

**He qua kiem thu:**
- Khong the doc, sua, xoa, join hay aggregate du lieu School A bang context/credential cua School B.
- Idempotency key cung gia tri o hai School khong xung dot.
- Audit luu School, UserIdentity va actor membership khi co.

### 4.2 Cau hinh, nam hoc va danh bo

**Mo ta:** Moi School tu quan ly profile, calendar va policy typed/versioned; SchoolYear va StudentEnrollment bao toan lich su danh bo. Realizes UJ-2.

#### FR-4: Cau hinh School co version

School Admin quan ly profile, calendar, finance policy, Parent access policy va policy attendance/handover da duoc domain tieu thu.

**He qua kiem thu:**
- Policy anh huong tien, access, attendance hoac du lieu tre em co effective date, audit actor/gia tri cu-moi va ly do khi yeu cau.
- Client khong tu tinh lich nghi, quyen, cong no hay policy fee.
- Cau hinh tu do key-value/JSON blob khong duoc dung thay domain schema.
- FinancePolicy bao gom due date, tax treatment label, debt trong SchoolYear, reversal mode va BankAccount cua School. BankAccount co lifecycle active/inactive; Invoice da issue giu snapshot account, chu tai khoan va Payment instruction nen thay doi/inactive account khong sua lich su.

#### FR-5: SchoolYear, Class va StudentEnrollment

School Admin quan ly mot SchoolYear active, Class thuoc SchoolYear, Student va StudentEnrollment voi lifecycle `TRIAL`, `WAITING_FOR_CLASS`, `SCHEDULED_TO_START`, `ENROLLED`, `ON_LEAVE`, `WITHDRAWN`, `GRADUATED`.

**He qua kiem thu:**
- Mot Student co toi da mot StudentEnrollment moi SchoolYear; Class khong tai su dung giua nam hoc.
- Chi `ENROLLED` mac dinh du dieu kien vao CollectionRun va attendance.
- Chuyen nam/chuyen lop tao lich su enrollment va audit; Invoice da tao giu snapshot enrollment/lop.
- `studentCode` do server sinh theo prefix va sequence unique, khong phan biet hoa thuong trong School; bat bien/khong tai su dung sau khi da duoc tham chieu. Manual/import code khong thuoc release dau.
- Chuyen lop tao assignment co effective date, actor va ly do; wizard chuyen nam/co ca lop co preview, confirmation va idempotency, chi tao enrollment moi o lop dich duoc chon.
- Close-year ket thuc class assignment nhung giu enrollment lich su `ENROLLED`; `GRADUATED` chi dung khi tre thuc su roi truong va re-enrollment can ly do/audit. `TRIAL` la workflow ngoai le co audit, khong mac dinh du dieu kien attendance/CollectionRun.

#### FR-6: Parent va Staff records

School Admin quan ly lien ket Parent-Hoc sinh va Staff profile/assignment theo effective date. Parent Profile dung chung toan platform; Staff profile khong tu tao login hay quyen. School Admin muon lam cong viec giao vien phai dung Teacher portal va thoa cung binding, capability va Class assignment nhu moi Teacher.

**He qua kiem thu:**
- Parent co the co nhieu tre/School, nhung chi nhan data theo link active tai request.
- Revoke Parent link co hieu luc request tiep theo va giu lich su/audit.
- Student, Parent, Staff va enrollment da phat sinh van hanh khong hard-delete.
- School Admin co the tao Parent pending voi email normalized, ten va so dien thoai bat buoc truoc Google login; Parent chi tu sua so dien thoai co audit, khong sua identity, link hay quyen.
- Khi Parent dang nhap Google verified, server atomically tim ParentProfile pending theo normalized email, bind dung UserIdentity/Google subject va chi cap Parent session neu ParentProfile co StudentParent active. Sub mismatch hay email reassigned bi tu choi den khi School Admin revoke va gan lai; session luon dai dien dung ParentProfile da bind.
- Staff release dau gom ho ten, email, so dien thoai, ngay sinh, gioi tinh, dia chi; khong co HR/payroll/password hay phan loai giao vien chinh/phu.
- StaffProfile khong tu cap login, membership hay role. School Admin co the bind StaffProfile voi mot SchoolMembership/UserIdentity cua cung School qua audit; chi binding active, capability route va class assignment effective tai as-of date moi cho phep Staff ghi attendance/handover trong Class duoc phan cong. Revoke binding, membership, capability hoac assignment chan request ke tiep.

### 4.3 Khoan thu, dot thu va nghia vu

**Mo ta:** Finance Manager quan ly danh muc khoan thu va CollectionRun; server la nguon chan ly cho preview, rule precedence, VND va snapshot. Realizes UJ-3.

#### FR-7: Danh muc, rule va uu dai theo Student

Finance Manager hoac School Admin quan ly ReceivableGroup, Receivable, ChargeRule va PromotionPolicy scoped theo School.

**He qua kiem thu:**
- School tu dinh nghia group, khoan, don vi, gia, hoan tra va rule; ma khoan la tuy chon va unique trong School neu co.
- Precedence la `STUDENT` > `CLASS` > `SCHOOL`; conflict cung do dac hieu bi tu choi.
- Thay doi danh muc/policy khong sua Invoice snapshot trong qua khu; sua policy tao version moi co effective period, reason va audit.
- ChargeRule chi co quantity `FIXED` hoac `MANUAL`; Finance Manager/SCHOOL_ADMIN nhap/override quantity, gia hoac adjustment trong Invoice `DRAFT` co ghi chu/audit. Khong co auto-pricing tu attendance, handover hay service enrollment. Gia la gia mac dinh cua Receivable hoac override duoc audit trong Invoice `DRAFT`.
- `PromotionPolicy` co identity School-scoped va version effective-dated. Moi version co mot hoac nhieu target Receivable, don vi va so luong ap dung, dieu kien typed, giam phan tram hoac VND nguyen, fulfillment mode, priority, stacking/exclusivity va effective period. Target quantity vi du 12 thang la rule cua policy; yeu cau ky lien tiep, neu co, la business validation khi evaluate, khong phai unique constraint.
- `StudentPromotionAssignment` gan mot policy version cho Student theo effective interval, reason va audit. Assignment la co che tong quat; he thong khong tu suy luan quan he gia dinh hoac thu tu con. Server evaluate policy khi tao/refresh Invoice `DRAFT` va evaluate lai truoc Issue; policy application snapshot version, target, ket qua, priority va assignment provenance neu co. Nhieu policy chi stack theo typed priority/exclusivity: fixed VND truoc percentage, tie-break deterministically, tong giam khong vuot gia goc target va khong tao dong am/credit vo danh.
- `PREPAID_COVERAGE` la fulfillment mode cua policy. Sau thoa thuan truc tiep voi Parent, chi School Admin chon policy/start period; API tinh eligibility/muc giam, tao dedicated `PREPAID` CollectionRun va source Invoice DRAFT gom future receivable-period facts. Source Invoice phai settle exact; chi sau `PAID` server moi issue `StudentPromotionalCoverage` voi PromotionPolicyVersion/Invoice/Receipt provenance. Khong actor nao tao coverage truc tiep. Moi fact luu Receivable, period key, service interval `[serviceFrom, serviceTo)` nam tron ky, gia/discount, calendar version/timezone va paid-source snapshot bat bien. Coverage issued khong overlap cung Student/SchoolYear/Receivable/ky; fact khong co operating day eligible bi tu choi.

#### FR-8: CollectionRun preview va generate

Finance Manager tao `MONTHLY`, `ANNUAL` hoac `ONE_OFF` CollectionRun, xem preview authoritative va generate Invoice `DRAFT` idempotent.

**He qua kiem thu:**
- Preview va generate dung cung service server-side; preview hien thi ly do skip va du lieu nguon can thiet de ra soat.
- Preview/generate tra promotion evaluation per target: applied, khong du dieu kien hoac bi loai theo stacking; browser khong tu tinh discount/total. Issue evaluate lai trong transaction; ket qua khac DRAFT snapshot bat buoc review lai.
- Moi Student co toi da mot Invoice trong mot CollectionRun; run co the co cung ky voi run khac.
- `MONTHLY` dung `billingMonth` chuan `YYYY-MM`; `ANNUAL` va `ONE_OFF` dung `periodKey` text ke toan nhap. Cac gia tri nay khong unique, nen mot SchoolYear co the co run chuan va run bo sung cung ky.
- Generate transactional tra created/skipped; timeout phai doi soat operation truoc retry.
- Lifecycle la `DRAFT -> READY -> GENERATED -> CLOSED`: rule sua o DRAFT, READY chi generate tu cau hinh hop le, GENERATED khoa rule/pham vi goc, CLOSED khong tao/sua Invoice. Generate phan loai toi thieu invoice ton tai, enrollment khong du dieu kien, khong co lop active va khong co rule.
- Sau GENERATED, Finance Manager/SCHOOL_ADMIN chi co the them Student chua co Invoice, tao dung mot `DRAFT` tu rule snapshot; them khoan moi cho Invoice da issue dung run bo sung.
- CollectionRun skip dung cap Student/Receivable/ky da duoc `StudentPromotionalCoverage` issued bao phu voi ly do `COVERED_BY_PROMOTIONAL_COVERAGE`; cac khoan thu eligible khac cua Student van duoc tao.

#### FR-9: Issue va snapshot nghia vu

Finance Manager ra soat Invoice `DRAFT`, override gia/quantity hoac them adjustment co ghi chu/audit, chon tai khoan active va issue Invoice.

**He qua kiem thu:**
- Invoice chi khoa noi dung khi issue; Finance Manager bat buoc chon mot BankAccount active cua dung School va Payment instruction snapshot account, chu tai khoan, transfer content va tong tien tai thoi diem issue.
- Invoice uu dai snapshot StudentPromotionalCoverage, PromotionPolicyVersion/application, cac receivable-period duoc bao phu, gia/discount, enrollment/lop, BankAccount va Payment instruction; Parent chi doc nghia vu da issue, khong tu chon uu dai.
- Payment instruction mac dinh snapshot `studentCode + className`; Parent doc snapshot, khong doc tai khoan live.
- Lifecycle la `DRAFT`, `ISSUED`, derived `PAID`, `VOIDED`; `PARTIALLY_PAID` khong ton tai. Client khong duoc set total, outstanding hay status.
- VND la so nguyen JSON-safe; khong dung float.

### 4.4 So cai thu tien, cong no va bao cao

**Mo ta:** Receipt, allocation, reversal/refund va debt duoc ghi append-only de settlement va report phan anh dong tien thuc. Realizes UJ-3.

#### FR-10: Receipt exact settlement va allocation

Finance Manager ghi Receipt de settle exact Invoice cua mot Student; khong tao balance nop truoc doc lap.

**He qua kiem thu:**
- Sai sot duoc xu ly bang void/reversal co ly do, audit va idempotency; khong sua tien goc da post.
- Reversal tuan theo mode direct hoac phe duyet hai buoc cua School.
- `DIRECT` cho School Admin/Finance Manager post reversal co ly do; `SCHOOL_ADMIN_APPROVAL` buoc Finance Manager tao request va School Admin khac identity phe duyet. Invoice chi `VOIDED` khi chua co allocation; receipt partial, du, unallocated hoac mixed-Student deu bi tu choi.
- Refund la ledger workflow append-only cho nghia vu da co source (vi du coverage da thanh toan, long leave/huy service): School Admin/Finance Manager tao refund request co amount, source, ly do va idempotency; post/refusal tuan theo reversal mode cua School, audit actor va Operation reconciliation. Refund khong sua Receipt hay Allocation goc.
- Moi Receipt chi settle mot hoac nhieu Invoice cung School, SchoolYear va Student khi moi Invoice duoc settle dung toan bo outstanding trong posting do; partial, excess, unallocated va mixed-Student Receipt bi tu choi toan bo. Khong tao `StudentPrepayment`, generic credit/balance hay ap dung so du cho Invoice tuong lai.
- Khi Student nghi/chuyen truong trong `StudentPromotionalCoverage` da thanh toan, server preview refund theo tung coverage fact tu service interval, paid snapshot amount va School calendar version/timezone da snapshot; loai tru withdrawal effective date va floor VND. `eligibleOperatingDays` phai duong, `remainingOperatingDays` khong vuot eligible days, va tong `calculatedAmount`/`approvedAmount` cua fact khong vuot paid snapshot amount tru di refund/reversal da post. `approvedAmount` phai khong am va override khac calculated amount bat buoc ly do. Refund append-only luu calculated/approved amount, coverage fact, Invoice/Receipt provenance va approval-mode outcome.

#### FR-11: Prior debt, settlement va report

He thong gop no mo trong cung SchoolYear vao Invoice moi bang `PRIOR_DEBT` truy vet duoc, ho tro year-end settlement va bao cao finance theo so cai.

**He qua kiem thu:**
- Debt transfer atomic loai gia tri da chuyen khoi outstanding nguon, tranh thu/den hai lan.
- Khong auto-carryover sang SchoolYear moi; write-off, adjustment hay thu tien co audit.
- Report tach gross, promotion discount theo policy/version, refund, net billed, receipt, allocation, coverage va outstanding theo School, run, period, group, class va status.
- Report giu provenance cua StudentPromotionalCoverage/refund khi ap dung va khong co nhom trang thai partial payment.

### 4.5 Van hanh lop hoc

**Mo ta:** Attendance, leave, service enrollment, handover va DailyJournal tao du lieu van hanh co audit. Teacher portal so huu UI thao tac lop; Finance chi tham chieu attendance/handover, khong tu dong suy dien engine fee. Realizes UJ-5, UJ-6.

#### FR-12: Leave, attendance va service enrollment

Parent chi co the gui leave request cho Student duoc uy quyen; Teacher co capability ghi attendance, handover va DailyJournal trong Class duoc phan cong; School Admin/Finance Manager quan ly approval/service enrollment theo policy.

**He qua kiem thu:**
- Calendar loai ngay nghi/le; `PRESENT` conflict voi leave request va loai ngay do khoi de xuat meal adjustment.
- Leave truoc deadline auto-approve; sau deadline can role duoc cap phe duyet.
- Attendance photo evidence tuan theo mode cua School, Parent khong xem evidence; retention la hai thang lich.
- `AttendancePolicy.photoEvidenceMode` la `REQUIRED` hoac `OPTIONAL`; REQUIRED tu choi PRESENT khong co evidence. Evidence chi Staff co capability attendance hoac School Admin dung School scope xem, xoa blob/preview sau hai thang lich va giu audit metadata xoa.
- Sau attendance event, Parent chi nhan in-app notification event theo StudentParent link active; notification khong chua evidence anh va khong mo rong thanh SMS, email, Zalo hay chat.
- StudentServiceEnrollment co status, effective dates va audit; chi School Admin/Finance Manager tao/huy. Parent co the tao, sua/huy leave request khi PENDING; khong tu huy service.
- Parent hoac School Admin co the tao long leave; chi School Admin duyet/tu choi va chon effective date khong truoc ngay request. Approval dung eligibility CollectionRun tuong lai; Invoice da issue dung adjustment/refund co source.
- Meal adjustment la dong am co source tren Invoice DRAFT ke tiep; Saturday MANUAL phai kiem tra service coverage de khong charge trung.
- Teacher tao mot DailyJournal hien hanh theo Student/ngay trong `Asia/Ho_Chi_Minh`; sua trong ngay tao version/audit bat bien. Anh journal chi nhan JPEG/PNG/WebP toi da 10 MB moi anh, khong gioi han so anh va khong dung chung attendance evidence.
- Parent chi xem current DailyJournal va media cua Student co `StudentParent` active; API re-authorize tung Student/media request va ap dung 30 ngay operational retention sau `StudentEnrollment.endedOn`. Parent DTO khong co Staff identity, Class list, audit/version history, storage key hay attendance evidence.

#### FR-13: Handover va late pickup reference

Nhan vien duoc cap capability ghi picked-up time; policy cutoff/grace/block la reference de Finance them dong `MANUAL` trong Invoice `DRAFT` khi can.

**He qua kiem thu:**
- He thong khong tu dong tinh late-pickup fee trong release nay.
- Handover khong thay the pickup authorization, la domain deferred rieng.
- Reference snapshot va audit giu du thong tin de Finance giai thich dong thu thu cong.

### 4.6 Payroll opt-in, nhan su va cham cong

**Mo ta:** Payroll la capability tuy chon cua tung School, tach biet voi so thu Student. Tai School duoc phep, Ke toan quan ly dieu khoan lao dong, nhap/ra soat cham cong va lap bang luong; School Admin duyet, reopen va phe duyet correction.

`Ke toan` la persona cua active same-School `FINANCE_MANAGER`, khong phai preset role moi. Moi route/job/action can Payroll entitlement va capability chuyen biet; entitlement khong tu cap role/capability va UI khong thay server authorization.

#### FR-14: Payroll entitlement, workforce va timekeeping

Platform Operations chi cap Payroll cho School duoc chon thu nghiem/phan phoi; tai School da cap, Ke toan/School Admin quan ly EmploymentContract, ma may cham cong, file import va ket qua ngay cong da ra soat.

**He qua kiem thu:**
- Entitlement server-side theo School co lifecycle `NOT_ENTITLED`, `PILOT_ENABLED`, `ENABLED`, `SUSPENDED`, `RETIRED`; route, job, UUID hay cache client khong the vuot gate. Entitlement khong tu cap role/capability.
- Actor thieu entitlement hoac capability bi tu choi truoc aggregate lookup; deep link, menu, job va API discovery khong lo Payroll record. `FINANCE_MANAGER` can capability prepare/reconcile/timekeeping tuong ung, con `SCHOOL_ADMIN` chi co action duyet/reopen khi duoc cap capability rieng.
- `SUSPENDED` chan import, calculate, approval, correction va payout moi nhung giu read-only lich su da duyet/da chi cho actor duoc cap quyen. `RETIRED` khong xoa data va re-enable can onboarding/audit explicit. Disable bi chan khi con payroll obligation, import dang xu ly hoac advance reservation chua resolve.
- EmploymentContract/compensation terms effective-dated snapshot luong co ban, luong thu viec, muc dong BHXH doc lap va phu cap co dinh; khong overwrite term da duoc payroll snapshot.
- File CSV/XLSX dung machine employee code va ten nguon de doi soat. Code duoc map effective-dated voi dung mot Staff tai mot thoi diem/source/School; ten chi la evidence. Raw `IN`/`OUT` event da commit append-only; correction thu cong co ly do/audit, khong sua event goc.
- Payroll chi dung `StaffWorkdayRecord` da review, quy doi theo common School work schedule MVP va ca trong muon do Ke toan/School Admin xac nhan. Handover hay check-out muon khong tu dong tao khoan tra them.

#### FR-15: Payroll calculate, approval, payout va correction

Ke toan lap/reconcile bang luong versioned cho ky thuong hoac ky luong thang 13; School Admin duyet, reopen khi chua chi va phe duyet correction sau chi.

**He qua kiem thu:**
- API tinh VND integer tu typed, versioned policy co effective date va snapshot input/component: luong co ban/thu viec, nghi co/khong phep, thuong chuyen can, phu cap co dinh/trong muon, BHXH/BHYT/BHTN, TNCN, tam ung va dieu chinh co ly do. Khong cho user luu arbitrary Excel formula, script, SQL hay bieu thuc tu do.
- `insuranceSalaryBase` doc lap voi luong thuc nhan. Tax/BHXH policy co rate/bracket/reduction schema-validated; Ke toan duoc doi soat va override co ly do, nhung he thong khong tu nop ho so hay tu nhan certified legal compliance.
- Payroll run co draft/calculated version, approved snapshot va payout state. School Admin reopen approved unpaid run voi ly do de tao draft version moi; approved version cu van audit. Payroll da co payout khong reopen.
- `FINANCE_MANAGER` co `PAYROLL_PREPARE`/`PAYROLL_RECONCILE` prepare, materially edit/reconcile va submit. Chi `SCHOOL_ADMIN` co `PAYROLL_APPROVE` va UserIdentity khac moi preparer/material editor cung submitter moi review/approve/refuse; server so sanh identity thuc, nen nhieu grant khong cho self-approve. `SCHOOL_ADMIN` co `PAYROLL_REOPEN` reopen run approved chua payout. Sau approve, chi `FINANCE_MANAGER` co `PAYROLL_PAYOUT_CONFIRM` xac nhan payout; School Admin khong ke thua action nay.
- Sai sot sau payout tao correction run rieng co source version, delta duong/am, audit va workflow Finance Manager prepare/submit -> School Admin khac identity approve/refuse -> Finance Manager xac nhan payout; payroll goc giu `PAID`.
- SalaryAdvance reserve khi payroll duyet, release khi unpaid run reopen va giam `remainingAmount` atomically khi payout. Luong thang 13 la ky/run rieng, khong nhung vao payroll thang 12.
- Bonus theo si so la extension point typed rule; chua duoc phat hanh cho den khi co policy School-approved ve cach dem, phan bo giao vien, transfer va thay doi phan cong giua ky.

### 4.7 Parent multi-school portal

**Mo ta:** Parent dung portal/PWA tach biet, chon School tu StudentParent link active, xem nghia vu va huong dan thanh toan read-only; Parent data khong cache trong service worker. Realizes UJ-4.

#### FR-16: Parent authorization va retention

Parent duoc cap session khi Google identity da xac minh va co link active; Parent co mot School vao thang home, nhieu School dung chooser. Parent duoc doc attendance va DailyJournal rieng biet, khong co quyen mutation operational.

**He qua kiem thu:**
- Parent school A khong the expose tre, Invoice hay finance cua school B bang route/filter/UUID.
- Moi Parent attendance list/detail query phai join/filter theo `StudentParent` active cua chinh `studentId` duoc tra ve hoac duoc yeu cau; lien ket voi mot Student khong cap quyen xem attendance cua Student khac trong cung School.
- Revoke, `401`, expiry va logout xoa client state truoc protected view; response Parent khong duoc service worker cache.
- Tu `StudentEnrollment.endedOn`, operational/sensitive data chi con xem 30 ngay lich. Invoice issued, Payment instruction va Receipt/refund con xem khi Invoice exact settlement, prepaid-payment coverage refund hoac ledger correction chua hoan tat; sau khi cac nghia vu nay settlement day du, ParentAccessPolicy server-side mac dinh 12 thang va co version/audit.
- Parent xem lich su attendance theo ngay cua Student duoc uy quyen trong retention operational data, voi `PRESENT`, `ABSENT`, `ON_LEAVE` hoac `NOT_RECORDED`. `NOT_RECORDED` luon duoc dien dat la truong chua ghi nhan, khong la ket luan vang mat.
- Parent attendance DTO chi gom `studentId`, snapshot ten hien thi cua Student, ngay, trang thai va thoi diem cap nhat can thiet; khong lo truong ho so Student khac, Staff, ly do noi bo, evidence/media, danh sach lop hay attendance cua Student khac. Parent khong tao, sua hay xac nhan attendance.
- Parent DailyJournal DTO rieng chi gom Student display-name snapshot, journal date, current text, updated time va media metadata toi thieu; media read khong tra permanent URL va re-authorize Parent/Student/retention tren moi request. Parent khong tao, sua hay xem version/audit journal.

#### FR-17: Nghia vu va payment instruction read-only

Parent xem Invoice/obligation `ISSUED` con outstanding va Payment instruction snapshot khi du dieu kien. VietQR, copy fields va deep link la enhancement chi duoc phat hanh sau khi UX/Architecture chot contract, fallback va device/browser governance.

**He qua kiem thu:**
- Parent khong post Receipt, khong xac nhan payment va khong sua finance/school data.
- Payment instruction chi doc snapshot va khong doi settlement hay Invoice state.
- Parent DTO toi thieu, khong lo audit noi bo, tai khoan nguon hien hanh hay du lieu tre khac.
- MVP E7 bat buoc hien thi Payment instruction text tu snapshot cho nghia vu outstanding. Khong co payment action khi khong con outstanding. VietQR/copy fields/deep link khong la dieu kien phat hanh E7 va khong lam thay doi settlement.
- Parent khong co package catalog/request, promotional coverage, refund hay payment-confirmation action.

## 5. Non-goals ro rang

- Khong duy tri compatibility layer, dual schema, dual finance lifecycle hay migration production cho clean-break nay.
- Khong co bank synchronization, webhook, virtual account hay Parent self-confirmation payment.
- Khong co tax calculation/VAT invoice; tax treatment chi la label/snapshot.
- Khong co custom-role checkbox UI, Organization hierarchy, custom school domain, support impersonation/JIT, shared catalog live giua School.
- Khong co chat, SMS/Zalo/email, album tu do, meal journal, medical/medication, transport, pickup authorization hay import/onboarding tong quat trong release dau. Payroll chi la capability opt-in theo FR-14/FR-15; DailyJournal per Student/date voi text va anh la ngoai le da duoc dinh nghia o FR-12/FR-16.
- Khong co automatic late-pickup fee, pricing engine tu attendance/handover, hay Parent mutation finance/service cancellation.

## 6. Pham vi release va trinh tu

### 6.1 Trong pham vi initiative

1. Platform multi-school, identity, authorization, chooser/switcher va narrow Operations provisioning.
2. School profile/calendar, SchoolYear, roster, Parent links, Staff profile/assignment va typed policies.
3. Finance catalog, discount, prepaid-payment promotion program, CollectionRun, Invoice obligation, ledger, debt, exact settlement va reports.
4. Attendance, leave, service registration, handover, meal-adjustment input va Parent multi-school finance portal.
5. Payroll opt-in: workforce terms, file-based timekeeping, payroll calculation/approval/payout/correction va thirteenth-month pay.

### 6.2 Thu tu phat hanh rang buoc

- Release 1: E1 platform identity/access/control plane; tenant-isolation tests la blocker.
- Release 2: E2 school foundation/roster sau E1 tenant-isolation gate; E3 finance configuration chi sau E1 va E2.
- Release 3: E4 attendance/leave/service/handover sau E2; E5 collection runs/invoices chi sau E2, E3 va E4; E6 ledger/report sau E5.
- Release 4: E7 Parent multi-school finance portal sau E1, E2 va E6.
- Release 5: Payroll E8 sau E1, E2, E3 va Payroll entitlement gate; E9 timekeeping sau E8; E10 regular payroll sau E8/E9; E11 correction/thirteenth-month sau E10. Payroll chi rollout tai School `PILOT_ENABLED` hoac `ENABLED`.

## 7. Yeu cau chat luong, bao mat va governance

- API la nguon chan ly cho authorization, money, policy, snapshots, state transition va report; frontend/PWA chi goi REST.
- Moi mutation cookie-auth co origin validation va double-submit CSRF; mutation high-impact dung idempotency UUID va operation reconciliation.
- Topology release nay co dinh: Admin `app.passionedu.org`, Teacher `teacher.passionedu.org`, Parent `parent.passionedu.org`, Platform Operations `ops.passionedu.org` va API `api.passionedu.org`. Moi portal dung OAuth callback, session audience, cookie host-only va allowlisted origin rieng; khong chia cookie `.passionedu.org` mac dinh va khong dung domain per-School.
- Mo hinh du lieu tre em va Parent ap dung DTO toi thieu, server-side authorization, status/revoke thay hard delete, audit va retention policy.
- Moi thay doi money, attendance, access, role, policy va settlement co actor, thoi diem, provenance va ly do khi yeu cau.
- Cross-tenant isolation, authorization/revoke, concurrency/idempotency, ledger va Parent cross-school E2E la release-blocking verification.
- Idempotency Operation la bat buoc cho generate run, chuyen lop/chuyen nam/close-year batch, issue, receipt/allocation, prepaid-promotion selection, reversal/refund va approval. Sau timeout, client doi soat `GET /operations/:operationId` truoc retry.
- Payroll high-impact mutation gom import commit, calculate, submit, approve/refuse, reopen, correction submit/approval/refusal va payout confirmation; deu dung transaction, idempotency UUID, Operation reconciliation va audit reason.
- [ASSUMPTION] P95 read API <= 500 ms va preview/report <= 3 s voi fixture acceptance; generate 1,000 Student <= 60 s va co progress Operation. Accessibility cho hai portal dat WCAG 2.1 AA; revoke/suspend co hieu luc request ke tiep va audit retention/backup/recovery SLA se duoc Architecture chot truoc production.

## 8. Thanh cong va counter-metrics

**Primary**
- **SM-1:** 100% bo cross-tenant authorization test bat buoc pass truoc moi release. Validates FR-2, FR-3, FR-16.
- **SM-2:** 100% CollectionRun generate co the reconciliation bang operation va khong tao Invoice trung trong integration test. Validates FR-8.
- **SM-3:** 100% finance report fixture doi chieu dung gross, discount/refund, receipt, allocation, prepaid-payment coverage va outstanding. Validates FR-10, FR-11.

**Secondary**
- **SM-4:** School Admin hoan tat setup SchoolYear, Class va StudentEnrollment cua fixture trong mot luong co audit. Validates FR-4 den FR-6.
- **SM-5:** Parent chi xem dung school/Student duoc uy quyen, attendance status va finance read model sau chooser, revoke va session expiry test. Validates FR-16, FR-17.
- **SM-6:** Trong pilot 30 ngay, >= 90% School setup fixture duoc School Admin hoan tat khong can can thiep ky thuat; 100% exception co audit. [ASSUMPTION] Validates FR-4 den FR-6.
- **SM-7:** Trong pilot 30 ngay, >= 95% Invoice issued co the reconcile ve ledger; 0 incident tenant leak hoac finance posting trung duoc xac nhan. [ASSUMPTION] Validates FR-3, FR-8 den FR-11.
- **SM-8:** 100% fixture Payroll anonymized co the reconcile tung component voi input snapshot/Excel expected output; khong co payout/correction duplicate trong integration suite. Validates FR-14, FR-15.

**Counter-metrics**
- **SM-C1:** Khong danh doi tenant isolation de giam so man hinh/chuyen School. Counterbalances SM-4, SM-5.
- **SM-C2:** Khong toi uu auto-fee hay auto-settlement khi chua co policy da duyet. Counterbalances SM-2, SM-3.
- **SM-C3:** Bat ky cross-tenant access attempt thanh cong hoac duplicate ledger post la release/incident escalation, khong duoc trade-off de tang throughput. Counterbalances SM-1 den SM-3.
- **SM-C4:** Khong mo Payroll cho School chua duoc entitlement hoac bo qua correction/audit de giu thao tac nhu Excel. Counterbalances SM-8.

## 9. Rui ro va giam thieu

- Tenant leak qua query UUID, unique/index khong scoped hoac client-supplied context: bat buoc school-scoped service/query/constraint va negative tests.
- Ledger sai do sua state/tong tien truc tiep: append-only settlement, snapshot va reconciliation tests.
- Policy/du lieu tre em nhay cam bi overwrite hoac lo tren shared device: version/audit/retention, Parent DTO toi thieu va cache clearing.
- Scope creep tu catalog Kidsonline: capability chi duoc phat hanh khi co domain PRD/policy/chiu trach nhiem van hanh.
- Clean-break tren du lieu that: initiative nay chi ap dung khi du lieu van hanh chua ton tai; onboarding/migration sau core la workstream rieng.

## 10. Cau hoi mo

1. Co phat hanh VietQR/copy fields/deep link sau E7 khong; neu co thi contract snapshot, fallback va UX la gi? Owner: Product + Architecture; can chot truoc release enhancement.
2. Neu phat hanh deep link, danh sach ngan hang, device matrix va governance config la gi? Owner: Product; can chot truoc release enhancement.
3. Support JIT access sau release dau co can thiet khong, va neu co thi approval/retention/audit ra sao? Owner: Platform Operations; deferred.
4. Shared catalog/policy giua School co can sau release dau khong? Mac dinh copy-from-template co audit, khong live-share. Owner: Product; deferred.
5. Quy tac transport, pickup authorization, album, medical, communications va import/onboarding can PRD rieng truoc khi dua vao roadmap. Owner: Product; deferred.
6. Architecture phai chot SLO availability, RPO/RTO, audit/backup retention, rate limit va production performance benchmark truoc production gate. Owner: Architecture; gate truoc rollout.
7. Platform Operations xac nhan bang chung khong co du lieu van hanh that truoc clean-break implementation; neu co, dung initiative va mo onboarding/migration workstream. Owner: Product + Platform Operations; gate truoc E1 implementation.

## 11. Assumptions index

- `[ASSUMPTION]` SM-4 duoc do bang fixture/acceptance environment vi chua co baseline thoi gian van hanh that.
- Parent Payment instruction MVP la text snapshot; VietQR, copy fields va deep link la enhancement sau E7.
- Retention Parent finance mac dinh 12 thang sau settlement duoc ap dung server-side theo proposal; School co the version policy trong tuong lai.
- `[ASSUMPTION]` Cac nguong performance, pilot adoption va outcome o sections 7-8 la target khoi dau can Architecture/Product baseline truoc production.
