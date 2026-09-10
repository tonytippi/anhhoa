---
title: "Sprint Change Proposal - Chinh sach uu dai Finance thong nhat"
status: approved
created: 2026-09-10
sources:
  - prds/prd-passionedu-2026-09-04/prd.md
  - specs/spec-passionedu/SPEC.md
  - architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
  - epics-passionedu.md
  - ux-designs/ux-passionedu-2026-09-04/
  - ../../docs/kidsonline/khoan-giam-tru.png
  - ../../docs/kidsonline/thong-tin-thu-phi.png
---

# Sprint Change Proposal: Chinh sach uu dai Finance thong nhat

## 1. Tom tat van de

Qua ra soat van hanh Kidsonline, stakeholder xac nhan truong can nhieu cach uu dai: giam VND/phan tram, mot hoac nhieu khoan thu, dieu kien so luong don vi nhu 12 thang, goi nhieu khoan thu, nhieu uu dai co the cung tac dong mot khoan thu, va uu dai chi duoc gan truc tiep cho mot hoc sinh. Vi du "Con thu hai giam 5%" chi la ten mot chinh sach duoc gan truc tiep; PassionEdu khong duoc tu suy luan quan he gia dinh hay thu tu con.

FR-7 hien tach `DiscountPolicy` (mot Receivable, scope School/Class/Student, % hoac VND) va `PrepaidPaymentPromotionProgram` (term nhieu thang, coverage). Tach nay khong mo hinh hoa duoc cung luc "Dong 12 thang giam 30 trieu" va mot uu dai gan truc tiep, va tao hai lifecycle policy song song. Day la yeu cau van hanh moi, khong phai loi implementation; Finance backend clean-break chua duoc xay dung de rollback.

## 2. Quyet dinh da chot

- Thay `DiscountPolicy` va `PrepaidPaymentPromotionProgram` bang `PromotionPolicy` co version hieu luc.
- Mot `PromotionPolicyVersion` gan mot hoac nhieu `PromotionPolicyTarget`. Moi target chi ro Receivable, don vi va so luong ap dung cua policy.
- "12 thang" la cau hinh target cua policy (`unit = MONTH`, `appliedQuantity = 12`), khong phai unique index. Yeu cau cac ky lien tiep, neu co, la business validation typed cua version.
- Version xac dinh cach giam (`FIXED_VND` hoac `PERCENTAGE`), hieu luc, fulfillment mode, priority, stacking mode va exclusivity group.
- `StudentPromotionAssignment` la co che tong quat de gan policy cho hoc sinh theo effective interval, ly do va audit. Khong co enum/logic co dinh `SECOND_CHILD` hay `THIRD_CHILD`.
- Server evaluate policy khi tao/refresh Invoice DRAFT va evaluate lai trong transaction truoc Issue. Invoice issue snapshot policy version, target, evaluation, discount, priority va assignment provenance neu co.
- Nhieu policy chi cung ap dung neu stacking rules cho phep. Fixed VND ap dung truoc percentage; priority tang dan, policy ID la tie-breaker; cung exclusivity group chi lay policy hop le co priority cao nhat; discount cap tai gross cua target.
- `PREPAID_COVERAGE` la fulfillment mode cua policy, khong phai aggregate program rieng. Voi mode nay, server tao dedicated `PREPAID` CollectionRun/source Invoice, exact settlement va chi issue `StudentPromotionalCoverage`/facts sau `PAID`.
- Coverage, prepaid CollectionRun, exact settlement, skip covered period, snapshot, refund cap, audit va Operation reconciliation duoc giu nguyen ve nang luc; provenance chuyen sang `PromotionPolicyVersion`.
- Sua policy luon tao version moi; khong sua Invoice/coverage/refund da snapshot.

## 3. Tac dong Epic va backlog

### Epic 5: Tao va phat hanh nghia vu thu

**Old:** Finance cau hinh `DiscountPolicy`, `ChargeRule` va `PrepaidPaymentPromotionProgram`; preview/generate xu ly discount va prepaid program tach biet.

**New:** Finance cau hinh `PromotionPolicy`, version, targets va Student assignment. CollectionRun preview/generate evaluate policy server-side; Invoice issue re-evaluate va snapshot outcomes. `PREPAID_COVERAGE` duoc chay nhu fulfillment mode cua policy.

Cap nhat Story 5.1:

- Thay cac aggregate cu bang `PromotionPolicy`, `PromotionPolicyVersion`, `PromotionPolicyTarget`, `StudentPromotionAssignment`.
- Them version lifecycle, typed targets/conditions, stacking/exclusivity va policy assignment.
- Them cross-School graph checks, effective interval, audit va idempotent Operations.

Cap nhat Story 5.2:

- Preview tra per-target promotion evaluation: applied, not eligible hoac excluded, voi reason code.
- Validate unit/quantity, bundle completeness, assignment, usage limit va optional consecutive-period rule.
- Tinh fixed-VND truoc percentage, deterministic priority/tie-break, discount floor/ceiling server-side.

Cap nhat Story 5.3:

- Generate DRAFT snapshot evaluation du kien.
- Issue re-evaluate trong transaction; outcome khac DRAFT tra `PROMOTION_REVIEW_REQUIRED` va bat buoc review lai.
- Issue snapshot `InvoicePromotionApplication` theo target/policy version.

Thay Story 5.4/5.5 prepaid:

- Khong con `PrepaidPaymentPromotionProgram`.
- Cho `PromotionPolicyVersion.fulfillmentMode = PREPAID_COVERAGE`, School Admin chon policy/start period sau thoa thuan truc tiep voi Parent.
- Server validate target quantity, period/service interval, coverage overlap va usage limit; tao `PREPAID` run/source DRAFT Invoice.

Cap nhat Story 5.6 release gate:

- Them tenant/version/assignment isolation, policy evaluation, stacking, re-evaluation va prepaid coverage retry cases.

### Epic 6: Thu tien, doi soat cong no va bao cao so cai

**Old:** Source Invoice cua `PrepaidPaymentPromotionProgram` settled exact va cap coverage provenance tu program.

**New:** Exact settlement khong doi. Source Invoice cua policy `PREPAID_COVERAGE` cap coverage provenance tu `PromotionPolicyVersion`, source Invoice va Receipt. Refund cap dua tren paid snapshot con lai cua tung coverage fact.

Cap nhat stories settlement/refund/report:

- Bao cao tach gross, promotion discount theo policy/version, net billed, coverage issued, Receipt/Allocation, refund va outstanding.
- Reconciliation fixtures dung policy versions thay program/discount fixture cu.

### Epic 4 va Epic 7

- Epic 4 khong doi: attendance, handover va service enrollment khong tro thanh pricing engine; Finance chi dung source da duoc contract cho phep.
- Epic 7 khong doi authorization: Parent chi doc Invoice snapshot da issue; khong xem policy live, assignment, eligibility, version history hoac reason noi bo.

Khong can Epic moi. Chon direct adjustment trong Epic 5 va Epic 6 de giu Finance ownership va dependency ro rang.

## 4. Tac dong canonical artifacts

### PRD

**Muc 4.3, FR-7 va FR-8/FR-9:**

Thay:

```text
DiscountPolicy la percent hoac VND theo School/Class/Student va Receivable scope.
PrepaidPaymentPromotionProgram la program rieng, khong stack voi DiscountPolicy.
```

Bang:

```text
PromotionPolicy la School-scoped policy co version hieu luc. Moi version co mot hoac
nhieu target Receivable, don vi/so luong ap dung, dieu kien typed, cach giam,
fulfillment mode, priority, stacking/exclusivity va effective period. Assignment co
the gan version cho Student theo effective interval, reason va audit. Server evaluate
khi DRAFT va re-evaluate truoc Issue; Invoice issue snapshot outcome. PREPAID_COVERAGE
la fulfillment mode tao PREPAID CollectionRun/source Invoice va chi issue coverage
facts sau exact PAID settlement.
```

Giu cac bat bien: School scope, VND BIGINT/JSON-safe, Invoice immutable sau Issue, exact settlement, khong credit/generic balance/partial, snapshot/refund bounds.

### SPEC

Cap nhat CAP Finance, Constraints va Non-goals:

- API so huu typed promotion evaluation, stacking, VND calculation, snapshots va coverage lifecycle.
- Cam formula/script/SQL do nguoi dung tu viet va client-calculated discount/total.
- Parent khong co policy/assignment/payment mutation.
- Bo `PrepaidPaymentPromotionProgram` khoi naming contract; giu `PREPAID` CollectionRun nhu execution mode.

### Architecture Spine

Cap nhat AD-7:

- Thay `DiscountPolicy`/`PrepaidPaymentPromotionProgram` bang policy/version/target/assignment/application/coverage model.
- Quy dinh deterministic stacking, cap discount tai gross, pre-issue re-evaluation va immutable issued snapshot.
- Dinh provenance coverage fact tu policy version/source Invoice/Receipt.

Cap nhat AD-8:

- Policy create/version/activate/deactivate, Student assignment/end assignment, prepaid selection, coverage issuance va refund la transactional idempotent Operations co audit.

Cap nhat AD-11:

- Integration gate bao gom policy tenant graph, version immutability, quantity/continuity business validation, stacking, stale issue, coverage, refund va retry/concurrency.

AD-13 giu nguyen boundary attendance/service: khong automatic pricing tu operational data.

### UX

- Doi tab `Khoan giam tru` thanh `Chinh sach uu dai`.
- Danh sach policy hien ten, targets, so luong/don vi, muc giam, fulfillment mode, ket hop, hieu luc, status va version.
- Wizard tao version: thong tin/hieu luc -> targets -> don vi/so luong/dieu kien -> muc giam -> fulfillment/stacking -> review.
- Bieu mau policy `assignment required` khong goi la "con thu hai" ve mat ky thuat; no cho phep gan version cho bat ky Student nao voi thoi gian/ly do.
- Bang khoan thu theo lop hien tat ca charges. O policy projection hien count uu dai, net server-provided va detail disclosure; o service tu chon co the edit. Khong tinh client-side.
- Invoice DRAFT co vung policy applications, versions, reasons, gross/discount/net; stale evaluation truoc Issue quay ve review.
- Ma tran rong phai co horizontal scroll containment, keyboard-accessible detail control, focus return va mobile fallback khong tran viewport.

### Mockup va implementation artifacts hien co

- `receivable-configuration.html`, `invoice-generation.html`, `invoice-detail-review.html`, `MOCKUP-COVERAGE.md` va contract tests can cap nhat sau khi canonical artifacts duoc chinh thuc phe duyet.
- Cac mockup hien tai ve `Khoan giam tru`, `Chuong trinh nop truoc` va statement "khong stack" la tam thoi va khong duoc coi la implementation contract nua.

## 5. Architecture contract chi tiet

```text
PromotionPolicy
PromotionPolicyVersion
PromotionPolicyTarget
StudentPromotionAssignment
InvoicePromotionApplication
StudentPromotionalCoverage
PromotionCoverageFact
```

Typed enums toi thieu:

```text
discountKind: FIXED_VND | PERCENTAGE
stackingMode: STACKABLE | EXCLUSIVE
fulfillmentMode:
  INVOICE_DISCOUNT
  RECURRING_DISCOUNT
  ONE_TIME_DISCOUNT
  BUNDLE_DISCOUNT
  PREPAID_COVERAGE
quantityRequirement: NONE | MINIMUM | EXACT
continuityRequirement: NONE | CONSECUTIVE_PERIODS
assignmentRequirement: NOT_REQUIRED | REQUIRED
usageLimit: UNLIMITED | ONCE_PER_STUDENT | ONCE_PER_STUDENT_PER_SCHOOL_YEAR
```

Policy target luu `unit` va `appliedQuantity`. Vi du "Dong 12 thang giam 30 trieu" luu MONTH/12. Neu policy bat `CONSECUTIVE_PERIODS`, Finance validate cac periods da chon lien nhau khi evaluate; day la business rule, khong phai database unique constraint.

Evaluation order:

1. Loc version active/hieu luc/cung School va target phu hop.
2. Kiem tra assignment, target quantity, bundle, continuity, usage va coverage state.
3. Loai policy khong dat va tra reason code.
4. Giai exclusivity group theo priority cao nhat.
5. Fixed VND theo priority, sau do percentage theo priority; policy ID la stable tie-breaker.
6. Cap discount tai gross target, snapshot application va net VND.

Reason code API toi thieu:

```text
APPLIED
NOT_ASSIGNED
OUTSIDE_EFFECTIVE_PERIOD
QUANTITY_NOT_MET
PERIODS_NOT_CONSECUTIVE
USAGE_LIMIT_REACHED
EXCLUDED_BY_HIGHER_PRIORITY
TARGET_NOT_PRESENT
COVERED_BY_PROMOTION
PROMOTION_REVIEW_REQUIRED
```

## 6. Phuong an danh gia va khuyen nghi

| Phuong an | Danh gia | Effort | Rui ro |
| --- | --- | --- | --- |
| Direct adjustment Epic 5/6, thay canonical contract truoc implementation | **Chon.** Mo hinh thong nhat, giu coverage/refund safety va khong tao lifecycle song song. | Cao | Trung binh-cao |
| Giu DiscountPolicy va PrepaidPaymentPromotionProgram tach rieng | Khong dap ung multiple policy/target/assignment va se tang special cases. | Trung binh | Cao |
| Bo coverage khi hop nhat policy | Khong kha dung: khong chong thu trung/hoan tien duoc. | Thap luc dau | Rat cao |
| Rollback implementation | Khong ap dung: Finance backend clean-break chua xay. | N/A | N/A |

Khuyen nghi direct adjustment. MVP Finance rong hon ve policy typing, nhung giu pham vi dong: khong co formula tu do, khong automatic operational pricing, khong Parent mutation, khong generic credit/balance va khong thay doi exact settlement.

## 7. Handoff va tieu chi thanh cong

**Phan loai:** Major. PM va Solution Architect phai cap nhat canonical artifacts truoc Developer implementation. UX cap nhat flow sau contract; Product Owner cap nhat epics va sprint tracker sau khi canonical changes duoc merged.

| Nguoi nhan | Trach nhiem |
| --- | --- |
| Product Manager | Cap nhat PRD/addendum FR-7/8/9, loai bo naming cu va chot product rules policy target/stacking/assignment. |
| Solution Architect | Cap nhat SPEC/Spine AD-7/8/11, schema/API/transaction invariants, coverage/refund provenance va verification gate. |
| UX Designer | Cap nhat Design/Experience va mockup Catalog policy, assignment, class charge matrix, Invoice policy projection/stale review. |
| Product Owner | Cap nhat Epic 5/6 stories va `sprint-status.yaml` sau khi canonical contract duoc phe duyet. |
| Developer | Chi implementation sau khi canonical artifacts va story specs ready-for-dev. |

Tieu chi thanh cong:

1. Policy version va target khong cross-School; version moi khong rewrite issued history.
2. Assignment la generic Student-level mechanism, khong suy luan ho gia dinh.
3. Target quantity/unit va optional continuity rule duoc server validate deterministically.
4. Nhieu policy chi stack theo typed priority/exclusivity; gross floor la VND integer.
5. DRAFT va Issue evaluate lai; stale result khong duoc issue am tham.
6. `PREPAID_COVERAGE` chi issue coverage facts sau exact PAID source; monthly run khong thu trung; refund cap dung paid snapshot con lai.
7. Portal chi render server projection; Parent chi thay issued snapshot toi thieu.
8. Integration/E2E prove tenant isolation, version/assignment audit, stacking, retry/idempotency, coverage/refund va no partial/excess/unallocated/mixed-Student settlement.

## 8. Checklist trang thai

- [x] 1.1 Trigger: stakeholder review Kidsonline discount/payment screens trong mockup Finance.
- [x] 1.2 Problem: hai aggregate policy tach rieng khong dap ung target nhieu khoan thu, quantity/unit, stacking va generic Student assignment.
- [x] 1.3 Evidence: `docs/kidsonline/khoan-giam-tru.png`, `docs/kidsonline/thong-tin-thu-phi.png` va decisions stakeholder 2026-09-10.
- [x] 2.1-2.5 Epic impact: Epic 5/6 direct adjustment; Epic 4/7 boundaries giu nguyen; khong can Epic moi hay rollback.
- [x] 3.1-3.4 Artifact impact: PRD, SPEC, Spine, Epics, UX/mockups, tracker, API/schema/test gates can cap nhat; deployment khong doi.
- [x] 4.1 Direct adjustment kha dung, effort cao/rui ro trung binh-cao.
- [x] 4.2 Rollback N/A.
- [x] 4.3 MVP review: MVP mo rong co typed policy, khong formula tu do hay Parent mutation.
- [x] 4.4 Chon direct adjustment voi PM + Architect handoff.
- [x] 5.1-5.5 Proposal, impact, action plan va handoff da duoc lap.
- [x] 6.3 Product Owner phe duyet proposal hoan chinh ngay 2026-09-10.
- [x] 6.4 Cap nhat `sprint-status.yaml` ngay 2026-09-10: Story 5.1, 6.2, 6.3 va 6.6 doi sang PromotionPolicy/coverage naming.
- [x] 6.5 Handoff: PRD/addendum, SPEC, Spine, Epic 5/6, tracker, UX Experience va mockup policy da dong bo; Developer chi bat dau sau story spec ready-for-dev.
