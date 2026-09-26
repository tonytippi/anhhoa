---
title: 'Finance table-first catalog và giảm trừ'
type: 'feature'
created: '2026-09-26'
status: 'done'
baseline_commit: '3e5a566016e50c7c2d1d8c83c46dc05ecd53de56'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-5-context.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Finance Admin workspace exposes receivable and promotion configuration as a long form-first screen with direct row buttons. This makes high-frequency accountant work slow and does not follow the established student-management row-menu pattern.

**Approach:** Make Khoản thu and Giảm trừ table-first surfaces. Move creation, assignment and lifecycle/transition confirmation into accessible dialogs, while retaining existing Finance REST commands, server authority and Operation reconciliation.

## Boundaries & Constraints

**Always:** `School` and `FINANCE_MANAGE` remain server-authorized on every existing command; browser code never derives VND, lifecycle, policy outcome or authorization. All existing CSRF, idempotency, audit and Operation reconciliation behavior remains intact. Tables use a final `Tùy chọn` `...` menu with keyboard opening, ArrowUp/ArrowDown/Home/End movement, Escape/blur/Tab close behavior and focus restoration. Important Finance create/change/lifecycle actions use one non-stacking dialog that receives focus, traps Tab and restores its trigger after cancellation or confirmed terminal success.

**Ask First:** Adding server-side catalog/promotion filtering, pagination or a new API endpoint; these are not present in the existing read contracts and must be scoped separately.

**Never:** Do not work on CollectionRun/Draft next navigation, Thu tiền, Receipt, ledger, Parent, Payroll, Finance authorization or data models. Do not make unavailable server-state actions visible, add optimistic status changes, expose raw provenance/audit identifiers, or turn a timeout into a retry without Operation reconciliation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Catalog/policy landing | Authorized Finance user enters workspace | Khoản thu and Giảm trừ present tables before creation forms; actions are in final row menus | Loading/empty state stays within selected School context |
| Lifecycle/transition | User chooses receivable/group lifecycle or promotion activate/retire | Named dialog confirms action before existing mutation runs | Validation/timeout leaves dialog and input state intact; terminal success refreshes server data and restores trigger focus |
| Assignment | Active policy version and Student selection | Assignment opens from row menu; active assignment can be ended from its own row menu | Server validation errors remain in dialog; unavailable actions are absent |
| Keyboard use | Menu/dialog opened by keyboard | Menu navigation and dialog focus are fully keyboard reachable | Escape/blur/Tab close menu; dialog Tab is trapped and cancel restores trigger |

</frozen-after-approval>

## Code Map

- `apps/web/src/finance/finance-workspace.tsx` -- owns Finance Admin state, REST commands and reconciliation; refactor only the promotion/catalog render surface and dialog/menu state without changing command payloads.
- `apps/web/src/finance/finance-workspace.test.tsx` -- existing Finance render, lifecycle, issue, receipt and reconciliation coverage; add regression proof for table-first dialogs, row-menu keyboard behavior, confirmation and focus restoration.
- `apps/web/src/roster/roster-workspace.tsx` -- established accessible `...` row menu model for menu roles, keyboard navigation, blur close and trigger focus return; reuse behavior, not cross-app state.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/EXPERIENCE.md` -- approved source for Finance table-first, managed dialog and accessibility behavior.
- `_bmad-output/planning-artifacts/ux-designs/ux-passionedu-2026-09-04/mockups/admin/receivable-configuration.html` and `promotion-configuration.html` -- approved visual/interaction references for catalog/promotion lists and dialogs.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/src/finance/finance-workspace.tsx` -- render promotion and receivable configuration as table-first sections, move forms into managed dialogs, and add accessible row menus/confirmation dialogs while preserving existing commands and reconciliation.
- [x] `apps/web/src/finance/finance-workspace.test.tsx` -- cover dialog-first entry, row-menu keyboard navigation, named transition confirmation, restored assignment-ending path, focus entry/trap/return and current Finance regressions.

**Acceptance Criteria:**
- Given an authorized Finance user opens Khoản thu or Giảm trừ, when data loads, then a concise table with a final `Tùy chọn` menu is the primary surface and no create/edit form precedes it.
- Given a Finance record action has monetary, lifecycle or policy effect, when the user selects it, then a named accessible confirmation dialog appears before mutation; validation and uncertain Operations retain the dialog context.
- Given an action is not permitted by server-returned state, when a row menu renders, then that item is absent and no local lifecycle status is asserted.
- Given keyboard-only use, when a row menu or dialog opens/closes, then focus movement, trapping and return meet the shared roster/UX accessibility pattern.
- Given existing Finance API behavior, when this UI change is used, then mutation payloads, API authority, idempotency and Operation reconciliation are unchanged.

## Design Notes

The table-first conversion deliberately reuses the current Finance read data rather than introducing pagination/filter API changes in this story. The next delivery slice owns CollectionRun/Draft navigation; this story must not fold it in merely because all sections currently live in one component.

## Verification

**Commands:**
- `pnpm --filter @passionedu/admin-web test -- src/finance/finance-workspace.test.tsx` -- expected: table-first/menu/dialog regressions and existing Finance behavior pass.
- `pnpm --filter @passionedu/admin-web typecheck` -- expected: Admin portal TypeScript build passes.
- `git diff --check` -- expected: no whitespace errors.

## Suggested Review Order

**Table-first Finance surfaces**

- Managed dialog and row-menu helpers preserve focused, server-confirmed interactions.
  [`finance-workspace.tsx:527`](../../apps/web/src/finance/finance-workspace.tsx#L527)

- Promotion configuration is now a table with state-gated actions and assignment rows.
  [`finance-workspace.tsx:971`](../../apps/web/src/finance/finance-workspace.tsx#L971)

- Receivable configuration keeps the catalog table primary and lifecycle behind its row menu.
  [`finance-workspace.tsx:1031`](../../apps/web/src/finance/finance-workspace.tsx#L1031)

**Accessible Confirmation**

- New dialogs provide focus entry, Escape dismissal, Tab trapping and trigger restoration.
  [`finance-workspace.tsx:1497`](../../apps/web/src/finance/finance-workspace.tsx#L1497)

- Promotion lifecycle requires a named confirmation before the existing mutation runs.
  [`finance-workspace.tsx:1520`](../../apps/web/src/finance/finance-workspace.tsx#L1520)

**Regression Proof**

- Tests cover transition confirmation, focus behavior, assignment posting and safe omitted arrays.
  [`finance-workspace.test.tsx:67`](../../apps/web/src/finance/finance-workspace.test.tsx#L67)
