---
name: "Re-sequence Parent-link proof from Epic 1 release gate"
status: approved
date: 2026-09-16
trigger: "Story 1.6 release-gate planning found that its Parent-link acceptance proof requires Student, ParentProfile and StudentParent, which the approved backlog creates only in Stories 2.2-2.3."
---

# Sprint Change Proposal - Re-sequence Parent-link proof from Epic 1 release gate

## 1. Issue Summary

### Trigger and evidence

During planning of Story 1.6, the release-gate contract was found to require a PostgreSQL fixture with multiple Parent links and tests for Parent-link revoke and cross-School authorization before Epic 2 may start.

- `epics-passionedu.md:441-449` requires multiple Parent links, Parent-link revoke and safe fallback in Story 1.6.
- `epics-passionedu.md:483-527` places Student creation in Story 2.2 and ParentProfile/StudentParent creation, binding and revoke in Story 2.3.
- The current target schema has only the `PARENT_PROFILE` audience enum, not `ParentProfile`, `Student` or `StudentParent`; therefore an Epic 1 fixture cannot represent those facts truthfully.
- `prd.md:344-347`, `prd.md:357`, `addendum.md:40-45`, and Architecture AD-11 already position Parent multi-School/cross-School E2E as a later proof after its domain exists.

### Problem classification

This is a requirement sequencing inconsistency in the epic breakdown, not a new stakeholder requirement, implementation defect, or change in the Parent security model. Implementing the literal Story 1.6 wording would either pull Epic 2 roster/Parent domain into Epic 1 or create fabricated authorization fixtures. Both violate the clean-break scope and the rule that client School context never proves authorization.

## 2. Impact Analysis

### Checklist status

| Item | Status | Finding |
| --- | --- | --- |
| 1.1 Trigger story | [x] Done | Story 1.6, release gate for tenant isolation and audience access. |
| 1.2 Core problem | [x] Done | Parent-link proof is ordered before its domain model. |
| 1.3 Evidence | [x] Done | Story 1.6 AC, Story 2.2/2.3 dependency and current schema inspection conflict. |
| 2.1 Current epic | [x] Done | Epic 1 can complete with authorization facts it actually owns. |
| 2.2 Epic-level change | [x] Done | Narrow Story 1.6 to E1 contracts; add explicit deferred Parent-link proof after Story 2.3. |
| 2.3 Future epic impact | [x] Done | Story 2.3 gains release proof; Epic 7 continues to own Parent read-model E2E. |
| 2.4 New/obsolete epics | [x] Done | No new or obsolete epic; no renumbering. |
| 2.5 Order/priority | [x] Done | Epic order remains E1 -> E2. Parent-link proof runs after Story 2.3, before Parent portal business release. |
| 3.1 PRD conflict | [x] Done | No PRD change: FR-6/FR-16 already require active-link authorization at request time; release order already puts E2 after E1. |
| 3.2 Architecture conflict | [x] Done | No Spine change: AD-3/AD-4/AD-11 specify StudentParent resolution and Parent E2E but do not require its implementation in E1. |
| 3.3 UX conflict | [x] Done | No UX change: Parent chooser/revoke safe states remain contractual and become testable after Story 2.3. |
| 3.4 Secondary artifacts | [!] Action-needed | Add an executable E1 gate script/E2E topology; update Story 1.6 spec and sprint status only after implementation passes. |
| 4.1 Direct adjustment | [x] Viable | Medium effort, low product risk; one backlog correction and two scoped verification gates. |
| 4.2 Rollback | [x] Not viable | Stories 1.1-1.5 correctly implement E1 foundations; rollback adds risk and does not create Parent facts. |
| 4.3 MVP review | [x] Not viable | MVP scope and Parent security model remain unchanged. |
| 4.4 Recommended path | [x] Done | Direct adjustment to story sequencing. |

### Epic and story impact

| Area | Impact |
| --- | --- |
| Epic 1 / Story 1.6 | Retains mandatory release proof for tenant graph, scoped uniqueness, audit/Operation provenance, membership revoke, School suspension, audience/session isolation, CSRF/idempotency and portal safe states. Parent proof is explicitly limited to fail-closed session/callback/no-data behavior because no active link exists yet. |
| Epic 2 / Story 2.3 | Adds the missing release proof immediately after Parent-link domain implementation: two Schools, multiple StudentParent links, cross-School URL/filter/UUID denial, atomic session issuance, next-request revoke, chooser/signed-out safe state and survival of another valid link. |
| Epic 7 | No scope or ordering change. Its Parent read-model E2E still proves child-level DTO/retention/cache/deep-link behavior after attendance, journals and finance projections exist. |
| PRD, Addendum, Architecture Spine, UX | No edits proposed. Their current contracts remain correct and already require server-side StudentParent authorization, safe state, no cache and eventual Parent cross-School E2E. |
| CI/test topology | Story 1.6 must add an explicit executable release-gate task that fails CI when E1 tenant/audience suites fail. Story 2.3 must add its Parent-link integration/E2E gate to the same release verification contract before Parent protected features are released. |

## 3. Recommended Approach

Choose **Direct Adjustment**: correct the Story 1.6 acceptance boundary and attach Parent-link proof to Story 2.3, with no change to the product model, security invariants, epic numbering, or release order.

This preserves a hard E1 blocker: no School business domain may begin until tenant isolation for all facts implemented by E1 is proven. It also prevents false confidence: Parent link behavior is not declared complete until the database relation and atomic authorization resolver exist.

**Effort:** Medium. Story 1.6 adds the currently missing API/portal E2E runner and E1 release suite. Story 2.3 adds Parent-link integration/E2E proof alongside the domain it creates.

**Risk:** Low after correction. The remaining risk is E2E environment setup; mitigate with an isolated PostgreSQL database and a server-authoritative fixture rather than mocked browser fetches.

## 4. Detailed Change Proposals

### 4.1 Epic backlog: Story 1.6 acceptance criteria

Artifact: `epics-passionedu.md`
Story: `1.6 - Release gate về tenant isolation và audience access`

**OLD:**

```markdown
Given it nhat hai School, nhieu membership/Parent link va cac audience sessions trong PostgreSQL integration fixture
When suite chay cac route/query/write/report scoped
Then cross-School UUID, filter, route, header, join, aggregate va relation insert deu bi tu choi
And scoped unique constraints va audit/Operation provenance duoc kiem tra bang automated tests.

Given mot membership, Parent link hoac School bi revoke/suspend
When request ke tiep va portal foreground/deep-link dien ra
Then server tu choi context khong hop le, portal xoa protected state va dua user ve chooser hoac signed-out safe state
And valid context khac cua cung UserIdentity van dung duoc.
```

**NEW:**

```markdown
Given it nhat hai School, nhieu SchoolMembership va session audience Admin, Teacher, Parent, Ops trong PostgreSQL integration fixture
When release suite chay moi route/query/write scoped ma Epic 1 da phat hanh
Then cross-School UUID, route, header, membership/Operation reference va tenant-owned relation insert deu bi tu choi
And scoped unique constraints, audit/Operation provenance, origin/CSRF denial va idempotency scope duoc kiem tra bang automated tests.

Given mot SchoolMembership hoac School bi revoke/suspend
When request ke tiep va portal foreground/deep-link dien ra
Then server tu choi context khong hop le, portal xoa protected state va dua user ve chooser hoac signed-out safe state
And valid context khac cua cung UserIdentity van dung duoc.

Given Parent audience chua co active StudentParent domain o Epic 1
When callback, session hoac protected request duoc thu
Then server va Parent portal fail-closed, khong issue Parent session va khong lo protected DTO/cache
And Parent-link/cross-School chooser/revoke proof la release gate cua Story 2.3 sau khi StudentParent ton tai.
```

**Rationale:** Scope assertions to aggregates/routes implemented by E1. The wording still blocks E2 until tenant and audience boundaries are verified, while reserving Parent authorization proof for the only story that can create the required authorization facts.

### 4.2 Epic backlog: Story 2.3 acceptance criteria

Artifact: `epics-passionedu.md`
Story: `2.3 - Liên kết Parent pending và revoke theo từng học sinh`

**OLD:**

```markdown
Given School Admin revoke StudentParent link
When Parent gui request ke tiep hoac mo protected child context
Then server tu choi child/school data dua tren link do va portal xoa protected state
And audit giu lich su link/revoke; Parent van co the xem Student/School khac neu link khac con active.
```

**NEW:**

```markdown
Given PostgreSQL integration va portal E2E fixture co it nhat hai School, nhieu StudentParent active/revoked cua mot ParentProfile va Parent session da bind
When Parent truy cap route, UUID, filter, School chooser hoac child context khong nam trong active link
Then ParentSchoolContext tu choi truoc protected query, DTO/cache khong lo Student/School khac va session issue chi xay ra sau atomic active-link recheck.

Given School Admin revoke mot StudentParent link
When Parent gui request ke tiep hoac mo protected child context
Then server tu choi child/school data dua tren link do va portal xoa protected state ve chooser hoac signed-out safe state
And audit giu lich su link/revoke; Parent van co the xem Student/School khac neu link khac con active.
```

**Rationale:** Makes the deferred release proof explicit, automated and surface-anchored at the point where `StudentParent` and Parent binding are implemented.

### 4.3 Implementation artifacts and tracking

| Artifact | Proposed change | Rationale |
| --- | --- | --- |
| `_bmad-output/implementation-artifacts/spec-1-6-release-gate-tenant-isolation-va-audience-access.md` | Replace the Parent-link blocker with the approved E1 fail-closed boundary; retain a link to Story 2.3 proof. | Allows implementation without falsifying coverage. |
| `_bmad-output/implementation-artifacts/sprint-status.yaml` | Keep `1-6: backlog` until Story 1.6 implementation/review/gate passes; then set `1-6: done`, retain `epic-1: in-progress` only until the approved E1 gate is complete, then set `epic-1: done`. Do not add/remove/renumber stories. | Status remains evidence-based. |
| Story 2.3 implementation spec | Require Parent-link PostgreSQL integration + actual browser E2E and make its pass a prerequisite for any Parent protected-domain release. | Prevents deferred proof from being lost. |

## 5. Implementation Handoff

**Scope classification:** Moderate. The change reorganizes verification responsibilities across two stories but preserves product and architecture contracts.

| Recipient | Responsibility |
| --- | --- |
| Product Owner | Approve this proposal and apply the two Epic story edits as the backlog decision. |
| Developer | Re-open and implement Story 1.6 under its corrected scope: executable API/PostgreSQL and portal release gate, including CI/Turbo failure behavior. Do not claim Parent-link coverage. |
| Developer | When Story 2.3 starts, implement StudentParent and Parent binding plus the specified Parent-link integration/E2E gate before closing the story. |
| QA / Release owner | Confirm E1 gate is required before Epic 2 work; confirm Story 2.3 Parent-link gate is required before any Parent protected domain/release. |

### Success criteria

1. Story 1.6 passes an automated E1 release task proving all currently implemented tenant/audience/revoke boundaries and fails CI when broken.
2. Epic 1 is marked done only after that task, review, and workspace verification pass.
3. Story 2.3 cannot be marked done without two-School, multi-link Parent authorization and revoke E2E/integration proof.
4. No Parent session or protected Parent DTO is issued before atomic active `StudentParent` recheck.

## 6. Approval and Next Steps

Approval authorizes the backlog edits in sections 4.1 and 4.2, unblocks the Story 1.6 implementation spec, and preserves the current sprint tracker until execution verification completes.

No PRD, Architecture Spine or UX contract edit is required because the proposal resolves an Epic sequencing inconsistency without changing those final contracts.

Approved by: Tony, 2026-09-16
