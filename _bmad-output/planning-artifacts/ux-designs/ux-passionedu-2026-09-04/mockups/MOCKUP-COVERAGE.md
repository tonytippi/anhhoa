# PassionEdu Mockup Coverage

Mo `review.html` trong trinh duyet de bat dau review. Cac prototype la HTML tinh co tuong tac dialog mo phong; khong gui request hay luu du lieu. `DESIGN.md` va `EXPERIENCE.md` van uu tien neu co xung dot.

| Portal | File | Surface duoc mo phong |
| --- | --- | --- |
| Review index | `review.html` | Entry point va huong dan review toan bo flow. |
| Admin / Staff | `admin-staff.html` | Tong quan operational queue; Danh bo va roster transition; Cau hinh typed/versioned; Khoan thu; CollectionRun preview/generate; Receipt, allocation, debt, correction/refund; Report; Attendance; Leave; Handover. |
| Parent | `parent.html` | Parent home; Today cards; Child attendance history; Parent leave request; Payment instruction snapshot; Inbox va revoke-safe state. |
| Ops | `ops.html` | School list; provision/owner bootstrap; suspend/reactivate; Operation reconciliation/failure state. |

## Cross-surface states

- School switch guard va dirty/uncertain mutation context.
- Idempotent Operation reconciliation sau timeout.
- Server-authoritative preview, lifecycle lock, skipped result va finance amount.
- Field/policy conflict, permission/revoke-safe state va Parent data minimization.
- Required attendance evidence, leave conflict va no automatic late-pickup fee.
- Exact settlement, explicit Prepayment, two-step correction/refund context.

## Existing Anchor Mocks

Bo mock cu van duoc giu de truy vet cac key screens ban dau:

- `admin-operational-queue.html`
- `finance-run-preview.html`
- `parent-home.html`
- `parent-inbox.html`
