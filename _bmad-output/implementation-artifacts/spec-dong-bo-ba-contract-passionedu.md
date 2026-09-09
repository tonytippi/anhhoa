---
title: 'Đồng bộ contract nộp trước, Receipt chính xác và phân quyền Payroll'
type: 'bugfix'
created: '2026-09-09'
status: 'done'
baseline_commit: '295117b5ad1a31a38e8ddccc853bd6ccf23adeca'
review_loop_iteration: 0
context:
  - '_bmad-output/specs/spec-passionedu/SPEC.md'
  - '_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Các artifact canonical đang mô tả hai mô hình nộp trước/Receipt dư khác nhau và dùng “Kế toán/Accountant” như một role Payroll chưa được định nghĩa. Nếu giữ nguyên, schema ledger, authorization và mockup sẽ dẫn implementation theo các contract không tương thích.

**Approach:** Đồng bộ mọi build input theo mô hình `PrepaidPaymentPromotionProgram → PREPAID CollectionRun → exact settlement → StudentPromotionalCoverage`; loại bỏ `StudentPrepayment` độc lập; định nghĩa Kế toán là persona của `FINANCE_MANAGER` với capability Payroll chuyên biệt, School Admin là approver khác người submit, và Finance Manager xác nhận payout sau duyệt.

## Boundaries & Constraints

**Always:** Receipt thường và Receipt của nguồn PREPAID phải settle chính xác; partial, excess, unallocated và mixed-Student bị từ chối. Coverage chỉ được issue sau khi source Invoice được thanh toán đủ và giữ snapshot/provenance bất biến. Payroll entitlement không tự cấp role/capability. Người approve phải khác identity với người chuẩn bị/gửi duyệt. `FINANCE_MANAGER` chuẩn bị, reconcile, submit và xác nhận payout; `SCHOOL_ADMIN` review, approve/refuse và reopen.

**Ask First:** Bất kỳ thay đổi nào khôi phục StudentPrepayment/số dư chung, cho Parent chọn chương trình, cho Finance Manager phát hành coverage trực tiếp, thêm preset role `ACCOUNTANT`, cho cùng identity vừa submit vừa approve, hoặc chuyển quyền xác nhận payout sang School Admin.

**Never:** Sửa artifact lịch sử để giả vờ quyết định cũ chưa từng tồn tại; thay đổi code ứng dụng; mở rộng sang sửa toàn bộ thiếu sót mockup/visual review; nới invariant School scope, VND integer, audit, idempotency hoặc Operation reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Nộp trước hợp lệ | School Admin chọn program active và tháng bắt đầu | API tạo PREPAID run/source Invoice; exact-paid mới issue coverage | Không đủ/không đúng tiền thì không post và không issue coverage |
| Receipt không chính xác | Thiếu, dư, unallocated hoặc mixed-Student | Từ chối toàn bộ posting | Không tạo StudentPrepayment hay generic balance |
| Payroll chuẩn | FINANCE_MANAGER submit; SCHOOL_ADMIN khác identity review | Approve/refuse; sau approve FINANCE_MANAGER xác nhận payout | Same-identity approval bị server từ chối |
| Entitlement không đủ | School chưa bật Payroll hoặc actor thiếu capability | Route/job/action bị chặn server-side | Không lộ record Payroll qua deep link hoặc menu |

</frozen-after-approval>

## Code Map

- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md` -- glossary, FinancePolicy, FR-7/10, reporting/retention/scope/success và FR-2/14/15 đang chứa contract cũ hoặc actor chưa resolve.
- `_bmad-output/planning-artifacts/prds/prd-passionedu-2026-09-04/addendum.md` -- invariant model và verification matrix còn fixture StudentPrepayment/excess.
- `_bmad-output/planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md` -- AD-7 còn rule cũ cạnh đoạn superseding; AD-17/18 cần binding persona/capability và separation-of-duties.
- `_bmad-output/specs/spec-passionedu/SPEC.md` -- contract tài chính mới đã canonical; CAP-8/9 cần giải nghĩa Accountant và payout actor.
- `_bmad-output/planning-artifacts/payroll-module-roadmap-2026-09-08.md` -- workflow/capability matrix còn dùng Finance Manager/Accountant mơ hồ.
- `_bmad-output/planning-artifacts/epics-passionedu.md` -- Epic 8–11 cần actor/capability và AC same-identity/payout nhất quán.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- component/flow/state còn Prepayment dư và actor Payroll mơ hồ.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/` -- bốn trang Payroll và coverage cần nhãn, quyền và hành vi phù hợp contract; mockup nộp trước hiện chủ yếu đã đúng.
- `_bmad-output/implementation-artifacts/sprint-status.yaml` -- story key 6-2 còn tên contract Prepayment cũ; chỉ đổi key nếu bảo toàn trạng thái và mọi tham chiếu.
- `_bmad-output/implementation-artifacts/spec-mockup-goi-nop-truoc.md` -- bằng chứng read-only rằng mockup đã chuyển sang contract program-driven.

## Tasks & Acceptance

**Execution:**
- [x] Đồng bộ PRD, addendum và Architecture Spine -- xóa rule StudentPrepayment/excess/direct coverage đã bị thay thế và ghi một finance contract duy nhất.
- [x] Đồng bộ SPEC, Payroll roadmap và epics -- định nghĩa Accountant persona, capability matrix, approver khác submitter và Finance Manager payout confirmation.
- [x] Đồng bộ EXPERIENCE, MOCKUP-COVERAGE và mockup Payroll -- dùng cùng actor/state/action; không tạo thêm chức năng ngoài contract.
- [x] Rà toàn repository build inputs -- bảo đảm thuật ngữ cũ chỉ còn trong artifact được đánh dấu historical hoặc nội dung giải thích migration quyết định.

**Acceptance Criteria:**
- Given mọi canonical build input, when tìm `StudentPrepayment`, excess Receipt và direct Finance-created coverage, then không còn contract thực thi nào cho phép các hành vi đó.
- Given Payroll run được submit bởi FINANCE_MANAGER, when cùng identity cố approve, then contract và AC yêu cầu server từ chối; một SCHOOL_ADMIN khác identity mới review/approve/refuse được.
- Given Payroll đã approve nhưng chưa paid, when payout được ghi nhận, then contract chỉ cấp hành vi xác nhận cho FINANCE_MANAGER có `PAYROLL_PAYOUT_CONFIRM`.
- Given School có Payroll entitlement nhưng actor thiếu capability, when mở route/job/action, then contract yêu cầu từ chối server-side và không lộ dữ liệu.
- Given mockup/documentation được rà soát, when đối chiếu PRD → SPEC → Architecture → Epics → UX, then actor, trạng thái và invariant tài chính có một cách diễn đạt tương thích.

## Spec Change Log

- 2026-09-09: Đồng bộ canonical finance/Payroll contract; đổi story key 6.2 nhưng giữ `backlog`; đánh dấu proposal 2026-09-05 là historical-only; cập nhật UX và bốn mockup Payroll.

## Design Notes

“Kế toán” là nhãn persona cho người dùng, không phải preset authorization mới. Authorization phải resolve từ active same-School `FINANCE_MANAGER` grant, Payroll entitlement và capability cụ thể. Separation-of-duties so sánh identity/membership thực tế, không chỉ tên role: identity đã prepare/materially edit hoặc submit không được approve/refuse run qua grant khác.

## Verification

**Commands:**
- `rg -n "StudentPrepayment|receipt thua|Receipt du|excess|Accountant|Kế toán|PAYROLL_(PREPARE|APPROVE|PAYOUT_CONFIRM)" _bmad-output` -- expected: mọi kết quả canonical phù hợp contract mới; kết quả cũ chỉ nằm trong historical/review evidence.
- `rg -n "SUBMITTED|REFUSED|submit, approve/refuse|TIMEKEEPING_REVIEW|LATE_CARE_MANAGE|WORKFORCE_MANAGE|PAYROLL_REPORT_READ|preparer/material editor|materially edited" _bmad-output/specs/spec-passionedu/SPEC.md _bmad-output/planning-artifacts/{payroll-module-roadmap-2026-09-08.md,epics-passionedu.md,architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md,prds/prd-passionedu-2026-09-04/prd.md` -- expected: lifecycle submit/refuse, capability binding và separation-of-duties xuất hiện trong mọi canonical contract liên quan.
- `rg -n "6-2-" _bmad-output/implementation-artifacts/sprint-status.yaml` -- expected: `6-2-settle-exact-prepaid-payment-source-invoice: backlog`.
- `python3 -c 'from html.parser import HTMLParser; from pathlib import Path; files=list(Path("_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin").glob("payroll-*.html")); [HTMLParser().feed(f.read_text()) for f in files]; assert len(files)==4; print("parsed 4 payroll HTML files")'` -- expected: parse đủ bốn mockup Payroll.
- `git diff --check` -- expected: không có lỗi whitespace.
- `git diff -- _bmad-output` -- expected: chỉ thay đổi artifact trong phạm vi contract đã duyệt.

**Kết quả 2026-09-09:** Các lệnh `rg` trên pass và xác nhận lifecycle `CALCULATED -> SUBMITTED -> APPROVED|REFUSED`, revision sau refusal, đầy đủ capability binding, separation-of-duties loại mọi preparer/material editor/submitter, cùng story key 6.2 giữ `backlog`. Python `html.parser` parse đủ 4 trang `payroll-*.html`; audit thuật ngữ xác nhận contract thực thi canonical chỉ còn mô hình program-driven/exact settlement, còn mô tả Student Prepayment cũ chỉ nằm trong proposal `Historical only` hoặc review/spec evidence. `git diff --check` pass.

## Suggested Review Order

**Contract tài chính canonical**

- PRD chốt program-driven prepayment và exact Receipt không số dư.
  [`prd.md:168`](../planning-artifacts/prds/prd-passionedu-2026-09-04/prd.md#L168)

- Architecture gom finance lifecycle vào một invariant triển khai duy nhất.
  [`ARCHITECTURE-SPINE.md:94`](../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md#L94)

- Proposal cũ được giữ truy vết nhưng loại khỏi build input.
  [`sprint-change-proposal-2026-09-05.md:10`](../planning-artifacts/sprint-change-proposal-2026-09-05.md#L10)

**Phân quyền và lifecycle Payroll**

- SPEC định nghĩa persona, capability và separation-of-duties xuyên grant.
  [`SPEC.md:48`](../specs/spec-passionedu/SPEC.md#L48)

- Spine liệt kê đầy đủ capability và kiểm tra identity ở server.
  [`ARCHITECTURE-SPINE.md:158`](../planning-artifacts/architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md#L158)

- Roadmap bổ sung SUBMITTED, REFUSED và đường quay lại revision.
  [`payroll-module-roadmap-2026-09-08.md:165`](../planning-artifacts/payroll-module-roadmap-2026-09-08.md#L165)

- Backlog chuyển quyết định thành acceptance criteria theo từng capability.
  [`epics-passionedu.md:1483`](../planning-artifacts/epics-passionedu.md#L1483)

**UX và tracking**

- Experience phân tách action của School Admin và Finance Manager.
  [`EXPERIENCE.md:71`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md#L71)

- Coverage đưa bốn mockup Payroll vào phạm vi review hiện hành.
  [`MOCKUP-COVERAGE.md:21`](../planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/MOCKUP-COVERAGE.md#L21)

- Tracker đổi tên Story 6.2 nhưng giữ nguyên trạng thái backlog.
  [`sprint-status.yaml:66`](sprint-status.yaml#L66)
