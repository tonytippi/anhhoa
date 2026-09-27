# Decision: Parent PWA release gate scope

**Date:** 2026-09-27

## Story 7.7 Scope

Story 7.7 is the Parent-only security, retention, PWA and accessible-mobile release gate.

- It proves Parent cross-School/cross-child authorization, per-request re-authorization, link revoke/expiry, operational and Finance retention, finance DTO redaction and forbidden finance mutations.
- It proves Parent PWA does not cache authenticated session/API/media/payment/evidence data, does not queue offline mutation and clears protected state on denial/revoke/offline fallback.
- It provides the Parent mobile accessibility baseline: single route `h1`, keyboard route focus/error focus, visible input focus, text status, 44px interactive targets, no-hover operation and leave confirmation dialog focus trap/Escape/focus return.
- It creates a Parent-specific release runner that builds/runs the Parent PWA and performs browser/cache/security proof instead of relying only on Parent cases inside the Admin E2E project.

## Story 7.8 Boundary

Story 7.8 remains the four-portal pilot gate: formal WCAG 2.1 AA automated/manual verification and pilot-topology performance benchmarks. Story 7.7 does not block on cross-portal performance or formal all-portal sign-off.

## Mobile Navigation

Story 7.7 adds the reviewed Parent mobile bottom navigation: `Hôm nay`, `Thông báo`, `Khoản cần thanh toán`, `Liên hệ`.

- `Liên hệ` opens only the existing phone contact sheet; it does not introduce a messaging or contact feature.
- All navigation uses existing server-authorized views and protected-state clearing.

## Dialog Baseline

Parent confirmation dialogs provide focus trap, Escape close while no mutation is pending, focus return to the originating trigger and 44px controls. This is a Parent baseline release condition, not the formal all-portal WCAG sign-off reserved for Story 7.8.
