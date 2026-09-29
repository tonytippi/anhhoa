# Decision: Home-only School chooser

**Status:** Approved

**Date:** 2026-09-29

## Decision

Admin and Teacher users choose an authorized School only from their portal Home. A School-scoped page displays its active School as read-only context and provides an explicit action to return Home before choosing another School. Authorized direct School URLs remain valid selectors and always require API reauthorization.

## Consequences

- Remove mutable in-page Admin/Teacher School selectors and the switch-specific guard.
- Guard leaving any scoped workspace when local input is dirty or an Operation is pending/uncertain; do not silently discard input or retry an uncertain mutation.
- Keep Parent multi-School chooser behavior unchanged.
- Keep all API authorization, School-scoped query/write, audit and Operation contracts unchanged.
- Revoke, suspend or denied deep links clear protected state and return to the safe Home chooser or signed-out state.

## Evidence

The prior in-page switcher introduced a broad context-transition state machine despite rare multi-School Staff usage and caused release-gate races around navigation/focus. Stakeholder direction is to complete work in one School and return Home before another selection.

## Source

`_bmad-output/planning-artifacts/sprint-change-proposal-2026-09-29-home-only-school-chooser.md`
