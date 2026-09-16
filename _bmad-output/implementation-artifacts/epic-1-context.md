# Epic 1 Context: Vận hành nền tảng đa trường và truy cập có kiểm soát

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the clean-break PassionEdu control plane: independently deployed portal surfaces, Google identity and audience-isolated sessions, Platform Operations School lifecycle, and membership/capability authorization. This epic must prove that a School is a hard tenant boundary, including after revoke, suspension, timeout, or crafted cross-School requests, before any School business domain can be released.

## Stories

- Story 1.1: Khởi tạo nền tảng target đa portal
- Story 1.2: Đăng nhập Google và cô lập session theo audience
- Story 1.3: Provision và lifecycle School qua Ops
- Story 1.4: Membership, capability và School context an toàn
- Story 1.5: Tenant graph, mutation protection và audit provenance
- Story 1.6: Release gate về tenant isolation và audience access

## Requirements & Constraints

- Platform Operators can provision, suspend, and reactivate Schools, bootstrap the first School Admin by normalized email, and never acquire School business-data access from their platform grant. Suspension blocks the next School business request without deleting the School or unrelated global sessions.
- A canonical global Google identity has no embedded School role. Active `SchoolMembership` and School role/capability grants are resolved server-side for every Admin/Staff request; Staff records or assignments never grant login, membership, or role by themselves.
- Google callbacks, sessions, cookies, and origins are isolated by Admin, Teacher, Parent, and Ops audience. A cookie accepted by one audience must be rejected by the others. Parent session issuance requires an atomic active Parent-Student link recheck; no link denies the session, one School enters directly, and multiple Schools expose only authorized choices.
- Every School aggregate, query, mutation, unique constraint, audit record, and School business Operation must remain tenant-scoped. URL parameters, UUIDs, filters, headers, and browser context only select a School and never prove authorization. Revocation must deny the next request while preserving valid access in another School.
- Cookie-authenticated mutations validate origin and double-submit CSRF before transition. High-impact workflows use a UUID `Idempotency-Key`; identical actor/route/fingerprint retries replay their recorded outcome, changed fingerprints conflict, and clients reconcile the saved Operation before retrying after a timeout.
- Audit records capture School where applicable, actor identity and actor reference, timestamp, provenance, and required reason. Parent protected responses, payment instructions, media, and evidence URLs must not be service-worker cached.
- Epic completion requires automated PostgreSQL integration and portal E2E proof for tenant isolation, scoped uniqueness, audit/Operation provenance, revoke and suspension, audience/session isolation, chooser/switcher states, and Parent cross-School authorization. This is a blocker for all following epics.

## Technical Decisions

- Use the clean-break pnpm/Turborepo topology: `apps/api`, `apps/web` (Admin), `apps/teacher-web`, `apps/parent-web`, `apps/ops-web`, `packages/contracts`, `packages/ui`, and `deploy/compose`. Portal apps build and deploy separately; they may share only pure contracts, formatters, and stateless UI primitives, and never import another app or API internals.
- The NestJS modular-monolith API exclusively owns Prisma, migrations, PostgreSQL, authorization, transitions, audit, and Operations. Prisma and the multi-School schema live under `apps/api`; seed, development, and test data target the new model only, with no legacy schema, lifecycle, compatibility layer, or production `db push` path.
- `School` is the tenant root. Staff operational routes use `/schools/:schoolId/`; Parent routes use `/api/parent/schools/:schoolId/`. Resolve active membership/capabilities, or Parent audience/bound profile/active StudentParent, before any scoped lookup. Updates and deletes match record and School in one transaction; use composite `(schoolId, id)` tenant relations where supported, otherwise verify the full graph in the owning transaction.
- Fixed hosts are `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, and `api.passionedu.org`. Each audience has its own OAuth callback and origin allowlist plus host-only, `Secure`, `httpOnly`, `SameSite=Lax` cookie; do not use a `.passionedu.org` cookie.
- `SUPERADMIN_EMAIL` only bootstraps `PlatformOperatorGrant` from environment. Provisioning atomically creates or reuses the pending owner identity, membership, and `SCHOOL_ADMIN` grant. It is the sole exception to School-scoped Operations: its Operation is scoped to PlatformOperatorGrant before a School exists, and reads authorize that same grant context.
- State-changing multi-record flows run in PostgreSQL transactions. Operations bind School, route, actor type/reference, actor identity when present, request fingerprint, and outcome. API endpoints return JSON-safe values and portals consume REST only.
- Deploy the pilot with source-built Docker Compose services, a TLS proxy routing each host to its container, durable PostgreSQL storage, secrets outside Git, and migrations before the dependent API version. Destructive rollback is disallowed.

## UX & Interaction Patterns

- Admin and Ops are desktop-first responsive PWAs; Teacher and Parent are mobile-first. Portals keep separate shells and sessions rather than switching audiences within a shell. Admin/Staff navigation shows only server-granted capabilities; Ops exposes only School list, provision, and suspend/reactivate workflows, never School business destinations.
- Always display the selected School by name in the context control and operational heading. Route changes focus the `h1`; shells include skip link, named navigation, semantic main content, and text-labeled statuses. Use AA contrast and visible focus indicators; do not rely on color alone.
- School switching during a dirty form or uncertain submitted mutation presents only remain, discard before submit, or Operation reconciliation. Never auto-save, silently switch context, or enable retry until reconciliation resolves. Clear protected memory/query state on logout, expiry, `401`, revoke, and before showing another protected view.
- Ops provision and suspend/reactivate actions require confirmation, show server-confirmed state only, retain a failed provision form without claiming partial success, and enter reconciliation while timeout disables duplicate action. A suspended School shows an explanation and an allowed alternative School chooser rather than stale content.
- Validation keeps entered values, focuses an error summary linked to field errors, and shows errors beside their fields. Dialogs trap and return focus; destructive and discard actions require named confirmation. Parent safe states retain no child names or protected content.

## Cross-Story Dependencies

- Story 1.1 provides the workspace, API ownership, deployment, and distinct portal shells required by Stories 1.2 through 1.6.
- Story 1.2 establishes identity and audience-session contracts used by School lifecycle and membership flows; its Parent callback and School-selection authorization contract is reused by Epic 7.
- Story 1.3 creates the School, pending owner membership, and platform-scoped provisioning Operation on which membership and tenant-scoped business work depend.
- Stories 1.4 and 1.5 provide the authorization, tenant graph, audit, CSRF, and idempotency foundations that every later School-scoped epic must use.
- Story 1.6 validates the preceding stories and gates release of Epic 2 and all subsequent School business domains.
