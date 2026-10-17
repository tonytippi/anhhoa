# Sprint change proposal 2026-10-17: Editable quantity for extracurricular classes in a collection run

Status: requested by the user on 2026-10-17. This changes the decision of 2026-10-02 §3.3 ("Quantity mặc định 1"). The default is still 1, but it can now be edited per run.

## Problem

Extracurricular receivables are often priced per session (for example 100.000 đ/buổi). The run always billed quantity 1, so each Student was billed for one session. The only workaround was editing every draft Invoice line by hand.

## Change

- In a DRAFT run, Finance sets a quantity for each extracurricular class (or service, in CLASS runs). The "Lớp ngoại khóa trong đợt" / "Dịch vụ trong đợt" table gets a "Số lượng / HS" column and a `Sửa số lượng` action that opens a modal.
- Storage: `CollectionRunExtracurricularQuantity(schoolId, collectionRunId, extracurricularClassId, quantity > 0)`. If there is no row, the quantity is 1, and setting it back to 1 deletes the row. A DB trigger allows writes only while the run is DRAFT and only for a class of the run's SchoolYear, the same rules as for exclusions.
- The mutation is `PUT .../collection-runs/:runId/extracurricular-classes/:classId/quantity` with `{ quantity, expectedVersion }`. It is idempotent with an Operation, bumps the run version, and writes the audit record `COLLECTION_RUN_EXTRACURRICULAR_QUANTITY_SET`.
- Billing: each Student gets one merged line per Receivable, with `quantity` taken from the class the Student is billed through (the earliest-starting class, as already used for preview attribution). The amount is `defaultUnitPrice × quantity`. The quantity is part of the preview fingerprint, so changing it makes READY stale. It is also stored in `extracurricularSnapshot`, so Students added after generation get the same quantity. Older snapshots without a quantity read as 1.
- Per-Student differences (joining mid-month, missed sessions) are still handled by editing the draft Invoice line.

## Mockup

There is no reviewed mockup for this action. It follows the existing modal pattern of the same table (`Loại khỏi đợt này`) and of the template-line quantity field.
