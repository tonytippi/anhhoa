# Decision: Platform Operator impersonation

**Status:** Approved

**Date:** 2026-10-14

## Decision

A Platform Operator with an active `PlatformOperatorGrant` can open the Admin/Staff, Teacher or Parent portal as another user to reproduce a reported problem. Impersonation has the target user's full rights, including writes; it is not read-only.

## Contract

- Ops searches `UserIdentity` (`GET /api/ops/identities`) and starts an impersonation with a target, portal and reason of at least 5 characters (`POST /api/ops/impersonations`, cookie CSRF). Other active Platform Operators and the operator's own identity cannot be targets.
- Starting creates an `Impersonation` row and a single-use ticket valid for 1 minute. The target portal host exchanges it at `GET /api/:audience/auth/impersonate`, which sets that portal's host-only session and CSRF cookies; the ticket must match the audience, be unused and unexpired, and the grant must still be active.
- The impersonated session carries the `Impersonation` id and operator email, lasts at most 1 hour from start, and is re-checked on every API request: logout (the portal's "Kết thúc" action) or grant revocation ends it immediately with `401 IMPERSONATION_ENDED`.
- Every `Operation` and `AuditRecord` written during an impersonated request stores `impersonationId`, so writes remain attributable to the operator and reason while authorization still runs as the target user.
- Portals show a floating banner with the impersonated email, the operator and an end action; impersonated users are not stored as the browser's remembered sign-in account. No mockup: the banner floats so reviewed layouts are unchanged.

## Consequences

- The Ops statement "không truy cập dữ liệu nghiệp vụ của trường" now reads: access to School business data only through a recorded impersonation session.
- An impersonation replaces any existing session of that browser on the target portal.
