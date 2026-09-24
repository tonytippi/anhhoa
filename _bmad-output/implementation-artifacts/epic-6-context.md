# Epic 6 Context: Thu tiền, đối soát công nợ và báo cáo sổ cái

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Hoàn thiện lớp settlement Finance sau khi Invoice đã được phát hành: ghi nhận tiền thực nhận để đóng một Invoice, bảo toàn chênh lệch, promotion coverage, correction/refund và prior debt bằng ledger append-only; đồng thời cung cấp báo cáo và CSV có thể đối soát theo thời điểm. Điều này bảo đảm dòng tiền, nghĩa vụ và lịch sử không bị thay đổi bởi client, retry, concurrency hoặc dữ liệu cấu hình hiện tại.

## Stories

- Story 6.1: Ghi actual Receipt, dong Invoice va carry chenh lech
- Story 6.2: Dong exact Invoice co promotion coverage
- Story 6.3: Correction và hoàn tiền promotion coverage theo operating-day preview
- Story 6.4: Chuyển prior debt và year-end settlement an toàn
- Story 6.5: Báo cáo finance reconcile từ ledger
- Story 6.6: Release gate cho actual Receipt, carry và promotion coverage refund

## Requirements & Constraints

- Finance Manager đóng đúng một Invoice `ISSUED` trong một lần ghi actual Receipt. Server đóng Invoice và suy ra duy nhất `EXACT`, `SHORTFALL` hoặc `OVERPAYMENT`; client không được đặt state, outstanding, outcome, difference, allocation hay carry.
- Close non-exact phải append chính xác một `SettlementDifference` immutable, source-linked đến Invoice và Receipt. Không có partial settlement, Receipt unallocated, generic balance, `StudentPrepayment`, hoặc dùng Receipt/carry lẫn Student, School hay SchoolYear.
- Chỉ Invoice `DRAFT` của `MONTHLY` CollectionRun kế tiếp đủ điều kiện, cùng Student/School/SchoolYear, mới materialize phần còn lại thành `SHORTFALL_CARRY` hoặc `OVERPAYMENT_CARRY`. Negative carry không được làm tổng Invoice âm; số chưa áp dụng vẫn ở source difference và không thể áp dụng thủ công/lặp lại.
- `PREPAID_COVERAGE` thuộc normal monthly run, không phải CollectionRun riêng. Invoice chứa future coverage facts chỉ được issue `StudentPromotionalCoverage` khi close `EXACT`; receipt non-exact, cancellation, overlap, sai policy/SchoolYear hoặc concurrent state change phải từ chối toàn bộ posting/coverage. Coverage snapshot policy version, per-period receivable, interval, giá/discount, calendar/timezone và Invoice/Receipt provenance; normal run chỉ skip fact đã cover.
- Correction, reversal và refund không sửa Invoice, Receipt, Allocation hoặc coverage gốc. Refund coverage dùng paid snapshot, service interval và calendar snapshot để tính operating day, loại trừ withdrawal effective date, floor VND, từ chối mẫu số không dương và không vượt nguồn tiền còn lại. Override approved amount không âm, không vượt limit và bắt buộc reason khi khác calculated amount.
- Reversal/refund tuân FinancePolicy: `DIRECT` cho actor có quyền post; `SCHOOL_ADMIN_APPROVAL` yêu cầu Finance Manager tạo request và School Admin khác identity approve/refuse. Mọi action lưu source, actor, reason khi cần và outcome audit-safe.
- Prior debt chỉ được chuyển traceable, atomic vào obligation mới trong cùng SchoolYear và không thu hai lần. Không auto-carry qua SchoolYear mới; write-off, adjustment hoặc payment cuối năm là workflow audited riêng.
- Bốn workspace read-only gồm overview, CollectionRun reconciliation, outstanding/debt và cash/adjustment ledger. Chúng tách gross, promotion discount/refund, net billed, actual Receipt, settlement difference/carry, revision/cancellation, coverage và outstanding; không có period close/reopen, custom/scheduled report, PDF/XLSX hay Payroll report.
- Report chỉ đọc posted ledger event không muộn hơn `asOf` và immutable snapshots. Billed group theo Invoice `billingMonth`; cash group theo Receipt/refund/reversal posting time. Response/CSV phải trả `asOf`, generated time, `Asia/Ho_Chi_Minh`, normalized filter và report-definition version; CSV được tạo từ chính result đã authorize, audited, opaque/expiring và re-authorize khi tải.

## Technical Decisions

- `finance` sở hữu Receipt, Allocation, SettlementDifference/carry, coverage, reversal/refund, DebtTransfer, reporting và aggregate write/read; API là authority duy nhất cho authorization, VND calculation, transitions, snapshots, audit, report và Operations. VND lưu PostgreSQL `BIGINT` và trả REST JSON-safe integer.
- Mọi business query, write, unique constraint, audit và Operation đều scope `School`. Resolve active same-School membership/capability trước aggregate lookup; `schoolId` route/filter/client state chỉ là selector, không là authorization proof. Finance Manager hoặc School Admin có quyền mới xem report/export.
- Finance posting dùng shared transaction boundary và consistent lock order để serialize settlement writers, giới hạn source/remaining và chặn duplicate close, duplicate carry materialization, cancelled target, cross-tenant/year use và concurrent over-application. Issued-content correction tạo replacement, atomically cancel source, giữ immutable source snapshots/Receipt và biểu diễn settlement trên replacement qua append-only transfer provenance.
- Actual-receipt close, carry materialization, policy selection, revision/cancellation/settlement transfer, reversal/refund và approval cần UUID `Idempotency-Key`. Operation scope School, route, actor context và request fingerprint; identical retry replay outcome, changed reuse conflict, và client phải reconcile `GET /operations/:operationId` trước retry sau timeout.
- API tests bao phủ transition/calculation. PostgreSQL integration phải chứng minh tenant graph, source/remaining limits, idempotency, transaction/lock concurrency, lower/exact/higher close, bounded carry, coverage issuance/refund, replacement lineage, debt transfer và report `asOf` reconciliation. E1 tenant-isolation gate là dependency release bắt buộc.

## UX & Interaction Patterns

- Finance surfaces là Admin deep destinations trong Invoice/CollectionRun context; Receipt chỉ mở cho Invoice `ISSUED` đã chọn. Trước confirmation, hiển thị server-returned exact/shortfall/overpayment outcome và carry provenance; timeout hoặc concurrent change refresh server state và chuyển sang Operation reconciliation, không local override/double submit.
- Invoice review hiển thị immutable obligation/Payment instruction, actual Receipt, outcome, difference và carry status. Correction cần reason và named confirmation; source chỉ thành `CANCELLED` khi replacement được issue.
- Settlement/correction dialog đặt immutable source facts và available impact trước input editable. Direct post hoặc approval/refusal dùng named confirmation; ở two-step mode requester không thấy approve action. Promotional refund hiển thị coverage/Invoice/Receipt source, interval, calendar version, operating days, calculated amount và remaining paid-source limit.
- Báo cáo giữ visible School, period/filter và as-of context; table dùng caption, keyboard access, VND right-aligned, responsive scroll/card treatment, accessible loading/error/empty/expired-export states. Không có activity phải nói không có ledger activity khớp filter, không khẳng định zero collected thiếu as-of context.

## Cross-Story Dependencies

- Epic 5 là prerequisite: CollectionRun monthly, Invoice `DRAFT`/`ISSUED`, immutable obligation/payment snapshots và normal per-Receivable promotion snapshot. Chỉ fulfillment `PREPAID_COVERAGE` cùng future coverage facts là prerequisite riêng cho Story 6.2/6.3, không phải requirement của Pha 1b discount.
- Story 6.1 là nền cho settlement outcome và next-run carry; Story 6.2 chỉ issue coverage sau exact close; Story 6.3 dùng coverage/Receipt provenance và calendar/service snapshots; Story 6.4 reuses actual-receipt close cho target prior-debt Invoice; Story 6.5 đọc toàn bộ posted ledger/provenance; Story 6.6 là release gate cho các hành vi trên.
- Epic 7 phụ thuộc Epic 6 cho Parent read-only effective Invoice/payment projection; không được lộ correction rationale, SettlementDifference, transfer provenance hay cho Parent mutation Finance.
