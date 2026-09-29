# Decision: Parent phone update contract

**Date:** 2026-09-27

## Decision

Parent may update only `ParentProfile.phone` through an active, School-authorized Parent context.

- `ParentProfile.phone` remains global. A successful update applies to all Schools linked to that ParentProfile.
- The mutation is authorized by the selected School's active StudentParent link. Its Operation and audit record are scoped to that authorized School context.
- Input is trimmed and must match `^[0-9+() .-]{6,30}$`. Story 7.5 does not canonicalize to E.164 or otherwise rewrite a valid user-entered phone value.
- `PATCH /api/parent/schools/:schoolId/profile/phone` accepts only `{ phone }`, uses Origin validation, double-submit CSRF, UUID `Idempotency-Key`, UUID operation ID and server reconciliation.
- The shared Parent operation endpoint remains `GET /api/parent/schools/:schoolId/operations/:operationId`; it is extended to reconcile Parent phone Operations with the same active-link re-authorization as leave Operations.
- A minimal Parent profile/contact sheet may contain only current phone, a phone field, save/cancel, accessible errors and reconciliation state. It does not expose email, Google identity, ParentStudent links, audit history or additional contact features.

## Rationale

The profile record is intentionally global, but every business mutation requires a currently authorized School context for tenant audit and authorization. Keeping the established phone format avoids silently changing contact data and makes audit old/new values transparent. Reusing the existing Parent Operation route prevents duplicate reconciliation boundaries.
