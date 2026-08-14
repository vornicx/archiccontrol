# Automation runtime

## Task lifecycle

`queued → dispatched|leased → running → succeeded`

Failures return to `queued` with backoff while `attempt < max_attempts`. An expired lease is reclaimed by the reconciler. Only the terminal `blocked` state creates a `risk_acceptance` decision, so routine breakage never enters **Needs Vadim**.

Every task has an idempotency key. Worker leases and GitHub callbacks use random, short-lived tokens stored only as SHA-256 hashes. The shared machine bearer is checked before the task token.

## Worker API

| Endpoint | Purpose |
|---|---|
| `POST /api/agents/tasks/lease` | Atomically claim the highest-priority compatible worker task |
| `POST /api/agents/tasks/:id/start` | Mark a lease or repository dispatch as running |
| `POST /api/agents/tasks/:id/complete` | Return structured evidence and succeed/retry/block |
| `GET /api/projects/:id/journeys` | Read the validated project journey contract |
| `GET /api/cron/dispatch` | Dispatch queued repository work through the GitHub App |
| `GET /api/cron/reconcile` | Recover expired work and create terminal escalations |

Machine endpoints require `Authorization: Bearer $AGENT_SECRET`; cron endpoints use `CRON_SECRET`.

## Repository adapter

Copy both files under `templates/project` into each managed project, then configure repository Actions secrets:

- `ARCHIC_CONTROL_URL=https://control.archic.es`
- `ARCHIC_AGENT_SECRET=<same value as AGENT_SECRET>`

The adapter executes existing `lint`, `typecheck`, `test`, `build` and `test:e2e` scripts when present. A project may expose these optional extension points:

- `archic:autofix` — make a bounded fix and leave an auditable diff;
- `archic:journeys` — execute its checked-in Playwright journey manifest;
- `archic:preview` — promote the exact approved preview without rebuilding it;
- `archic:<taskType>` — custom specialist work.

Missing required adapters fail visibly, retry automatically and only escalate after the configured budget.

## Promotion contract

A ready preview is not approvable merely because deployment succeeded. It must also have:

1. Quality Gate status `passed`;
2. a completed smoke task;
3. critical desktop and mobile project journeys passed.

Only then does Control create one `final_approval` decision tied to that exact deployment ID. Approval promotes the tested artifact; it does not rebuild it.
