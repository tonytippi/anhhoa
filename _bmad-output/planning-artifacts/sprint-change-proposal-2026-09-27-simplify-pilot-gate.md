# Sprint Change Proposal: Simplify Pilot Gate

**Date:** 2026-09-27
**Status:** Approved direction - awaiting canonical backlog update
**Scope:** Epic 7, Story 7.8

## Issue Summary

Story 7.8 was expanded into a full pilot certification system: external benchmark reporting, pilot TLS topology metadata, central automated accessibility scans and mandatory external manual screen-reader attestation. This is unnecessary for the current objective of confirming implemented functionality before a real pilot deployment; deployment monitoring and operational verification are handled outside this repository.

Story 7.7 already supplies the necessary Parent security/PWA release evidence: isolated PostgreSQL integration, cross-School/revoke/retention checks, real Parent PWA cache/offline proof and mobile accessibility baseline.

## Impact Analysis

- Epic 7 remains functionally complete through Story 7.7; Story 7.8 should not block functional review of the Parent Portal.
- The current uncommitted Story 7.8 runner/harness work must be removed; no benchmark or certification infrastructure is retained in this repository.
- No Parent domain API, persistence, authorization, finance or portal feature is changed by this proposal.
- Canonical NFR performance/WCAG requirements remain valid future release requirements; this proposal changes their immediate implementation gate, not product requirements.

## Recommended Approach

Replace the current Story 7.8 implementation target with a minimal pilot smoke-deployment checklist:

1. Deploy the existing Docker Compose/TLS topology using the approved migration-first procedure.
2. Verify the four portal origins and API health endpoint respond through the deployed proxy.
3. Run existing `pnpm test:release-gate` and `pnpm test:parent-release-gate` before deployment using `.env.test`.
4. Perform a concise human smoke pass in the deployed environment:
   - Admin: sign in, select School, open Finance report.
   - Teacher: sign in, select School, open attendance workspace.
   - Parent: sign in, select School, open Today, Inbox and Obligations.
   - Ops: sign in and open School lifecycle list.
5. Record deployment commit, environment URL, migration outcome and smoke-pass result in the deployment system already operated outside this repository.

## Proposed Backlog Changes

**Story 7.8: Pilot performance và accessibility release gate**

OLD:

```text
Fixture-based performance va WCAG verification cho ca bon portal truoc pilot.
P95 read API <=500 ms, preview/report <=3 s, generate 200 Student <=30 giay,
plus formal WCAG 2.1 AA automated/manual verification for four portals.
```

NEW IMPLEMENTATION TARGET:

```text
Pilot smoke deployment verification for the four portals after migration-first Docker Compose/TLS deployment.
Existing security/PWA release gates must pass before deploy. The deployed environment must complete
the four role-specific smoke flows and record commit, migration and smoke outcome in the external
deployment system. No benchmark, formal accessibility certification or evidence harness is retained
in this repository.
```

Rationale: confirms real deployment and core function without claiming pilot SLO or formal WCAG certification that requires a dedicated operational environment and review process.

## Implementation Handoff

**Classification:** Moderate, because it defers a planned release-evidence gate and changes the completion criteria for Story 7.8.

Before implementation:

- Update the canonical epic/backlog through the appropriate planning workflow; do not edit the `final` epic artifact directly.
- Remove current uncommitted Story 7.8 benchmark/accessibility harness work.

## Success Criteria

- Parent functionality remains represented by completed Stories 7.1–7.7.
- Pilot deployment can be verified by a short, reproducible smoke checklist.
- No local timing or incomplete manual check is represented as a production SLO/WCAG certification.
- Deployment monitoring and production verification remain owned by the external operational system.
