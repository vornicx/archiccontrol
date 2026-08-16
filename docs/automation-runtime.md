# Automation runtime

## Task lifecycle

`queued → dispatched|leased → running → succeeded`

Failures return to `queued` with backoff while `attempt < max_attempts`. An expired lease is reclaimed by the reconciler. Only the terminal `blocked` state creates a `risk_acceptance` decision, so routine breakage never enters **Needs Vadim**.

Every task has an idempotency key. Worker leases and GitHub callbacks use random, short-lived tokens stored only as SHA-256 hashes. Repository-dispatched tasks use that scoped callback token as their capability; general leasing workers still authenticate with the shared machine bearer before they receive a task.

## Worker API

| Endpoint | Purpose |
|---|---|
| `POST /api/agents/tasks/lease` | Atomically claim the highest-priority compatible general worker task |
| `POST /api/agents/repository-lease` | Let the exact managed GitHub Actions adapter on `main` claim one repository autofix through OIDC |
| `POST /api/agents/tasks/:id/start` | Mark a lease or repository dispatch as running |
| `POST /api/agents/tasks/:id/autofix-plan` | Plan one bounded autofix from repository-provided code context |
| `POST /api/agents/tasks/:id/autofix-publish` | Create or recover the draft PR for an already-pushed bounded autofix branch |
| `POST /api/agents/tasks/:id/complete` | Return structured evidence and succeed/retry/block |
| `GET /api/projects/:id/journeys` | Read the validated project journey contract |
| `GET /api/cron/dispatch` | Dispatch queued repository work through the GitHub App when push delivery is available |
| `GET /api/cron/reconcile` | Recover expired work, retry executable dispatches and create terminal escalations |

The general leasing endpoint requires `Authorization: Bearer $AGENT_SECRET`. Repository pull leasing uses a short-lived GitHub Actions OIDC bearer with audience `archic-control`; Control verifies GitHub's RS256 signature, issuer, expiry, repository, `refs/heads/main`, the exact `.github/workflows/archic-control.yml` workflow and the allowed event before the queue is touched. Task-specific start/plan/publish/complete callbacks use the matching short-lived task token. Cron endpoints use `CRON_SECRET`.

## Repository adapter

Copy both files under `templates/project` into each managed project:

- `.github/workflows/archic-control.yml`
- `.archic/control-worker.mjs`

No shared Control or OpenAI secret is required in the managed repository. There are two start paths:

1. **Push path:** Control sends `repository_dispatch` with its HTTPS callback URL and a one-task callback token.
2. **Pull recovery:** the adapter runs on install/update and hourly, discovers the newest successful Archic Control `Production` deployment from GitHub, obtains a GitHub OIDC token and claims at most one eligible autofix from `/api/agents/repository-lease`.

The pull path is deliberately a recovery mechanism, not a broad queue drain. It leases one task for 30 minutes, and Control refuses to consume the attempt if OpenAI or PR publication is not configured. The exact adapter workflow on the repository's `main` branch is the only OIDC identity allowed to lease repository work.

Before consuming a push-dispatched attempt, Control also verifies that the repository adapter exists and that the requested task capability is exposed. Unsupported tasks remain queued with a diagnostic instead of burning the retry budget.

The adapter executes existing `lint`, `typecheck`, `test`, `build` and `test:e2e` scripts when present. A project may expose these optional extension points:

- `archic:journeys` — execute its checked-in project journey manifest;
- `archic:preview` — promote the exact approved preview without rebuilding it;
- `archic:<taskType>` — custom specialist work.

`autofix` is built into the generic Archic worker and does not require `archic:autofix` or an OpenAI key in the project repository. `playwright`, `preview` and custom task types still require their corresponding repository capability. Missing adapters or task extensions are operational readiness gaps, not failed attempts.

## Bounded AI autofix

One benchmark finding produces at most one controlled autofix branch: `archic/autofix-<task>`. The worker gathers a bounded repository index and a small set of likely source files, then sends those file contents to Control. Control alone calls the configured OpenAI model and returns a strict JSON repair plan.

The boundary is intentionally narrow:

- maximum four changed files per finding;
- maximum 80 KB per file and 180 KB of replacement content;
- no `.env`, credentials, private keys, CI, `.github`, `.archic`, database migrations, deployment configuration, lockfiles or dependency edits;
- literal credential patterns are rejected from model context and generated output;
- an existing file can only be changed after its full content was supplied to the planner;
- the planner gets at most two context rounds and six additional-file requests;
- the worker revalidates paths, stages only the approved file set and aborts if QA creates unexpected tracked changes;
- all available repository QA scripts run before the branch is pushed;
- Control creates a draft PR centrally; the worker never writes to the default branch.

A successful autofix task means only that a bounded, QA-tested draft PR exists. The linked finding remains `fixing`; only a later benchmark run that no longer reports the defect may resolve it.

## Promotion contract

A ready preview is not approvable merely because deployment succeeded. It must also have:

1. Quality Gate status `passed`;
2. a completed smoke task;
3. critical desktop and mobile project journeys passed;
4. fresh benchmark evidence inside the Control freshness window.

Only then does Control create one `final_approval` decision tied to that exact deployment ID. Approval promotes the tested artifact; it does not rebuild it.
