---
name: Editable current and upcoming School settings
status: approved
date: 2026-09-30
trigger: Review of the Admin `Cấu hình trường` page. Append-only settings versions made a same-day correction impossible ("Đã có phiên bản tại ngày hiệu lực này") and holidays could only be added. The School operator confirmed that correcting input and adjusting holidays close to the date are normal operations in Vietnam.
mode: batch
---

# Sprint Change Proposal - Editable current and upcoming School settings

## 1. Issue summary

School settings (`SchoolProfileVersion`, `SchoolCalendarVersion` + holidays, `FinancePolicy`, `AttendancePolicy`, `HandoverPolicy`, `DailyJournalPolicy`) are append-only by database trigger and unique per School effective date. In practice:

- a typo saved today cannot be fixed today; the operator must pick another effective date;
- a holiday cannot be edited or removed, although holidays are often announced or changed shortly before they happen;
- the mockup profile form has no effective date, but the API requires one to avoid the collision.

Stakeholder decision (2026-09-30): most settings should be editable/deletable as normal operation, as long as audit is kept.

## 2. Decision

**Past is immutable; today and the future are editable, with audit.**

| Setting | New behaviour |
| --- | --- |
| Hồ sơ trường | Always effective from the School business date. Saving again on the same day updates that day's version. Adds optional `supportEmail`. |
| Kỳ nghỉ | Add, edit and delete holidays. Changes apply to the latest calendar version: updated in place when it is effective today or later and not yet referenced by a leave day or promotion coverage snapshot; otherwise a new version is created from the School business date (or the day after the latest version). A holiday that already ended cannot be edited or deleted. |
| Finance / evidence / DailyJournal policy | Saving a version with an effective date that already exists updates it when that date is today or later. Versions with a future effective date can be deleted. Versions effective before today stay read-only. |
| Tài khoản nhận tiền | Unchanged exception: identity is immutable; correct by `Ngừng dùng` + add a new account. Issued invoices keep bank snapshots. |

Every update/delete writes an audit record with `oldValue` and `newValue` and runs through the existing idempotent Operation flow.

### Invariants preserved

1. Rows effective before the School business date (`Asia/Ho_Chi_Minh`) cannot be updated or deleted; the database trigger now enforces this instead of blanket append-only.
2. Calendar versions referenced by `LeaveRequestDay`, `InvoicePromotionCoverageFact` or `StudentPromotionalCoverage` keep their holidays; the database rejects holiday changes on them.
3. Invoice financial snapshots, bank snapshots and ledger rows are untouched.
4. Tenant scoping, `SETTINGS_MANAGE` authorization, Operation reconciliation and audit are unchanged.

## 3. Impact

| Area | Impact |
| --- | --- |
| UX `EXPERIENCE.md` (final) | The "Add a named inclusive holiday range only" row is superseded by this proposal: holidays can be added, edited and deleted from today onwards. Profile has no effective-date field. |
| Mockup `admin/school-settings.html` | Holiday table gains `Tùy chọn` → `Sửa` / `Xóa`; profile gains `Email hỗ trợ`, no date. Logo/banner upload and finance-policy impact preview remain backlog. |
| Admin navigation | Settings item label becomes `Cấu hình chung` (page title stays `Cấu hình trường`). |
| API | New holiday endpoints; same-date upsert for profile and policies; delete for future policy versions; `supportEmail`. |
| Database | Migration replaces append-only triggers on settings tables with a "not before business date" guard, and adds `SchoolProfileVersion.supportEmail`. |
| Tests | Integration tests cover same-day update, future delete, past immutability and referenced-calendar protection. |

## 4. Backlog (not in this change)

- Logo and banner upload for Hồ sơ trường.
- Finance policy impact preview (`Kiểm tra đề xuất`).
- Bank account filter/sort/page in URL.
