# Epic 6 Context: Phu huynh dang nhap va xem Hoa don can thanh toan

<!-- Generated from planning artifacts. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Deliver a separate, mobile-first Parent PWA in which an authorized parent can securely sign in with Google, immediately see pending invoices for one or more authorized students, and read invoice details and completed-invoice history. This epic establishes a strictly read-only, authorization-safe portal so parents can understand what is due without receiving Admin data, accessing another student's records, or changing any invoice.

## Stories

- Story 6.1: Khoi tao Parent PWA va Parent Google session
- Story 6.2: Cung cap Parent REST read model
- Story 6.3: Home hien thi Hoa don can thanh toan cua nhieu con
- Story 6.4: Chi tiet Hoa don va lich su thanh toan read-only

## Requirements & Constraints

- Only a Google identity with a verified email, an active Parent record, a matching bound Google subject, and at least one active Parent-student link may receive a Parent session. Invalid OAuth state, provider failures, unassigned email, changed subject, inactive Parent, or no active link must produce a safe denial with no partial session or protected data.
- On every Parent request, authorize the session's active Parent and the current active Parent-student link. Client UUIDs, filters, routes, and previously seen invoice URLs are never proof of access. Do not expose whether unauthorized students or invoices exist.
- Return only authorized `PENDING` and `COMPLETED` invoices. Never expose `DRAFT`, Admin audit fields, other parents, mutable bank-account source data, payment payloads, or mutation controls. Invoice detail is read-only and contains only the student snapshot, billing month, fee lines, VND total, method, and status needed by Parent.
- Invoice lists must use bounded pagination, stable sorting, server-validated filters, and `{ data, meta }` responses. Supported filters are authorized student, billing month, and valid status.
- Protected state is memory-only: do not cache Parent REST responses or payment snapshots in the service worker. Clear protected React Query/client state before routing to login on logout, expiry, or `401`. Revalidate on app foreground, browser focus, and before a protected view.
- A revoke for one student removes that student's cards, filters, details, and open payment state while retaining the session and remaining active students. Route to login only when the session is invalid or no active links remain.
- Home prioritizes `PENDING` invoices; History contains only `COMPLETED`. Pending cash invoices show the cash-at-school guidance and no transfer action. Transfer payment CTA, payment eligibility, QR, and payment sheet behavior belong to Epic 7 and must not block this epic.
- Verify login denial and success, multi-student authorization, direct-UUID and filter denial, revoked links, `DRAFT` exclusion, pagination/sort/filter contracts, response minimization, protected-state clearing, and Home/History flows with API unit/PostgreSQL integration tests and Parent PWA Playwright coverage.

## Technical Decisions

- Add `apps/parent-web` as an independent React/Vite PWA with its own router, manifest, icons, service worker, REST client, and React Query cache. It must not import `apps/web`, reuse Admin browser state/session/router/service worker, or call Admin business endpoints. It may share only pure contracts or utilities from `packages`.
- Keep server authority in `apps/api`. `parent-auth` owns Parent Google OAuth and Parent sessions; `parent-portal` owns authorized read DTOs; `parents` owns Parent and Parent-student lifecycle. Portal services may use Prisma and narrowly exported query services, never controllers or invoice lifecycle writes.
- Namespace Parent REST under `/api/parent`: `/me` bootstraps minimal identity, `/students` returns currently authorized students, `/invoices` returns the filtered list, and `/invoices/:invoiceId` returns the minimal detail DTO. Use the existing REST JSON, DTO validation, common error envelope, UUID, `YYYY-MM`, UTC, and VND `BIGINT` boundary conventions.
- Parent OAuth has its own configured origin, callback, and cookie. State must be cryptographically random, browser/callback-bound, single-use, and expiring. Issue only a distinct `Secure`, `httpOnly`, `SameSite=Lax` Parent cookie after all identity and authorization checks; never accept it as an Admin session. Validate Parent origin, OAuth callback allowlist, cookie name, and cookie scope configuration at API bootstrap rather than starting with insecure defaults.
- Parent query keys begin with `parent`; treat `401` as an authorization-state transition rather than a retryable query failure. Parent read routes must check current authorization server-side even after a client-side revalidation succeeds.

## UX & Interaction Patterns

- Use the Parent visual system: warm cream surface, white cards, Inter body text, Clash Grotesk headings, 20px mobile gutter, single-column layout, 44x44px minimum targets, labeled blue `Can thanh toan` pending status, and labeled green `Da hoan tat` completed status. Avoid KPI dashboards, tables, carousels, sidebars, and marketing treatment.
- After successful login, open `Trang chu` with the sole `h1` `Hoa don can thanh toan`; show pending invoices in the first visible area. For two or more students, show a horizontally scrollable switcher with `Tat ca` selected by default. In all-student mode, every card/row still names its student.
- Home renders only student groups with pending invoices. Order groups by their newest pending invoice, breaking ties by student name; order each group's cards by newest billing month. A fully touch- and keyboard-activatable card opens read-only detail. When no pending invoices match, show `Khong con Hoa don can thanh toan` with a secondary History link and no placeholder cards.
- Detail shows the student snapshot, month, fee lines, VND total, payment method, and textual status. Cash invoices say `Thanh toan tien mat tai nha truong`; completed invoices have no payment CTA. History is a bottom-navigation tab containing only completed rows, pagination, and authorized student/month filters synchronized with URL query state.
- Use card/chip/row skeletons for initial load, preserve readable data with a small refresh indicator, and show one explicit offline banner without queuing actions or presenting cached data as fresh. Every route needs one `h1`, readable VND amounts, textual status, and accessible navigation. On `401` or denied revalidation, close protected detail and clear state before showing login; on single-student revoke, remove only that student's UI and refresh the switcher.

## Cross-Story Dependencies

- Epic 5 must provide retained Parent-student links and server-side active-link authorization before Parent OAuth and portal endpoints can be safe. In particular, Stories 5.2 and 5.3 precede this epic's authentication and read surface.
- Story 6.1 provides the independent Parent application and `/me` session bootstrap. Story 6.2 extends the read model with `/students`, `/invoices`, and invoice detail; Stories 6.3 and 6.4 start only after Story 6.2.
- Epic 7 depends on the read model from Story 6.2 and may integrate payment UI after Home and detail exist, but Epic 6 must remain usable without payment snapshot, QR, download, or bank deep-link support.
