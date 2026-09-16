# Epic 1 Context: Vận hành nền tảng đa trường và truy cập có kiểm soát

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Establish the clean-break PassionEdu multi-school control plane: Platform Operators can provision and manage School lifecycle without gaining School business-data access, while Admin, Staff, Teacher, Parent, and Ops use isolated portal audiences and receive only server-authorized School access. This epic supplies the tenant, authorization, idempotency, audit, and verification boundaries that block every subsequent School-domain release until proven.

## Stories

- Story 1.1: Khởi tạo nền tảng target đa portal
- Story 1.2: Đăng nhập Google và cô lập session theo audience
- Story 1.3: Provision và lifecycle School qua Ops
- Story 1.4: Membership, capability và School context an toàn
- Story 1.5: Tenant graph, mutation protection và audit provenance
- Story 1.6: Release gate về tenant isolation và audience access

## Requirements & Constraints

- Build a clean-break pnpm/Turborepo target with independently built and deployed Admin, Teacher, Parent, and Ops portals plus the API; do not reuse legacy single-school schema, APIs, sessions, lifecycle, compatibility code, seed data, or production `db push` paths.
- Platform Operations may provision, suspend, and reactivate Schools and bootstrap an initial pending School Admin by normalized email. Provisioning must be atomic: a failed request leaves no partial identity, membership, or grant. Schools are never hard-deleted.
- A Platform Operator grant is bootstrap-only and does not imply School membership or access to School business data. A suspended School rejects the next business request while an identity may retain a valid unrelated context elsewhere.
- Google OAuth binds one canonical platform identity. A session is issued only for the portal audience that initiated its allowlisted callback; cross-audience sessions must be rejected before protected data is returned.
- Admin and Staff can hold distinct active memberships and role grants at multiple Schools. Every request must resolve current membership and route capability server-side; client-provided URLs, IDs, filters, headers, and browser state select context but never prove authorization.
- School access changes, revocation, and role changes take effect on the next request, are audited with the actor and required reason, and affect only the selected School. Staff profiles and assignments do not create login, membership, or role access.
- Cookie-authenticated mutations require origin validation and double-submit CSRF. High-impact mutations use a client UUID `Idempotency-Key`; identical retries replay the saved outcome, changed request fingerprints conflict, and clients reconcile the authorized Operation before retrying after timeout.
- All School business data must be isolated on reads, writes, deletes, reports, aggregates, uniqueness, audit, and Operations. Cross-School resource IDs, joins, relation inserts, filters, route parameters, and headers must be rejected.
- PostgreSQL integration and portal E2E proof of tenant isolation, scoped uniqueness, revoke/suspension, idempotency, audit/Operation provenance, audience isolation, and School switching are release blockers. Epic 1 cannot complete while its tenant-isolation suite fails.

## Technical Decisions

- `School` is the tenant root. Every School business query and mutation scopes `schoolId`; update and delete commands match both resource ID and School ID inside one transaction. Tenant-owned relations use composite `(schoolId, id)` keys/foreign keys where available, otherwise the owning command validates the complete tenant graph transactionally.
- The only global identity exceptions are `UserIdentity`, `ParentProfile`, and `PlatformOperatorGrant`; their path to a School must be explicit through `SchoolMembership` or `StudentParent`. `UserIdentity` contains no role or `schoolId`; `SchoolRoleGrant` supplies capabilities through an active membership.
- Staff operational routes use `/schools/:schoolId/`. Parent routes use `/api/parent/schools/:schoolId/` and must first verify the Parent audience, bound profile, and active StudentParent relationship in that School. A Parent with no active link receives no Parent session; one active School enters directly and multiple active Schools receive only authorized chooser options.
- Use the API modular monolith as the sole owner of Prisma, migrations, PostgreSQL authorization, transitions, audit, and Operations. Relevant domain boundaries are `identity`, `schools`, `memberships`, `authorization`, `parents`, `parent-auth`, `operations`, and their narrow exports; controllers call only their owning service.
- Fixed hosts are `app.passionedu.org`, `teacher.passionedu.org`, `parent.passionedu.org`, `ops.passionedu.org`, and `api.passionedu.org`. Each audience has separate callback and origin allowlists, plus a host-only `Secure`, `httpOnly`, `SameSite=Lax` cookie; never share a `.passionedu.org` cookie. Clear protected memory/query state on logout, expiry, `401`, or revoke. Parent service workers must not cache authenticated responses, payment instructions, media, or evidence URLs.
- `SUPERADMIN_EMAIL` is an environment-only bootstrap for `PlatformOperatorGrant`; do not commit its value. Provision Operations are scoped to the PlatformOperatorGrant, route, and request fingerprint because a School does not yet exist. All other Operations scope School, route, actor type/reference, and when present actor identity; reads authorize the same actor context that created the Operation.
- Use PostgreSQL transactions for multi-record changes. Audit records retain School, actor identity/reference, membership when applicable, timestamp, provenance, and required reason. Operation outcomes and fingerprints are persisted atomically.
- Deploy the pilot from source with Compose, routed by a TLS proxy to separate app, teacher, parent, ops, and API containers. PostgreSQL requires durable storage; run migrations before an API version that requires them and reject destructive rollback.

## UX & Interaction Patterns

- Admin and Ops are desktop-first responsive PWAs; Teacher and Parent are mobile-first. Portals never switch audience within one shell. Navigation exposes only server-granted capabilities, selected School name is always visible, and each route change moves focus to the route `h1`.
- The School chooser/switcher must prevent an unsafe context change. On a dirty form or pending/uncertain mutation, offer only remain, discard before submission, or Operation reconciliation; never auto-save, silently switch, or allow a retry before reconciliation.
- Ops shows only School list, provisioning, and suspend/reactivate controls, never a School business-data destination. Provision failure keeps the form editable and reports no partial success. Suspend/reactivate dialogs name the School and current status, require confirmation, and on timeout disable duplicate action until the server-confirmed Operation and refreshed list return.
- On revocation or suspension, clear protected School state before showing a safe signed-out or alternative School chooser state. Do not substitute an unresolved error with empty or zero data.
- Keep operational copy concise and Vietnamese-first. Use text labels with every status, WCAG 2.1 AA contrast and visible focus, focusable error summaries linked to adjacent field errors, keyboard-accessible tables, and focus-trapped dialogs that return focus to their trigger.

## Cross-Story Dependencies

- Story 1.1 establishes the workspace, portal separation, API ownership, and deployment path required by every other Epic 1 story.
- Story 1.2 supplies the audience/session and Parent School-selection contract used by membership/context handling and all later Parent work.
- Story 1.3 depends on identity, membership, authorization, and Operations primitives to atomically bootstrap an owner and reconcile School lifecycle mutations.
- Stories 1.4 and 1.5 provide the authorization, tenant graph, audit, CSRF, and idempotency contracts that Story 1.6 must verify and that all later epics inherit.
- Epic 1 tenant-isolation proof gates Epics 2 through 11; later School-domain work must reuse these server-side context and Operation boundaries rather than introduce local authorization or retry behavior.
