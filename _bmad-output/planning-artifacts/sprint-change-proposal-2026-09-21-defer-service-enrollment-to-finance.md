# Sprint Change Proposal: Chuyen service enrollment sang Finance catalog

**Ngay:** 2026-09-21

**Trigger:** Sau khi commit `5587b83` da chot short LeaveRequest, `LEAVE_REQUEST_DECIDE` va leave-day source, Story 4.5 van gom `StudentServiceEnrollment`. Epic 4 chua co service identity/catalog, nen persistence o day se buoc tao aggregate tam va tao hai nguon su that truoc khi Epic 5 co Receivable catalog.

## Decision

`StudentServiceEnrollment` chuyen sang Story 5.1, cung Finance catalog. Service enrollment phai tham chieu service/Receivable do Finance so huu; Finance quy dinh effective interval, cancel va overlap theo catalog. Enrollment la reference coverage, khong tu dong tinh gia hay tao Invoice.

Story 4.5 chi giu `LEAVE_REQUEST_DECIDE`, approve/reject leave `PENDING`, immutable approved-leave-day source va Admin/Finance review. `attendance` so huu source; Epic 5 map source sang Receivable va materialize adjustment DRAFT sau nay.

## Impact

- Epic 4 khong tao `StudentServiceEnrollment`, service catalog, service-cancel route hoac Finance behavior.
- Story 4.5 co the ready-for-development: chi can capability, leave decision, source projection, Admin review va test.
- Story 5.1 them `SchoolService`/service catalog va `StudentServiceEnrollment` School-scoped, effective-dated; Story 5.4 dung coverage nay de chan Saturday MANUAL charge trung.
- Parent van khong co service enrollment/cancel mutation.

## Acceptance Boundaries

- Service enrollment tham chieu service do Finance catalog so huu; khong dung free-form string hay aggregate service rieng o attendance.
- Leave source khong chua receivable, VND, Invoice, CollectionRun hay Finance target.
- `LEAVE_REQUEST_DECIDE` van la School-wide, class-independent Position capability va deny truoc lookup/write khi binding/Position/capability bi revoke.
- Finance van la owner duy nhat cua pricing, Invoice DRAFT adjustment va service-coverage validation khi charge.

## Approval Record

Approved by user on 2026-09-21: defer service enrollment implementation to Epic 5 and proceed with leave-only Story 4.5.
