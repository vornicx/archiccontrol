# Automation runtime

## Task lifecycle

`queued → dispatched|leased → running → succeeded`

Failures return to `queued` with backoff while `attempt < max_attempts`. An expired lease is reclaimed by the reconciler. Only the terminal `blocked` state creates a `risk_acceptance` decision, so routine breakage never enters **Needs Vadim**.

Every task has an idempotency key. Worker leases and GitHub callbacks use random, short-lived tokens stored only as SHA-256 hashes. Repository-dispatched tasks use that scoped callback token as their capability; general leasing workers still authenticate with the shared machine bearer before they receive a task.

## Worker API

| Endpoint | Purpose |
|---|---|
| `POST /api/agents/tasks/lease` | Atomically claim the highest-priority compatible worker task |
| `POST /api/agents/tasks/:id/start` | Mark a lease or repository dispatch as running |
| `POST /api/agents/tasks/:id/complete` | Return structured evidence and succeed/retry/block |
| `GET /api/projects/:id/journeys` | Read the validated project journey contract |
| `GET /api/cron/dispatch` | Dispatch queued repository work through the GitHub App |
| `GET /api/cron/reconcile` | Recover expired work, retry executable dispatches and create terminal escalations |

The leasing endpoint requires `Authorization: Bearer $AGENT_SECRET`. Task-specific start/complete callbacks accept the matching short-lived task token; supplying `AGENT_SECRET` remains supported for trusted workers and diagnostics. Cron endpoints use `CRON_SECRET`.

## Repository adapter

Copy both files under `templates/project` into each managed project:

- `.github/workflows/archic-control.yml`
- `.archic/control-worker.mjs`

No shared Control secret is required in the managed repository. Control sends its HTTPS callback URL and a one-task callback token inside the signed GitHub repository dispatch payload. The token expires with the task lease and is stored only as a hash in Control.

Before consuming an attempt, Control verifies that the repository adapter exists and that the requested task capability is exposed. Unsupported tasks remain queued with a diagnostic instead of burning the retry budget.

The adapter executes existing `lint`, `typecheck`, `test`, `build` and `test:e2e` scripts when present. A project may expose these optional extension points:

- `archic:autofix` — make a bounded fix and leave an auditable diff;
- `archic:journeys` — execute its checked-in Playwright journey manifest;
- `archic:preview` — promote the exact approved preview without rebuilding it;
- `archic:<taskType>` — custom specialist work.

`autofix`, `playwright`, `preview` and custom task types are never dispatched unless their required npm capability exists. Missing adapters or task extensions are operational readiness gaps, not failed attempts.

## Promotion contract

A ready preview is not approvable merely because deployment succeeded. It must also have:

1. Quality Gate status `passed`;
2. a completed smoke task;
3. critical desktop and mobile project journeys passed;
4. fresh benchmark evidence inside the Control freshness window.

Only then does Control create one `final_approval` decision tied to that exact deployment ID. Approval promotes the tested artifact; it does not rebuild it.
