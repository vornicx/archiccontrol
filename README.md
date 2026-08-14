# Archic Control

Internal operating system for Archic. The central metric is **Needs Vadim**: only decisions that genuinely require direction, risk acceptance or final approval cross the human boundary.

## Operational baseline

- Archic Quality Standard v1.0: 87 canonical delivery checks + blocking Polish pass;
- deterministic Quality Gate and promotion policy;
- real Archic Benchmark snapshot and scheduled ingestion;
- durable Postgres model for projects, runs, findings, decisions, integration events and audit history;
- owner authentication and decision resolution;
- signed GitHub webhook inbox;
- retry-budget reconciler;
- responsive Control interface;
- unit, build and Playwright coverage.

Milestone 2 adds the runtime required to close the loop:

- durable agent queue with atomic leases, ephemeral callback tokens, bounded retries and backoff;
- GitHub App repository dispatch plus semantic PR, check, workflow, push and deployment event processing;
- versioned Playwright journey contracts for all six audited projects;
- preview/deployment registry, smoke evidence and immutable final-approval boundary;
- production-readiness UI and fail-closed health signal;
- reusable project worker adapter under `templates/project`.

Read [the audit](docs/audit.md), [architecture](docs/architecture.md), [standard policy](docs/quality-standard-v1.md), [automation runtime](docs/automation-runtime.md) and [deployment guide](docs/deployment.md).

## Local start

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, development and tests use the checked-in real benchmark snapshot. Production fails closed without Postgres. The local access key is `archic-local`; production has no fallback.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run journeys:validate
npm run build
npm run test:e2e
```
