---
name: PassionEdu
description: Calm multi-school operations system for kindergartens, balancing reassuring Parent moments with clear financial and operational workspaces.
status: final
updated: 2026-09-05
sources:
  - ../../prds/prd-passionedu-2026-09-04/prd.md
  - ../../architecture/architecture-passionedu-2026-09-04/ARCHITECTURE-SPINE.md
colors:
  canvas: '#F7F8F3'
  surface: '#FFFFFF'
  surface-tint: '#EEF6F1'
  ink: '#18332D'
  muted-ink: '#5F746E'
  border: '#D7E2DC'
  primary: '#247A51'
  primary-foreground: '#FFFFFF'
  accent: '#F2B441'
  accent-foreground: '#3B2A08'
  info: '#2E83B9'
  success: '#247A51'
  warning: '#B87516'
  danger: '#BF4C4C'
  attendance-present: '#247A51'
  attendance-absent: '#BF4C4C'
  attendance-leave: '#2E83B9'
  attendance-not-recorded: '#687A75'
  focus-ring: '#145A3C'
  hover-surface: '#E3F0E9'
  disabled-surface: '#E8ECEA'
  disabled-ink: '#66746F'
  status-success-background: '#E4F3EA'
  status-success-foreground: '#155D3B'
  status-warning-background: '#FFF1D5'
  status-warning-foreground: '#80580F'
  status-danger-background: '#FCE8E8'
  status-danger-foreground: '#922E2E'
  status-info-background: '#E2F0F8'
  status-info-foreground: '#145A86'
typography:
  display:
    fontFamily: 'Be Vietnam Pro, sans-serif'
    fontSize: '28px'
    fontWeight: '700'
    lineHeight: '1.25'
  heading:
    fontFamily: 'Be Vietnam Pro, sans-serif'
    fontSize: '20px'
    fontWeight: '700'
    lineHeight: '1.35'
  body:
    fontFamily: 'Inter, sans-serif'
    fontSize: '15px'
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: 'Inter, sans-serif'
    fontSize: '13px'
    fontWeight: '600'
    lineHeight: '1.35'
  numeric:
    fontFamily: 'Inter, sans-serif'
    fontSize: '15px'
    fontWeight: '700'
    lineHeight: '1.35'
rounded:
  sm: '8px'
  md: '12px'
  lg: '18px'
  xl: '24px'
  full: '9999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '5': '20px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  gutter-desktop: '32px'
  gutter-mobile: '16px'
components:
  button-primary:
    background: '{colors.primary}'
    foreground: '{colors.primary-foreground}'
    radius: '{rounded.md}'
  school-context:
    background: '{colors.surface-tint}'
    foreground: '{colors.ink}'
    radius: '{rounded.full}'
  status-badge:
    radius: '{rounded.full}'
    font: '{typography.label}'
  today-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.lg}'
  queue-card:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  finance-summary:
    background: '{colors.surface-tint}'
    radius: '{rounded.md}'
  illustration-panel:
    background: '{colors.surface-tint}'
    radius: '{rounded.xl}'
  input-control:
    border: '{colors.border}'
    radius: '{rounded.sm}'
  dialog:
    background: '{colors.surface}'
    radius: '{rounded.lg}'
  data-table:
    border: '{colors.border}'
  notification-item:
    background: '{colors.surface}'
    radius: '{rounded.md}'
  review-stepper:
    background: '{colors.surface-tint}'
    radius: '{rounded.full}'
  settlement-control:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.md}'
  attendance-control:
    background: '{colors.surface}'
    border: '{colors.border}'
    radius: '{rounded.md}'
---

## Brand & Style

PassionEdu is calm and trustworthy around children, while remaining exact around attendance, permissions and money. Platform identity is neutral; selected School identity may appear as name, logo and restrained accent, never as a replacement for visible School context. Parent welcome and empty states may use gentle original kindergarten illustrations. Operational controls, finance tables and destructive actions stay sober and legible.

## Colors

{colors.canvas} is the quiet workspace background; {colors.surface} carries actionable content. {colors.primary} is the sole primary action color. {colors.accent} is reserved for a welcoming illustration detail or a single current-day emphasis, never financial status. Attendance state uses text plus its semantic color: {colors.attendance-present}, {colors.attendance-absent}, {colors.attendance-leave}, and {colors.attendance-not-recorded}. {colors.danger} is for destructive or blocking action, never the default attendance label.

All text/background and focus combinations meet WCAG 2.1 AA. Color never supplies a state without an adjacent text label.

## Typography

{typography.display} is limited to welcome, screen titles and empty-state headlines. {typography.body} is the reading default. Finance amounts use {typography.numeric}, right-aligned and formatted as whole VND. Do not use playful display type in tables, forms, dialogs or state badges.

## Layout & Spacing

Admin/Staff and Ops use a desktop-first shell with a persistent sidebar at `>= 1024px`, content gutter {spacing.gutter-desktop}, and responsive stacked cards below that width. Parent is mobile-first with {spacing.gutter-mobile}, single-column sections and a maximum reading width of 640px. Tables retain horizontal scroll with sticky identifying columns on small viewports; never compress money or status into unreadable columns.

## Elevation & Depth

Surfaces use borders first and a soft shadow only for raised dialogs, sheets and hoverable cards. The interface does not stack decorative cards or use floating gradients. Modals are one level deep.

## Shapes

Use {rounded.md} for inputs, buttons and operational cards; {rounded.lg} for Parent today cards and major summaries; {rounded.full} only for badges, context pills and compact filters. Avoid bubbly shape language inside finance or permission controls.

## Components

- **School context switcher** — `{components.school-context}` with School name always visible; logo is optional and never the sole identifier.
- **Queue card** — `{components.queue-card}` shows a text count, one-line explanation and direct filtered destination; warning color cannot replace the count/label.
- **Today card** — `{components.today-card}` shows child display name, today's date, text attendance status and update time; uses no evidence image.
- **Attendance badge** — `{components.status-badge}` includes full text and semantic color. `NOT_RECORDED` uses muted neutral styling, never red.
- **Finance summary** — `{components.finance-summary}` holds server-returned VND amount, label and as-of context; no client-computed total is styled as authoritative.
- **Operation dialog** — neutral progress state while reconciliation runs; successful, skipped and failed records use explicit text lists.
- **Input control** — `{components.input-control}` has visible focus, label, help and inline error space; error is never conveyed by border color alone.
- **Dialog** — `{components.dialog}` carries a named title, purpose, summary of affected records/amounts and explicit safe/danger actions.
- **Data table** — `{components.data-table}` uses caption, column headers, row focus and a horizontal-scroll treatment below desktop width.
- **Notification item** — `{components.notification-item}` shows School context, child display name, text event, time and unread state in addition to color.
- **Review stepper** — `{components.review-stepper}` renders numbered workflow stages with text current/completed/blocked state; inactive stage is not an affordance unless navigation is permitted.
- **Settlement control** — `{components.settlement-control}` has immutable source facts above editable allocation/refund fields, server-returned available amount and explicit pending/approved/posted/refused states.
- **Attendance control** — `{components.attendance-control}` presents text status, policy-required evidence state, disabled/permission state, conflict explanation and server-confirmed update time.

Interactive controls use `{colors.focus-ring}` as a visible 3px focus ring on `{colors.surface}` and `{colors.canvas}`. Hover uses `{colors.hover-surface}` only with the same text label. Disabled controls use `{colors.disabled-surface}` and `{colors.disabled-ink}`, retain semantic disabled state, and do not become the only way to explain unavailable action. Status pairs are fixed: success `{colors.status-success-background}` / `{colors.status-success-foreground}`, warning `{colors.status-warning-background}` / `{colors.status-warning-foreground}`, danger `{colors.status-danger-background}` / `{colors.status-danger-foreground}`, info `{colors.status-info-background}` / `{colors.status-info-foreground}`. All normal text pairs, including `{colors.primary}` with `{colors.primary-foreground}`, meet 4.5:1; focus indicators meet 3:1 against adjacent surface.
- **Illustration panel** — `{components.illustration-panel}` contains original, non-identifying child/school imagery only for Parent welcome, empty or signed-out surfaces.

## Do's and Don'ts

| Do | Don't |
| --- | --- |
| Show selected School and date in every operational heading | Treat a remembered selection as sufficient context |
| Use gentle illustration for Parent welcome and empty states | Put childlike art inside finance tables or dangerous confirmations |
| Pair every status color with a full Vietnamese label | Use red or an icon alone to mean absence or error |
| Keep interactive foreground/background at WCAG AA text contrast | Use `{colors.primary}` as small text on white without checking contrast |
| Format VND whole amounts with clear hierarchy | Make client-estimated totals look authoritative |
| Keep Parent cards focused on one child/date action | Expose class lists, Staff identity or evidence media |
