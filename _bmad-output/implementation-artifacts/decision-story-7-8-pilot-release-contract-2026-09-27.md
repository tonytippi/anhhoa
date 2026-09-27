# Decision: Pilot performance and all-portal accessibility gate

**Date:** 2026-09-27

## Performance Evidence

Story 7.8 uses a runner-side HTTP benchmark, not a production telemetry stack.

- Each run writes JSON and Markdown evidence outside source control with commit, fixture version, environment/topology, warm-up, samples, concurrency, P50/P95/max, thresholds and failure details.
- `local` mode is a regression harness only and cannot attest pilot SLO compliance.
- `pilot` mode requires `PILOT_BENCHMARK_BASE_URL` and runs against the deployed Docker Compose/TLS proxy topology. Missing environment metadata or report makes the pilot gate fail.
- Benchmark protocol: 30 warm-up requests, 100 measured requests, concurrency 5. Only 2xx samples enter percentile; any non-2xx/network failure fails its scenario.
- Scenarios: Parent context/obligation, Admin finance report, Teacher roster/queue, Ops School list, CollectionRun preview, four Finance report workspaces and generate 200 Student with observable Operation progress.
- Thresholds: P95 read <=500 ms; preview/report <=3 s; generate 200 <=30 s.

## Accessibility Evidence

- Add `@axe-core/playwright` and a central all-portal runner using the existing four-portal Playwright topology.
- Serious or critical axe finding fails release. Runner additionally asserts one route h1, named navigation, route/dialog focus, table semantics, responsive behavior and Parent 44px targets.
- A versioned manual checklist template lives in source. Completed manual evidence does not: pilot gate requires `PILOT_MANUAL_A11Y_EVIDENCE` to point to a validated CI/release artifact containing commit, reviewer, timestamp, browser/OS, screen-reader version and keyboard route/dialog/table evidence for all four portals.

## Release Command

`pnpm test:pilot-release-gate` runs build/typecheck, isolated API fixture/integration, central all-portal automated accessibility, Parent PWA gate, performance benchmark and manual-attestation validation. It fails if any component is missing or blocked. Story 7.7 Parent gate remains independent.
