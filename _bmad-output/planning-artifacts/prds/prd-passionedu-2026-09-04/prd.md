---
title: "PRD Initiative - PassionEdu: Nen tang van hanh da truong"
status: final
created: 2026-09-04
updated: 2026-09-04
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
- Class Teacher, Attendance Recorder va Handover Recorder can ghi nhan van hanh lop hoc trong pham vi capability duoc cap.
- Parent can chon dung truong/con, xem nghia vu duoc uy quyen, gui don nghi va lay huong dan thanh toan ma khong xem du lieu noi bo hay cua tre khac.

### 2.2 Khong phai nguoi dung release dau

- Nguoi dung khong co `UserIdentity`, `SchoolMembership` hay lien ket Parent-Hoc sinh active khong truy cap du lieu nghiep vu.
- Platform Operator khong la School Admin mac dinh.
- Parent khong la nguoi ghi receipt, sua finance, xac nhan thanh toan, sua danh bo hay xem bang chung diem danh.

### 2.3 Hanh trinh chinh

- **UJ-1. Linh provision truong moi.** Linh la Platform Operator, dang nhap Ops portal va tao `School`, suspend/reactivate khi can, dong thoi bootstrap owner theo email. Khi owner dang nhap Google, ho chi vao dung school shell va Linh khong tu nhien co quyen doc du lieu cua truong.
- **UJ-2. Hoa thiet lap nam hoc va danh bo.** Hoa la School Admin cua Anh Hoa. Chi trong school context Anh Hoa, Hoa tao `SchoolYear` active, lop, hoc sinh, lien ket Parent va Staff assignment. Chuyen nam/doi lop tao lich su enrollment thay vi sua qua khu.
- **UJ-3. Minh phat hanh dot thu.** Minh la Finance Manager, chon `CollectionRun`, xem ma tran preview do server tinh, tao `DRAFT`, ra soat/ghi ly do cho dieu chinh, chon tai khoan nhan tien va issue. Minh ghi receipt va phan bo tien; so tien con no duoc suy ra tu so cai, khong tu trang thai client.
- **UJ-4. Mai xem nghia vu cua con.** Mai co con tai mot hoac nhieu `School`, chon dung school, xem nghia vu/huong dan thanh toan da duoc cap quyen va gui don nghi. Mai khong the gui receipt, xac nhan thanh toan hay thay doi du lieu truong.
- **UJ-5. An ghi nhan ngay hoc.** An la nhan vien duoc cap capability, ghi diem danh va ban giao tre theo policy cua truong. Don nghi, lich truong va attendance conflict duoc server xu ly; Finance chi tham chieu du lieu nay khi ra soat dong `MANUAL` hoac dieu chinh tien an.

## 3. Thuat ngu

- **School** - Tenant root; moi du lieu nghiep vu va policy thuoc mot School.
- **UserIdentity** - Identity Google canonical toan platform, khong chua role hay `schoolId`.
- **SchoolMembership** - Quyen truy cap active cua UserIdentity tai mot School.
- **SchoolRoleGrant** - Role preset gan cho SchoolMembership de cap capability.
- **SchoolYear** - Ranh gioi du lieu nam hoc cua mot School; toi da mot SchoolYear active.
- **StudentEnrollment** - Trang thai va lop cua Student trong mot SchoolYear.
- **ParentProfile** - Persona Parent toan platform; school context suy ra tu lien ket Parent-Hoc sinh.
- **StudentParent** - Lien ket active/revoked giua ParentProfile va Student; la nguon duy nhat cap Parent school context va quyen portal.
- **Staff assignment** - Gan Staff vao mot hoac nhieu Class theo effective date; khong tu cap login, role hay phan biet giao vien chinh/phu.
- **ReceivableGroup / Receivable** - Nhom va khoan thu scoped theo School; danh muc co the inactive nhung khong sua snapshot lich su.
- **ChargeRule** - Rule scoped theo School, Class hoac Student trong CollectionRun; quantity chi `FIXED` hoac `MANUAL`.
- **DiscountPolicy** - Chinh sach giam tru theo tien hoac phan tram, co scope, thoi han va nguon snapshot.
- **CollectionRun** - Dot thu cua SchoolYear de preview va tao nghia vu cho hoc sinh.
- **Invoice** - Nghia vu thu theo mot Student va mot CollectionRun; noi dung khoa sau khi issue.
- **Receipt** - Khoan thu da ghi nhan; phan bo vao Invoice qua so cai append-only.
- **Prepayment** - Khoan nop truoc gan co dinh mot Student, chi ap dung cho nghia vu tuong lai cua Student do.
- **Payment instruction** - Ban chup tai khoan nhan va noi dung chuyen khoan cua Invoice da issue.
- **Operation** - Ban ghi doi soat cua mutation idempotent, scoped theo School va actor membership.

## 4. Tinh nang va yeu cau chuc nang

### 4.1 Nen tang da truong, identity va phan quyen

**Mo ta:** PassionEdu tach Platform Operations, Admin/Staff va Parent thanh cac surface/session doc lap. Moi request nghiep vu chi duoc xu ly trong School context va sau khi server kiem tra quyen hien hanh. Realizes UJ-1, UJ-2, UJ-4.

#### FR-1: Provision va vong doi School

Platform Operator co the tao, suspend, reactivate School va bootstrap School Admin dau tien theo email.

**He qua kiem thu:**
- Suspend chan business request ke tiep cua School ma khong can xoa global identity session.
- School khong hard-delete.
- Platform capability khong tu dong cap quyen doc/ghi du lieu School.
- `SUPERADMIN_EMAIL` chi bootstrap `PlatformOperatorGrant` qua environment; Ops authorize bang audience `ops` va grant nay, khong tao OpsUser hay password mac dinh.
- Provisioning tao/tai su dung UserIdentity pending theo normalized email cua owner va atomically tao SchoolMembership pending cung `SCHOOL_ADMIN` grant. Google subject chi bind khi owner dang nhap Google, sau do owner vao dung School shell; failure khong duoc de lai identity, membership hay grant partial.

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
- FinancePolicy bao gom due date, tax treatment label, Prepayment/debt trong SchoolYear, reversal mode va BankAccount cua School. BankAccount co lifecycle active/inactive; Invoice da issue giu snapshot account, chu tai khoan va Payment instruction nen thay doi/inactive account khong sua lich su.

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

School Admin quan ly lien ket Parent-Hoc sinh va Staff profile/assignment theo effective date. Parent Profile dung chung toan platform; Staff profile khong tu tao login hay quyen.

**He qua kiem thu:**
- Parent co the co nhieu tre/School, nhung chi nhan data theo link active tai request.
- Revoke Parent link co hieu luc request tiep theo va giu lich su/audit.
- Student, Parent, Staff va enrollment da phat sinh van hanh khong hard-delete.
- School Admin co the tao Parent pending voi email normalized, ten va so dien thoai bat buoc truoc Google login; Parent chi tu sua so dien thoai co audit, khong sua identity, link hay quyen.
- Khi Parent dang nhap Google verified, server atomically tim ParentProfile pending theo normalized email, bind dung UserIdentity/Google subject va chi cap Parent session neu ParentProfile co StudentParent active. Sub mismatch hay email reassigned bi tu choi den khi School Admin revoke va gan lai; session luon dai dien dung ParentProfile da bind.
- Staff release dau gom ho ten, email, so dien thoai, ngay sinh, gioi tinh, dia chi; khong co HR/payroll/password hay phan loai giao vien chinh/phu.

### 4.3 Khoan thu, dot thu va nghia vu

**Mo ta:** Finance Manager quan ly danh muc khoan thu va CollectionRun; server la nguon chan ly cho preview, rule precedence, VND va snapshot. Realizes UJ-3.

#### FR-7: Danh muc va rule ap dung

Finance Manager hoac School Admin quan ly ReceivableGroup, Receivable, DiscountPolicy va ChargeRule scoped theo School.

**He qua kiem thu:**
- School tu dinh nghia group, khoan, don vi, gia, hoan tra va rule; ma khoan la tuy chon va unique trong School neu co.
- Precedence la `STUDENT` > `CLASS` > `SCHOOL`; conflict cung do dac hieu bi tu choi.
- Thay doi danh muc/policy khong sua Invoice snapshot trong qua khu.
- ChargeRule chi co quantity `FIXED` hoac `MANUAL`; Finance Manager/SCHOOL_ADMIN nhap/override quantity, gia hoac adjustment trong Invoice `DRAFT` co ghi chu/audit. Khong co auto-pricing tu attendance, handover hay service enrollment. Gia la gia mac dinh cua Receivable hoac override duoc audit trong Invoice `DRAFT`.
- DiscountPolicy la phan tram hoac so tien, co effective period, School/Class/Student scope va Receivable scope; discount khong lam dong am hay tao credit vo danh.

#### FR-8: CollectionRun preview va generate

Finance Manager tao `MONTHLY`, `ANNUAL` hoac `ONE_OFF` CollectionRun, xem preview authoritative va generate Invoice `DRAFT` idempotent.

**He qua kiem thu:**
- Preview va generate dung cung service server-side; preview hien thi ly do skip va du lieu nguon can thiet de ra soat.
- Moi Student co toi da mot Invoice trong mot CollectionRun; run co the co cung ky voi run khac.
- `MONTHLY` dung `billingMonth` chuan `YYYY-MM`; `ANNUAL` va `ONE_OFF` dung `periodKey` text ke toan nhap. Cac gia tri nay khong unique, nen mot SchoolYear co the co run chuan va run bo sung cung ky.
- Generate transactional tra created/skipped; timeout phai doi soat operation truoc retry.
- Lifecycle la `DRAFT -> READY -> GENERATED -> CLOSED`: rule sua o DRAFT, READY chi generate tu cau hinh hop le, GENERATED khoa rule/pham vi goc, CLOSED khong tao/sua Invoice. Generate phan loai toi thieu invoice ton tai, enrollment khong du dieu kien, khong co lop active va khong co rule.
- Sau GENERATED, Finance Manager/SCHOOL_ADMIN chi co the them Student chua co Invoice, tao dung mot `DRAFT` tu rule snapshot; them khoan moi cho Invoice da issue dung run bo sung.

#### FR-9: Issue va snapshot nghia vu

Finance Manager ra soat Invoice `DRAFT`, override gia/quantity hoac them adjustment co ghi chu/audit, chon tai khoan active va issue Invoice.

**He qua kiem thu:**
- Invoice chi khoa noi dung khi issue; Finance Manager bat buoc chon mot BankAccount active cua dung School va Payment instruction snapshot account, chu tai khoan, transfer content va tong tien tai thoi diem issue.
- Payment instruction mac dinh snapshot `studentCode + className`; Parent doc snapshot, khong doc tai khoan live.
- Lifecycle la `DRAFT`, `ISSUED`, derived `PARTIALLY_PAID`/`PAID`, `VOIDED`; client khong duoc set total, outstanding hay status.
- VND la so nguyen JSON-safe; khong dung float.

### 4.4 So cai thu tien, cong no va bao cao

**Mo ta:** Receipt, allocation, Prepayment, reversal/refund va debt duoc ghi append-only de settlement va report phan anh dong tien thuc. Realizes UJ-3.

#### FR-10: Receipt, allocation va Prepayment

Finance Manager ghi Receipt, phan bo vao Invoice va ap dung Prepayment cua dung Student theo policy.

**He qua kiem thu:**
- Sai sot duoc xu ly bang void/reversal co ly do, audit va idempotency; khong sua tien goc da post.
- Prepayment khong la credit balance dung chung hay chuyen nhuong giua Student.
- Reversal tuan theo mode direct hoac phe duyet hai buoc cua School.
- `DIRECT` cho School Admin/Finance Manager post reversal co ly do; `SCHOOL_ADMIN_APPROVAL` buoc Finance Manager tao request va School Admin khac actor phe duyet. Invoice chi VOIDED khi chua co allocation/prepayment; receipt thua bi tu choi tru khi tao Prepayment ro rang.
- Refund la ledger workflow append-only cho Prepayment hoac nghia vu da co source (vi du long leave/huy service): School Admin/Finance Manager tao refund request co amount, source, ly do va idempotency; post/refusal tuan theo reversal mode cua School, audit actor va Operation reconciliation. Refund khong sua Receipt, Allocation hay Prepayment goc.

#### FR-11: Prior debt, settlement va report

He thong gop no mo trong cung SchoolYear vao Invoice moi bang `PRIOR_DEBT` truy vet duoc, ho tro year-end settlement va bao cao finance theo so cai.

**He qua kiem thu:**
- Debt transfer atomic loai gia tri da chuyen khoi outstanding nguon, tranh thu/den hai lan.
- Khong auto-carryover sang SchoolYear moi; write-off, adjustment hay thu tien co audit.
- Report tach gross, discount/refund, net billed, receipt, allocation, Prepayment va outstanding theo School, run, period, group, class va status.

### 4.5 Van hanh lop hoc

**Mo ta:** Attendance, leave, service enrollment va handover tao du lieu van hanh co audit. Finance chi tham chieu, khong tu dong suy dien engine fee tu attendance/handover. Realizes UJ-5.

#### FR-12: Leave, attendance va service enrollment

Parent chi co the gui leave request cho Student duoc uy quyen; nhan vien co capability ghi attendance; School Admin/Finance Manager quan ly approval/service enrollment theo policy.

**He qua kiem thu:**
- Calendar loai ngay nghi/le; `PRESENT` conflict voi leave request va loai ngay do khoi de xuat meal adjustment.
- Leave truoc deadline auto-approve; sau deadline can role duoc cap phe duyet.
- Attendance photo evidence tuan theo mode cua School, Parent khong xem evidence; retention la hai thang lich.
- `AttendancePolicy.photoEvidenceMode` la `REQUIRED` hoac `OPTIONAL`; REQUIRED tu choi PRESENT khong co evidence. Evidence chi Staff co capability attendance hoac School Admin dung School scope xem, xoa blob/preview sau hai thang lich va giu audit metadata xoa.
- Sau attendance event, Parent chi nhan in-app notification event theo StudentParent link active; notification khong chua evidence anh va khong mo rong thanh SMS, email, Zalo hay chat.
- StudentServiceEnrollment co status, effective dates va audit; chi School Admin/Finance Manager tao/huy. Parent co the tao, sua/huy leave request khi PENDING; khong tu huy service.
- Parent hoac School Admin co the tao long leave; chi School Admin duyet/tu choi va chon effective date khong truoc ngay request. Approval dung eligibility CollectionRun tuong lai; Invoice da issue dung adjustment/refund co source.
- Meal adjustment la dong am co source tren Invoice DRAFT ke tiep; Saturday MANUAL phai kiem tra service coverage de khong charge trung.

#### FR-13: Handover va late pickup reference

Nhan vien duoc cap capability ghi picked-up time; policy cutoff/grace/block la reference de Finance them dong `MANUAL` trong Invoice `DRAFT` khi can.

**He qua kiem thu:**
- He thong khong tu dong tinh late-pickup fee trong release nay.
- Handover khong thay the pickup authorization, la domain deferred rieng.
- Reference snapshot va audit giu du thong tin de Finance giai thich dong thu thu cong.

### 4.6 Parent multi-school portal

**Mo ta:** Parent dung portal/PWA tach biet, chon School tu StudentParent link active, xem nghia vu va huong dan thanh toan read-only; Parent data khong cache trong service worker. Realizes UJ-4.

#### FR-14: Parent authorization va retention

Parent duoc cap session khi Google identity da xac minh va co link active; Parent co mot School vao thang home, nhieu School dung chooser.

**He qua kiem thu:**
- Parent school A khong the expose tre, Invoice hay finance cua school B bang route/filter/UUID.
- Revoke, `401`, expiry va logout xoa client state truoc protected view; response Parent khong duoc service worker cache.
- Tu `StudentEnrollment.endedOn`, operational/sensitive data chi con xem 30 ngay lich. Invoice issued, Payment instruction, Receipt/refund con xem khi balance, Prepayment hoac refund chua settlement; sau settlement ParentAccessPolicy server-side mac dinh 12 thang va co version/audit.

#### FR-15: Nghia vu va payment instruction read-only

Parent xem Invoice/obligation da authorize va Payment instruction snapshot khi du dieu kien. VietQR, copy fields va deep link la enhancement chi duoc phat hanh sau khi UX/Architecture chot contract, fallback va device/browser governance.

**He qua kiem thu:**
- Parent khong post Receipt, khong xac nhan payment va khong sua finance/school data.
- Payment instruction chi doc snapshot va khong doi settlement hay Invoice state.
- Parent DTO toi thieu, khong lo audit noi bo, tai khoan nguon hien hanh hay du lieu tre khac.
- MVP E7 bat buoc hien thi Payment instruction text tu snapshot cho nghia vu outstanding. Khong co payment action khi khong con outstanding. VietQR/copy fields/deep link khong la dieu kien phat hanh E7 va khong lam thay doi settlement.

## 5. Non-goals ro rang

- Khong duy tri compatibility layer, dual schema, dual finance lifecycle hay migration production cho clean-break nay.
- Khong co bank synchronization, webhook, virtual account hay Parent self-confirmation payment.
- Khong co tax calculation/VAT invoice; tax treatment chi la label/snapshot.
- Khong co custom-role checkbox UI, Organization hierarchy, custom school domain, support impersonation/JIT, shared catalog live giua School.
- Khong co chat, SMS/Zalo/email, album, meal/daily journal, medical/medication, transport, pickup authorization, HR/payroll hay import/export trong release dau.
- Khong co automatic late-pickup fee, pricing engine tu attendance/handover, hay Parent mutation finance/service cancellation.

## 6. Pham vi release va trinh tu

### 6.1 Trong pham vi initiative

1. Platform multi-school, identity, authorization, chooser/switcher va narrow Operations provisioning.
2. School profile/calendar, SchoolYear, roster, Parent links, Staff profile/assignment va typed policies.
3. Finance catalog, discount, CollectionRun, Invoice obligation, ledger, debt, Prepayment, settlement va reports.
4. Attendance, leave, service registration, handover, meal-adjustment input va Parent multi-school finance portal.

### 6.2 Thu tu phat hanh rang buoc

- Release 1: E1 platform identity/access/control plane; tenant-isolation tests la blocker.
- Release 2: E2 school foundation/roster sau E1 tenant-isolation gate; E3 finance configuration chi sau E1 va E2.
- Release 3: E4 attendance/leave/service/handover sau E2; E5 collection runs/invoices chi sau E2, E3 va E4; E6 ledger/report sau E5.
- Release 4: E7 Parent multi-school finance portal sau E1, E2 va E6.

## 7. Yeu cau chat luong, bao mat va governance

- API la nguon chan ly cho authorization, money, policy, snapshots, state transition va report; frontend/PWA chi goi REST.
- Moi mutation cookie-auth co origin validation va double-submit CSRF; mutation high-impact dung idempotency UUID va operation reconciliation.
- Topology release nay co dinh: Admin/Staff `app.passionedu.org`, Parent `parent.passionedu.org`, Platform Operations `ops.passionedu.org` va API `api.passionedu.org`. Moi portal dung OAuth callback, session audience, cookie host-only va allowlisted origin rieng; khong chia cookie `.passionedu.org` mac dinh va khong dung domain per-School.
- Mo hinh du lieu tre em va Parent ap dung DTO toi thieu, server-side authorization, status/revoke thay hard delete, audit va retention policy.
- Moi thay doi money, attendance, access, role, policy va settlement co actor, thoi diem, provenance va ly do khi yeu cau.
- Cross-tenant isolation, authorization/revoke, concurrency/idempotency, ledger va Parent cross-school E2E la release-blocking verification.
- Idempotency Operation la bat buoc cho generate run, chuyen lop/chuyen nam/close-year batch, issue, receipt/allocation, prepayment, reversal/refund va approval. Sau timeout, client doi soat `GET /operations/:operationId` truoc retry.
- [ASSUMPTION] P95 read API <= 500 ms va preview/report <= 3 s voi fixture acceptance; generate 1,000 Student <= 60 s va co progress Operation. Accessibility cho hai portal dat WCAG 2.1 AA; revoke/suspend co hieu luc request ke tiep va audit retention/backup/recovery SLA se duoc Architecture chot truoc production.

## 8. Thanh cong va counter-metrics

**Primary**
- **SM-1:** 100% bo cross-tenant authorization test bat buoc pass truoc moi release. Validates FR-2, FR-3, FR-14.
- **SM-2:** 100% CollectionRun generate co the reconciliation bang operation va khong tao Invoice trung trong integration test. Validates FR-8.
- **SM-3:** 100% finance report fixture doi chieu dung gross, discount/refund, receipt, allocation, Prepayment va outstanding. Validates FR-10, FR-11.

**Secondary**
- **SM-4:** School Admin hoan tat setup SchoolYear, Class va StudentEnrollment cua fixture trong mot luong co audit. Validates FR-4 den FR-6.
- **SM-5:** Parent chi xem dung school/Student duoc uy quyen sau chooser, revoke va session expiry test. Validates FR-14, FR-15.
- **SM-6:** Trong pilot 30 ngay, >= 90% School setup fixture duoc School Admin hoan tat khong can can thiep ky thuat; 100% exception co audit. [ASSUMPTION] Validates FR-4 den FR-6.
- **SM-7:** Trong pilot 30 ngay, >= 95% Invoice issued co the reconcile ve ledger; 0 incident tenant leak hoac finance posting trung duoc xac nhan. [ASSUMPTION] Validates FR-3, FR-8 den FR-11.

**Counter-metrics**
- **SM-C1:** Khong danh doi tenant isolation de giam so man hinh/chuyen School. Counterbalances SM-4, SM-5.
- **SM-C2:** Khong toi uu auto-fee hay auto-settlement khi chua co policy da duyet. Counterbalances SM-2, SM-3.
- **SM-C3:** Bat ky cross-tenant access attempt thanh cong hoac duplicate ledger post la release/incident escalation, khong duoc trade-off de tang throughput. Counterbalances SM-1 den SM-3.

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
