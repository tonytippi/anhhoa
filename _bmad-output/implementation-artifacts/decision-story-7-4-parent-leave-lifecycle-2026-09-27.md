# Decision: Parent leave pending edit and cancellation

**Date:** 2026-09-27

## Decision

Parent leave requests support an append-only terminal `CANCELLED` lifecycle state.

- Only a request in `PENDING` may be edited or cancelled by its originating ParentProfile.
- Cancellation retains the LeaveRequest, operating-date snapshots and audit history. It never hard-deletes or reuses `REJECTED`.
- A Parent edit remains `PENDING`; it never auto-approves a request, even if a freshly evaluated policy deadline would otherwise permit auto approval.
- Edit revalidates active ParentStudent link, active School, current School calendar/policy, enrollment, operating dates and confirmed `PRESENT` conflicts. Calendar/policy/date snapshots are replaced with the server result at edit time.
- Create and edit both reject a date with confirmed attendance `PRESENT`.
- Pending create/edit/cancel do not issue LeaveDaySource, Finance adjustment, service mutation, enrollment change or long-leave/preservation effect.

## UX Decision

`mockups/parent/parent.html` section `Đơn xin nghỉ` is the reviewed interaction contract for Story 7.4: child-detail create action, pending card, edit/cancel controls and confirmation. The current mobile Parent shell remains unchanged; no Contact or other `parent-home.html` surface is added.

## Rationale

The Parent can withdraw a pending notification without erasing an operational record. Keeping edit pending prevents a Parent-side mutation from silently changing an internal approval outcome. Revalidation and immutable history preserve calendar and attendance authority on the API.
