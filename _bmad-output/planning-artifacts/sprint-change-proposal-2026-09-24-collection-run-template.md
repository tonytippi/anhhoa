---
name: CollectionRun template để tạo Invoice DRAFT có sẵn dòng
status: approved
date: 2026-09-24
trigger: Finance cần vận hành thu học phí hàng loạt trước Parent và Teacher app. Khi tạo Đợt thu, kế toán phải chọn các khoản thu chung và quantity mặc định một lần; generate phải tạo Draft Invoice có sẵn dòng thay vì rỗng.
mode: incremental
---

# Sprint Change Proposal - CollectionRun template để tạo Invoice DRAFT có sẵn dòng

## 1. Issue summary

Finance Admin MVP hiện tạo `Invoice DRAFT` rỗng cho từng Student. Cách này giữ domain đơn giản nhưng khiến Finance phải thêm lại học phí, tiền ăn và các khoản dùng chung trên từng Invoice, không phù hợp vận hành thực tế.

Ảnh tham chiếu `docs/kidsonline/tao-dot-thu.png` cho thấy workflow cần thiết: Finance lập Đợt thu, thêm từng khoản thu mẫu, rồi xác nhận tạo Đợt thu. Business owner xác nhận PassionEdu cần cùng kết quả vận hành, với các quyết định đã chốt:

1. Template áp dụng chung cho mọi Student được generate trong một Đợt thu.
2. Kế toán được nhập quantity nguyên dương ở template, ví dụ 22 ngày tiền ăn; không có giá hoặc quantity riêng theo Student ở bước này.
3. Khác biệt từng Student được điều chỉnh sau generate trên Invoice `DRAFT`, có reason/audit; không làm thay template hoặc Invoice của Student khác.
4. Đợt thu vẫn chỉ là `MONTHLY`, unique theo `(School, SchoolYear, billingMonth)`; không thêm tên/khoảng ngày tự do.
5. Không đưa service enrollment, ChargeRule, scope theo Class/Student, PromotionPolicy, Parent publish, thuế, Receipt, carry hay reporting vào thay đổi này.

Đây là thay đổi workflow Finance Admin MVP, không phải thay đổi settlement hoặc mở rộng sang Teacher/Parent.

## 2. Impact analysis

| Area | Impact |
| --- | --- |
| Epic 5 | Giữ nguyên mục tiêu và thứ tự; các Story 5.2-5.6 đã hoàn thành theo empty-DRAFT cần follow-up 5.9-5.11 để bổ sung template, populated generate và gate riêng. Không viết lại lịch sử story đã done. |
| PRD FR-7/FR-8 | Đổi explicit contract từ DRAFT rỗng sang `CollectionRunTemplateLine` dùng chung; quantity template dương, giá catalog default, server-derived amount/total. |
| Addendum | Bổ sung invariant template DRAFT, snapshot template vào Invoice và verification matrix populated DRAFT; bỏ mô tả empty-DRAFT làm build input hiện hành. |
| Architecture Spine AD-7/AD-8/AD-11 | `finance` sở hữu template line, lifecycle lock, preview fingerprint, snapshot/copy transaction và Operation/audit; bổ sung integration/E2E proof. Không thay School scope, VND, invoice uniqueness hay settlement invariant. |
| SPEC CAP-4/constraints | Thay create empty draft obligations bằng generate populated DRAFT từ template server-authoritative; giữ deferred automation. |
| UX | `Đợt thu` thêm bảng Khoản thu trong đợt với catalog active, quantity dương, server-returned default price/amount và display order deterministic amount giảm dần; preview bắt buộc trước generate; Invoice review vẫn contextual. |
| Mockup | Khôi phục phần cấu hình khoản thu trong dialog/detail Đợt thu dưới dạng template chung, không khôi phục service toggle, ưu đãi hay settlement KPI. |
| Tracker | Thêm 5.9 ready-for-dev, 5.10 và 5.11 backlog; Epic 5 giữ in-progress. |
| Infrastructure/portals | Không đổi deployment, database topology, Parent hoặc Teacher dependency. |

### Artifact conflict

Các bản hiện hành nói `Invoice DRAFT` rỗng tại PRD FR-7/FR-8, Addendum, AD-7 correction 2026-09-21, SPEC CAP-4, Epic 5 Story 5.3 và implementation artifacts của 5.3. Các artifact canonical phải được thay bằng contract template; spec completed 5.3 được giữ nguyên như evidence của behavior cũ, không bị sửa.

## 3. Recommended approach

**Selected approach: Direct backlog adjustment.**

Thêm aggregate hẹp `CollectionRunTemplateLine` thuộc `finance`, chỉ chỉnh trong `CollectionRun DRAFT`, rồi snapshot các line đó vào Invoice lúc generate. Cách này tái sử dụng catalog, CollectionRun lifecycle, preview fingerprint, InvoiceLine, Operation/idempotency, audit và per-Invoice adjustment đã tồn tại; không tạo pricing engine, service domain hoặc alternate run type.

**Effort:** Medium. Cần migration/schema, API, preview/generate transaction, Admin UI/mockup và PostgreSQL/E2E coverage.

**Risk:** Medium. Rủi ro chính là template/catalog thay đổi giữa preview và generate, duplicate template/InvoiceLine khi retry, hoặc template mutable rewrite DRAFT đã generate. Mitigation bắt buộc là composite tenant graph, template version/fingerprint, transaction snapshot, partial unique/constraints, Operation idempotency và integration concurrency tests.

### Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Giữ DRAFT rỗng, nhập từng Invoice | Rejected | Không đáp ứng vận hành thu hàng loạt. |
| Thêm service enrollment/ChargeRule/policy ngay | Rejected | Mở rộng pricing/scope lớn hơn nhu cầu hiện tại và làm chậm Admin-first release. |
| Browser gửi các khoản/amount cùng generate | Rejected | Vi phạm server authority, VND/audit/snapshot và stale validation. |
| Template chung CollectionRun với quantity | Selected | Đủ tạo invoice có dòng, không cần dependency Teacher/Parent hay automation theo Student. |

## 4. Detailed change proposals

### 4.1 PRD - template chung cấp CollectionRun

**Sections:** `prd.md` thuật ngữ, FR-7, FR-8, release-quality requirements.

**OLD:**

```md
Invoice DRAFT bắt đầu rỗng. Finance chọn Receivable active same-School,
nhập quantity nguyên dương ...

Generate ... Invoice DRAFT rỗng idempotent.
```

**NEW:**

```md
CollectionRun MONTHLY ở DRAFT sở hữu CollectionRunTemplateLine. API chỉ hiển thị line theo amount giảm dần với tie-breaker server ổn định; thứ tự không có ý nghĩa nghiệp vụ.
Mỗi line tham chiếu đúng một Receivable active cùng School, unique trong run,
và có quantity nguyên dương do Finance nhập. Template dùng default unit price
của catalog; API tính amount/total VND và không nhận giá, tổng, scope hoặc
giá trị theo Student từ browser.

Finance chỉ thêm, bỏ hoặc đổi quantity template khi run DRAFT. Preview
fingerprint bao gồm selection, roster, template version và catalog facts. Generate
revalidate/snapshot template trong transaction và tạo mỗi Invoice DRAFT eligible
có các InvoiceLine tương ứng. Catalog/template thay đổi sau generate không
rewrite Invoice DRAFT đã tạo hay Invoice đã issue.

Sau generate, Finance chỉ điều chỉnh line của một Invoice DRAFT theo workflow
audit hiện có; điều chỉnh không sửa template hay Invoice Student khác. Không tự
trừ ngày nghỉ, service, policy hoặc scope theo Class/Student trong Finance Admin MVP.
```

**Rationale:** Chuyển common charges thành server-owned run configuration, nhưng giữ manual per-Student exception và toàn bộ Finance Admin MVP boundary.

### 4.2 Addendum và Architecture Spine

**Sections:** `addendum.md` Finance rules/verification; `ARCHITECTURE-SPINE.md` AD-7, AD-8, AD-11.

**NEW invariant:**

```md
CollectionRunTemplateLine thuộc cùng School/run và chỉ mutable ở DRAFT. Nó
tham chiếu Receivable active same-School, unique `(collectionRunId, receivableId)`,
có positive integer quantity. API derives default-price amount,
audits every mutation and fingerprints canonical template/catalog facts.

READY/GENERATED/CLOSED reject template mutation. Generate locks/revalidates
run/template/catalog/roster, snapshots every template fact and derived amount
into each generated InvoiceLine atomically. Retry/concurrency cannot duplicate
template, Invoice or InvoiceLine; no generated/issued snapshot reads live template.
```

**Rationale:** Giữ finance ownership, School graph, VND `BIGINT`, immutable snapshot và transactional Operation boundary.

### 4.3 SPEC

**Sections:** CAP-4 và Finance Admin MVP constraints.

**OLD:** `create empty draft obligations` và omitted line nghĩa là receivable không áp dụng.

**NEW:** `configure common positive-quantity template lines on a monthly CollectionRun and generate populated DRAFT obligations from the server-snapshotted template`; absence of a template line means it does not apply to this run. Per-Invoice DRAFT adjustment remains allowed with audit. Automated applicability remains deferred.

### 4.4 Epic 5 follow-up stories

#### Story 5.9: Cấu hình template khoản thu cho Đợt thu

As a Finance Manager, I want to quản lý khoản thu mẫu và quantity chung của một CollectionRun DRAFT, so that tất cả Invoice DRAFT được tạo từ cùng cấu hình Đợt thu server-confirmed.

**Acceptance criteria:**

- Given a DRAFT monthly run and active same-School Receivable, when Finance adds/removes a template line or sets a positive integer quantity, then the API persists only the canonical same-School template, VND amount and audit/Operation outcome; DTO order is server-deterministic amount descending and has no position/reorder input.
- Given duplicate, inactive/foreign Receivable, zero/negative/fractional quantity, stale run version or non-DRAFT state, when template mutation is requested, then server rejects before write and exposes no foreign catalog/run fact.
- Given a preview exists, when selection/template/catalog fact changes, then its fingerprint becomes stale and READY/generate is denied until a new server preview succeeds.

#### Story 5.10: Generate Invoice DRAFT có dòng template

As a Finance Manager, I want to generate DRAFT Invoice có sẵn các dòng template của Đợt thu, so that chỉ cần rà soát ngoại lệ từng Student.

**Acceptance criteria:**

- Given READY run, current server preview and non-empty valid template, when generate completes, then each eligible selected Student receives at most one Invoice whose lines snapshot every template Receivable/name/unit/quantity/default price/derived VND amount.
- Given template empty/stale, inactive/foreign catalog, changed fingerprint, race or retry, when generate runs, then it atomically rejects or replays without partial Invoice/line writes or duplicate data.
- Given a generated populated DRAFT, when Finance adjusts a line for one Student, then template and all other Invoice stay unchanged; issued line/content remains immutable.

#### Story 5.11: Release gate template Đợt thu

As a release owner, I want automated proof for template snapshot and populated DRAFT generation, so that Finance can create common charges safely at scale.

**Acceptance criteria:**

- Given multi-School fixture, when unit/PostgreSQL tests exercise template lifecycle, then tenant graph, unique line, positive integer quantity/VND, preview stale, lifecycle lock, snapshot immutability, idempotency and concurrency pass.
- Given Admin E2E, when Finance configures template -> selects Student -> previews -> generates -> opens populated DRAFT -> adjusts one Student, then UI displays only server values and reconciles timeout/switch safely.
- Given Finance Admin MVP gate, when routes/bundles/contracts are inspected, then no service, PromotionPolicy, Teacher, Parent, Receipt, carry or client-calculated VND dependency exists.

### 4.5 UX and mockups

**Files:** `EXPERIENCE.md`, `DESIGN.md` if component wording needs extension, `MOCKUP-COVERAGE.md`, `mockups/admin/invoice-generation.html`, `mockups/admin/invoice-detail-review.html`, static mockup assertions.

**New Pha 1 interaction:**

1. Finance opens/creates one monthly run.
2. In DRAFT, Finance adds active catalog receivables into **Khoản thu trong đợt**, sets positive integer quantity and removes lines. API returns deterministic amount-desc display order; no reorder is offered.
3. Server returns price/amount; UI never computes values or provides Class/Student scope/service/promotion controls.
4. Finance selects Student, requests preview, then generates only from that preview.
5. Invoice review opens a populated DRAFT; individual exception requires reason/audit and never mutates run template.
6. READY onward locks template/selection. Timeout enters Operation reconciliation before retry/switch.

### 4.6 Tracker

```yaml
epic-5: in-progress
5-9-cau-hinh-template-khoan-thu-cho-dot-thu: ready-for-dev
5-10-generate-invoice-draft-co-dong-template: backlog
5-11-release-gate-template-dot-thu: backlog
```

Existing 5.1-5.8 retain `done`; they are historical delivery of empty-DRAFT MVP and are not rewritten.

## 5. Implementation handoff

**Scope classification:** Moderate direct backlog adjustment.

| Recipient | Responsibility |
| --- | --- |
| Product/Developer | Apply approved canonical PRD, Addendum, Spine, SPEC, Epic 5, UX and tracker edits without changing settled/Parent/Teacher scope. |
| Developer | Build 5.9 first: schema/API/template mutations, preview fingerprint and Admin DRAFT configuration. |
| Developer | Build 5.10 after 5.9: transactionally snapshot template into populated Invoice DRAFT, retain per-Invoice adjustment. |
| QA/Developer | Build 5.11 and prove PostgreSQL/E2E matrix before calling enhanced Finance Admin workflow releasable. |

### Success criteria

1. Finance creates one template once per monthly run, including a number of meal days.
2. Generate produces populated DRAFT Invoices using only server-derived template values.
3. Finance changes a single Student's DRAFT quantity with audit without affecting template/other Invoices.
4. Retry, stale preview, catalog lifecycle, School switch and concurrency cannot create wrong, duplicate or cross-School data.
5. Parent/Teacher, service/promotion, settlement/carry remain absent from this release slice.

## 6. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1 Triggering story | [x] Done | Story 5.3 generates empty DRAFT Invoice. |
| 1.2 Core problem | [x] Done | Manual per-Invoice common-charge entry is not operationally viable. |
| 1.3 Evidence | [x] Done | `docs/kidsonline/tao-dot-thu.png` and business-owner decisions. |
| 2.1-2.5 Epic impact | [x] Done | Epic 5 retains scope/order; follow-up stories only; later epics unchanged. |
| 3.1 PRD | [x] Done | FR-7/FR-8 replace empty-DRAFT contract. |
| 3.2 Architecture | [x] Done | AD-7/8/11 add template ownership/snapshot proof. |
| 3.3 UX | [x] Done | Đợt thu template flow, preview and contextual adjustment are defined. |
| 3.4 Secondary artifacts | [x] Done | Addendum, SPEC, tracker, mocks/tests included. |
| 4.1 Direct adjustment | [x] Viable | Medium effort/risk; reused Finance primitives. |
| 4.2 Rollback | [N/A] | Completed empty-DRAFT stories remain historical evidence. |
| 4.3 MVP review | [N/A] | No release-order or MVP reduction needed. |
| 4.4 Selected path | [x] Done | Direct backlog adjustment selected. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-5 specify edits, stories, ownership and acceptance. |
| 6.1-6.2 Review | [x] Done | Proposal records all impacts and exclusions. |
| 6.3 Approval | [x] Done | Tony approved on 2026-09-24. |
| 6.4 Tracker update | [x] Done | Follow-up stories 5.9-5.11 added. |
| 6.5 Handoff | [x] Done | Canonical artifacts and tracker updated; 5.9 is ready for development. |

## 7. Approval request

Approve this proposal to update canonical planning artifacts and start follow-up Story 5.9. The approved change remains limited to a shared monthly CollectionRun template with positive integer quantity; it does not authorize class/student scope, services, promotions, Parent/Teacher, settlement or client-calculated money.
