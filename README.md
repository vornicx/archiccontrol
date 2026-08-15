# Archic Control

Internal operating system for Archic. The central metric is **Needs Vadim**: only decisions that genuinely require direction, risk acceptance, commercial judgment or final approval cross the human boundary.

The Control interface is intentionally owner-only by deployment convention and no longer has an application login. Machine-to-machine surfaces remain protected independently with signed webhooks, bearer secrets and scoped provider credentials.

## Operating loop

Archic Control now covers both sides of the business:

**Commercial:** business discovery → operating-status verification → scoring → deep research → one daily prototype → GitHub repository → Vercel deployment → price + outreach recommendation → Vadim review.

**Delivery:** project brief → development → QA → Playwright → benchmark → autofix → preview → human approval → production → smoke tests → monitoring.

## Operational baseline

- Archic Quality Standard v1.0: canonical delivery checks + blocking Polish pass;
- deterministic Quality Gate and promotion policy;
- real Archic Benchmark snapshot and scheduled ingestion;
- durable Postgres model for projects, runs, findings, decisions, prospects, integration events and audit history;
- daily commercial prospecting with conservative operating-status evidence rules;
- signed GitHub webhook inbox;
- GitHub repository publishing for selected daily prototypes;
- Vercel project/deployment publishing for selected daily prototypes;
- retry-budget reconciler;
- responsive Control interface;
- unit, build and Playwright coverage.

The prospecting engine never treats a directory entry alone as proof that a business is operating. A candidate needs multiple independent signals, recent activity and no credible closure contradiction before Control spends the daily prototype slot on it. Literal 100% certainty is not possible from public web evidence, so the engine is deliberately conservative and discards ambiguous candidates.

Read [the audit](docs/audit.md), [architecture](docs/architecture.md), [standard policy](docs/quality-standard-v1.md), [automation runtime](docs/automation-runtime.md), [daily prospecting policy](docs/prospecting-engine.md) and [deployment guide](docs/deployment.md).

## Local start

```bash
npm install
npm run dev
```

Without `DATABASE_URL`, development and tests use the checked-in benchmark bootstrap. Production continues to require persistent Postgres for the operating plane.

## Daily prospecting credentials

The autonomous commercial loop requires:

- `OPENAI_API_KEY` for current-web research;
- `GITHUB_AUTOMATION_TOKEN` with permission to create and write prototype repositories;
- `GITHUB_PROSPECT_OWNER` (defaults to `vornicx`);
- `VERCEL_TOKEN` and `VERCEL_TEAM_ID` for project creation and production deployment;
- `DATABASE_URL` to persist daily results and enforce one run per day.

The existing daily reconciler also runs the prospecting iteration. Missing credentials do not bypass verification or fabricate a successful prototype; Control reports the blocker instead.

## Verify

```bash
npm run lint
npm run typecheck
npm test
npm run journeys:validate
npm run build
npm run test:e2e
```
