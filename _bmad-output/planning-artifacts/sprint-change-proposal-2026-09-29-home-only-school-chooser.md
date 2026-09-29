---
name: Home-only School chooser for Admin and Teacher
status: approved
date: 2026-09-29
trigger: E2E release-gate exposed complexity and flakiness around changing School context while a scoped workspace is loading or dirty. Stakeholder feedback confirms multi-School memberships are rare and operators expect to return to home before choosing another School.
mode: batch
---

# Sprint Change Proposal - Home-only School chooser

## 1. Issue summary

Admin/Staff currently offers a School switcher inside every scoped workspace. This demands a cross-tenant transition protocol for dirty forms, pending Operations, stale data clearing, route focus and capability navigation. It is costly to use, hard to prove reliably in E2E, and does not match the intended operating behavior: users normally finish work in one School, return home, then choose another.

The observed evidence is the release-gate failure after selecting `Release Gate A`: navigation and focus assertions race the asynchronous context replacement. The immediate symptom is test instability, but the underlying product choice is the always-present switcher and its guard complexity, not a Finance data or authorization failure.

## 2. Impact analysis

| Area | Impact |
| --- | --- |
| PRD FR-2 | Replace Admin/Staff chooser/switcher wording with a Home-only chooser. URL remains a selector; server authorization remains unchanged. |
| PRD FR-2 consequences | Remove in-page School-switch dirty-form requirement. Add navigation-away guard for local dirty form or pending/uncertain Operation, regardless of destination. |
| PRD UX-DR2/UX-DR3 | Selected School remains visible; route focus moves to `h1`. School selection moves to Home; switch guard becomes leave-workspace guard. |
| PRD release scope | Change “chooser/switcher” to “Home chooser and authorized deep link” for Admin/Staff. Parent stays unchanged: it retains its own multi-School chooser behavior. |
| Epics 1.4/1.6 | Story 1.4 acceptance and Story 1.6 E2E proof must change from in-page switch guard to Home chooser, deep-link reauthorization, leave guard and revoke/suspend fallback. |
| Other completed stories | Do not rewrite historical done specs or implementation evidence. Add one follow-up UX remediation story under Epic 1. |
| Architecture | AD-3, AD-4 and AD-11 remain valid. No schema, API authorization, session audience, Operation scope or server route contract changes. Architecture wording only needs a clarification that portal navigation policy is Home-only. |
| UX spine | Information Architecture, School context switcher component, state patterns, interaction primitives, accessibility floor and key flows currently prescribe in-page switching and need canonical update. |
| Mockups | Admin and Teacher shell mockups need Home chooser entry, visible read-only School label within scoped workspaces, and “Về trang chủ / Đổi trường” navigation. No finance/roster workflow layout changes. |
| Client code | `SchoolContext` and Teacher equivalent stop rendering mutable School select in scoped routes; Home owns chooser. Route/leave guards protect dirty/pending state before leaving any scoped workspace. Deep links remain permitted after API authorization. |
| Tests | Replace switch-in-place E2E with Home chooser, return-home guard, authorized deep link, revoke/suspend safe fallback and route heading focus tests. Finance E2E starts from Home and waits for the selected context's route/navigation. |

### Invariants preserved

1. `School` stays tenant root. API reauthorizes every request; chooser, Home state, URL, local storage and browser context are selectors only.
2. A user may still have many active SchoolMemberships and use any authorized direct School URL.
3. Revoke/suspend denies the next business request and clears protected client state before a safe Home chooser/sign-out fallback.
4. High-impact mutation idempotency and Operation reconciliation are unchanged. A pending or uncertain Operation prevents leaving the scoped workspace until reconciled or cancelled safely.
5. Parent multi-School chooser and child authorization are not changed by this proposal.

## 3. Recommended approach

**Selected approach: Direct backlog adjustment with Home-only context UX.** Keep the multi-tenant server model and scoped URLs, but make Home the only Admin/Teacher selection point. Within a scoped route, display the School name as context and offer an explicit route back to Home to change it.

**Effort:** Medium. **Risk:** Medium-low. The change concentrates in portal shell/routing, UX artifacts and E2E. The main risk is accidentally treating Home selection as authorization; mitigated by retaining current API reauthorization and direct-link negative tests.

### Alternatives considered

| Alternative | Verdict | Reason |
| --- | --- | --- |
| Stabilize current switcher E2E only | Rejected | Treats the symptom while retaining an interaction users rarely need and a broad dirty-transition surface. |
| Remove multi-School support | Rejected | Membership, authorization and authorized deep links remain a core platform requirement. |
| Home-only chooser with scoped deep links | Selected | Reduces UI state transitions while retaining tenant isolation and the multi-School operating model. |

## 4. Detailed change proposals

### 4.1 PRD and architecture

**PRD `FR-2`, current:** “Admin/Staff chọn School qua chooser/switcher...” and dirty form behavior triggers “Khi user đổi School”.

**PRD `FR-2`, new:** Admin/Staff select an authorized School only from Home; each scoped route displays the selected School and may be opened via an authorized School URL. To work in another School, the actor returns Home, chooses it, then enters a scoped destination. Dirty form or pending/uncertain Operation blocks leaving the scoped workspace, offers remain/discard-before-submit/reconcile as applicable, and never silently loses input or assumes target-School authorization.

**Architecture clarification:** Add to AD-3/AD-11: portal context selection policy is Home-only for Admin/Teacher; API reauthorization and URL selector rules are unchanged. Parent has independent chooser behavior.

### 4.2 UX and mockups

Update `EXPERIENCE.md`:

1. School chooser row: Admin/Teacher Home is the sole chooser; Parent behavior remains as-is.
2. Component pattern: replace `School context switcher` with read-only visible School context plus `Về trang chủ` action.
3. State/interactions: replace switch guard with leave-workspace guard for dirty forms and pending Operations.
4. Accessibility: Home selection routes to an authorized overview and focuses its `h1`; scoped route heading includes visible School context. Return action is keyboard reachable and guarded before navigation where needed.
5. Key flows: remove in-page switch examples; state Home return/choose sequence.

Update Admin and Teacher shell mockups to show chooser only on Home and a visible non-selectable School name with `Về trang chủ` from scoped screens. Finance mockups remain table-first and do not gain a new layout.

### 4.3 Backlog and implementation

Add Epic 1 remediation story, proposed key: `1-7-home-only-school-chooser-va-leave-guard`.

**Story outcome:** As an Admin or Teacher with more than one authorized School, I choose a School from Home and work within that one visible context, so that switching tenant work is deliberate and forms/Operations cannot be lost during an in-page context transition.

**Acceptance criteria:**

1. Given an authenticated Admin/Teacher has multiple authorized Schools, when opening Home, then Home lists only server-authorized Schools and choosing one opens its overview with route `h1` focus.
2. Given an actor is inside a School-scoped destination, when viewing the shell, then the School name is visible but not a mutable select; an explicit Home action is available.
3. Given a scoped form is dirty or an Operation is pending/uncertain, when the actor chooses Home, browser back, another internal destination or a different authorized School URL, then a leave guard preserves input or requires reconciliation; no data is silently discarded.
4. Given a valid authorized School URL is opened directly, when API authorization succeeds, then the scoped route loads without Home selection; denied, revoked or suspended context clears protected state and routes safely to Home/chooser.
5. Given an actor changes School through Home, when the new context loads, then prior School protected data is cleared and only server-authorized navigation/content appears.

Update `sprint-status.yaml` after proposal approval: set `epic-1: in-progress` if not already, add story `1-7-home-only-school-chooser-va-leave-guard: ready-for-dev`.

## 5. Implementation handoff

**Scope classification:** Moderate.

| Recipient | Responsibility |
| --- | --- |
| Product/UX | Approve proposal; update final PRD/UX/mocks before code. |
| Product/Developer | Add Story 1.7 and tracker entry without rewriting done history. |
| Developer | Implement portal shell/routing/leave guard after canonical artifacts are updated; retain API contracts. |
| QA/Developer | Update and run Admin/Teacher release gates with `.env.test`, including Home chooser, deep link, revoke/suspend and pending Operation proof. |

### Sequencing

1. Approve this proposal.
2. Update canonical PRD, UX spine, architecture clarification, mockups, epics and tracker.
3. Create implementation spec for Story 1.7.
4. Implement Admin and Teacher Home-only chooser and navigation-leave guard.
5. Replace switcher E2E and rerun release gates with `.env.test`.

### Success criteria

1. Admin/Teacher can choose School only at Home but retain authorized direct scoped URLs.
2. Scoped pages prominently identify the active School and do not contain a mutable School selector.
3. Leaving dirty or uncertain work remains safe regardless of navigation destination.
4. API authorization, cross-School isolation, revoke/suspend behavior and Parent chooser contract remain unchanged.
5. E2E proves Home selection and safe transition without in-page School-switch flakiness.

## 6. Checklist status

| Checklist item | Status | Evidence |
| --- | --- | --- |
| 1.1 Triggering story | [x] Done | E1 release-gate School context E2E and Finance gate setup. |
| 1.2 Core problem | [x] Done | New stakeholder UX requirement; in-page switching is unnecessary complexity. |
| 1.3 Evidence | [x] Done | E2E context race after School selection; rare multi-School operator behavior. |
| 2.1-2.5 Epic impact | [x] Done | Epic 1 remediation story; no resequencing or invalidation of other epics. |
| 3.1 PRD | [x] Done | FR-2, UX-DR2/3, release scope and E1 stories need replacement wording. |
| 3.2 Architecture | [x] Done | Clarification only; server tenant and API contracts unchanged. |
| 3.3 UX | [x] Done | Shell, interaction, accessibility, flows and Admin/Teacher mockups require update. |
| 3.4 Secondary artifacts | [x] Done | E2E, implementation specs, epic tracker and portal tests require updates. |
| 4.1 Direct adjustment | [x] Viable | Medium effort and medium-low risk. |
| 4.2 Rollback | [x] Not viable | Server multi-School model and route authorization remain necessary. |
| 4.3 MVP review | [N/A] | MVP capability remains; only portal context interaction changes. |
| 4.4 Selected path | [x] Done | Home-only chooser plus route-leave guard. |
| 5.1-5.5 Proposal/handoff | [x] Done | Sections 1-5 define changes, owners, sequencing and success. |
| 6.1-6.2 Review | [x] Done | Proposal preserves API and Parent tenant boundaries. |
| 6.3 Approval | [!] Action-needed | Explicit approval required before canonical artifact/code changes. |
| 6.4 Tracker update | [!] Action-needed | Apply after approval. |
| 6.5 Handoff | [!] Action-needed | Begin Story 1.7 only after canonical updates. |

## 7. Approval request

Approve this proposal to replace Admin/Teacher in-page School switching with Home-only School selection, add a navigation leave guard, and update the canonical PRD, UX, mockups, Epic 1 tracker and E2E contracts. This does not change server authorization, multi-School membership, scoped URLs, Parent chooser behavior or Finance domain rules.

## 8. Approval

Approved by Tony on 2026-09-29. The approved scope is limited to Admin/Teacher portal context navigation, its UX/mocks, Epic 1 remediation backlog and release-gate coverage. Historical `final` PRD and architecture artifacts remain unchanged; this approved decision and the updated UX/backlog artifacts govern implementation.
