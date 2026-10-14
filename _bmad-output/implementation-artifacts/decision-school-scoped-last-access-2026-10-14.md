# Decision: School-scoped "Truy cập gần nhất" in Admin lists

**Status:** Approved

**Date:** 2026-10-14

## Decision

The Admin staff list (Nhân sự) and parent list (Phụ huynh) gain a "Truy cập gần nhất" column before the row actions, so a School can see who has used the portals recently and who has not. The value is School-scoped: it is the last time that person used *this* School's portal data, never their activity in another School.

## Contract

- `SchoolUserAccess(schoolId, userIdentityId, lastSeenAt)` is upserted when an authenticated request targets `/api/{app|teacher|parent}/schools/:schoolId/...`, only if the identity is an ACTIVE `SchoolMembership` (app/teacher) or an ACTIVE `StudentParent` link of a bound `ParentProfile` (parent) of that School. Writes are throttled to once per 15 minutes per process; impersonated sessions never write.
- Staff and parent list DTOs add `lastSeenAt` (ISO or null). Staff without a login binding show "Chưa có quyền đăng nhập"; others with no record show "Chưa truy cập".
- Display uses Vietnam calendar days: "Hôm nay", "Hôm qua", "N ngày trước", with the exact time beneath.
- Existing data is backfilled from each identity's latest School-scoped Operation/AuditRecord (Platform Operator actions excluded); read-only use before 2026-10-14 was never recorded.

## Consequences

Mockup deviation approved by the stakeholder on 2026-10-14: one added column in two reviewed tables; layout, interaction and visual language otherwise unchanged.
