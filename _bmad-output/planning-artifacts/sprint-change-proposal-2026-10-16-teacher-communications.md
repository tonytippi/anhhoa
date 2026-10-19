# Sprint change proposal 2026-10-16: Teacher portal communications and reviewed-mockup UI

Status: approved by the user on 2026-10-16. No mockup was reviewed for the two new features. The user asked that they extend the visual language of `mockups/teacher/teacher.html` and `mockups/parent/*`.

## 1. Class note: a whole-Class comment for the day

- A Teacher assigned to the Class writes one `ClassDailyNote` per Class and day, with text up to 5000 characters and optional images.
- Every Parent whose Student sits in that Class on that day sees it. It appears as the card "Bản tin lớp {Class}" next to the per-Student DailyJournal on the Parent "Hôm nay" view.
- Rules are the same as DailyJournal: `DAILY_JOURNAL_WRITE` capability, the `dailyJournal` School feature, the current operating day only, and the DailyJournal policy limits on image MIME type, size and count.
- Saving uses an `Operation` with an `Idempotency-Key` and writes an audit record (`CLASS_NOTE_SAVED`, `CLASS_NOTE_MEDIA_UPLOADED`). The note keeps a version counter; history is kept in the audit records.
- In the Teacher UI, "Nhận xét trong ngày" has a pinned first row "Cả lớp · Nhận xét chung". It opens in the same editor panel as a Student journal.

## 2. Teacher–Parent messaging per Student

- There is one conversation per Student (`StudentMessage`). It is shared by all Teachers assigned to the Student's Class today and by all Parents with an active link to the Student.
- New capability `PARENT_MESSAGE_WRITE` ("Nhắn tin phụ huynh") in the "Vận hành lớp" group. A migration grants it to every position that already holds `ATTENDANCE_WRITE` or `DAILY_JOURNAL_WRITE`.
- Parents send only while the Student has a current Class.
- Sending is an idempotent Operation with an audit record (`STUDENT_MESSAGE_SENT`). Reconciliation uses the existing `GET .../operations/:operationId` route on both audiences.
- Read state is tracked separately for each Teacher (StaffProfile) and each Parent (`StudentMessageRead`). Unread counts only count messages from the other party.
- Parent DTO is kept to the minimum: Teacher messages show only "Giáo viên lớp {Class}", never the staff identity.
- Delivery is by polling every 30 s while the view is visible. There are no push notifications in this change.

## 3. Teacher portal rebuilt on the reviewed mockup

- The shell, sidebar, topbar, "Lớp hôm nay", "Hàng đợi lớp" and "Nhận xét trong ngày" follow `teacher.html`. "Tin nhắn phụ huynh" is added as a new route.
- The Class is picked from `GET /api/teacher/schools/:schoolId/classes`, which lists the Teacher's effective assignments. This replaces the free-text "Mã lớp".
- Differences from the mockup:
  - The handover dialog asks for pickup time and photo instead of "Người đón", because the API has no guardian-name field.
  - On phones (≤640 px), tables turn into stacked cards.
  - The Class picker only appears when the Teacher has more than one Class.
- PWA: the manifest gets icons (SVG, 192/512 PNG, maskable, apple-touch-icon), a theme colour, and iOS standalone meta tags. The service worker still caches only the app shell.

## 4. Addendum 2026-10-19: inbox events and Web Push

Approved by the user on 2026-10-19.

- **Parent inbox.** `NotificationSourceType` gains `CLASS_NOTE` and `MESSAGE`.
  - A class note creates one inbox event per Student in the Class, and only on its first publication of the day; later edits update the card silently.
  - Every teacher message creates one event. Opening the conversation marks its message events read.
  - Event text carries only the Class label and the Student name snapshot. The message body is never included.
- **Web Push.** This is a new delivery channel. It amends AD-15's "in-app only" wording; there is still no SMS, email or Zalo delivery.
  - `NotificationSourceEvent` and Parent-sent `StudentMessage` rows work as an outbox. A dispatcher in the API claims them every 5 s with `FOR UPDATE SKIP LOCKED` and resolves recipients at delivery time:
    - **Parents:** those with an active StudentParent link.
    - **Teachers:** those with a current Class assignment and `PARENT_MESSAGE_WRITE`.
  - Events older than 6 h are not pushed. Events that existed before the migration are never pushed.
  - Push text matches the inbox text and never contains message bodies, evidence or staff identity.
- **Subscriptions.** `PushSubscription` is stored per browser endpoint and portal (`PARENT`, `TEACHER`).
  - Endpoints are restricted to the browser push services (FCM, Apple, Mozilla, Windows).
  - Logout removes the device subscription. Impersonated sessions can neither see nor create a subscription.
  - The feature is disabled until `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are configured.
- **Platform reach.** Android and desktop browsers receive push whether or not the app is installed. iOS/iPadOS 16.4+ receives push only for the installed Home Screen PWA, so the Safari tab shows install guidance instead of the opt-in button.
