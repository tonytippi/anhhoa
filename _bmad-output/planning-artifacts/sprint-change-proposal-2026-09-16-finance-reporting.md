---
name: Finance reporting as-of workspace and CSV export
status: approved
date: 2026-09-16
trigger: Product review found that FR-11 defines ledger measures but not the reporting semantics, concrete Finance workspaces, or controlled export needed for reliable school reconciliation.
approval: User approved direct implementation on 2026-09-16.
---

# Sprint Change Proposal - Finance reporting as-of workspace and CSV export

## 1. Issue summary

FR-11 already requires ledger-derived finance reporting, but leaves the report point-in-time, period boundary, reversal/refund treatment, report surfaces, and export behavior undefined. Implementations could therefore produce different totals for the same finance history, while Finance has no defined reconciliation workspace or controlled way to extract the selected result.

## 2. Approved product decision

1. E6 provides four School-scoped Finance reporting workspaces: Finance overview, CollectionRun reconciliation, outstanding and debt, and cash and adjustments ledger.
2. Every report is a read-only server-generated snapshot with `asOf`, `generatedAt`, School business timezone, applied filters, and a report-definition version. MVP timezone is `Asia/Ho_Chi_Minh`.
3. A result contains only ledger events posted no later than `asOf`. Billing measures group by Invoice `billingMonth`; cash measures group by Receipt/refund/reversal posting time. Later postings do not rewrite a previously returned as-of result.
4. Posted refund/reversal appears at its posting time with source provenance. Revision/cancellation retains both documents for audit but obligation measures count only the current effective obligation under the server-defined lineage projection.
5. Finance Manager and School Admin can read and export only their authorized School results. CSV is the sole MVP export format and contains the returned rows plus report metadata; the API generates, scopes, audits, expires, and re-authorizes the download. CSV does not create a finance snapshot, settlement, or mutation.
6. Accounting period close/reopen, scheduled/custom reports, dashboard customization, PDF/XLSX formatting, and Payroll reporting are deferred. Payroll remains a separate accounts-payable reporting scope after E10/E11.

## 3. Impact analysis

| Area | Impact |
| --- | --- |
| PRD | Add report semantics, authorized CSV export, report workspaces, and explicit deferrals to FR-11. |
| Addendum | Add reporting invariants and verification scenarios. |
| Architecture Spine | Define a finance read-model boundary, as-of semantics, export authorization, audit and retention. |
| UX | Replace the single generic report view with four workspaces, metadata, drill-down and safe export states. |
| SPEC | Make reporting capabilities and constraints preservation-validated. |
| Epics | Expand Story 6.5 and Epic 6 release gate; no new epic, dependency, or release ordering change. |
| Sprint tracker | Story identity remains `6-5-bao-cao-finance-reconcile-tu-ledger`; no status transition is required. |

## 4. Recommended approach

Direct adjustment within Epic 6. This is a moderate planning change with no implementation started, no rollback, and no data migration. It preserves the multi-tenant, API-authoritative, append-only ledger, VND integer, immutable snapshot, and Parent read-only invariants.

## 5. Verification criteria

- The same filter and `asOf` reconcile identically across overview, run, outstanding, and ledger workspaces.
- Events posted after `asOf` do not change the response; business dates use `Asia/Ho_Chi_Minh` boundaries.
- Fixtures prove correct treatment of Receipt, reversal, refund, revision/cancellation, shortfall/overpayment, carry, debt, and promotional coverage provenance.
- Cross-School reads and exports, client-supplied School authority, expired downloads, and direct object access are denied.
- A CSV download contains exactly the authorized report result and metadata, is auditable, and cannot expose Parent or Payroll data.

## 6. Handoff

Scope classification: Moderate backlog and contract adjustment. Product owns future reporting expansion decisions; Architecture owns the read-model/export boundary; UX owns the four-workspace behavior; Developer and QA implement Story 6.5 and its release proof after E5 dependencies are complete.
