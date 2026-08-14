# Deployment to `control.archic.es`

## Required Vercel environment

- `DATABASE_URL` — pooled Neon connection string;
- `CONTROL_ACCESS_KEY` — owner entry key;
- `SESSION_SECRET` — high-entropy signing secret;
- `INTEGRATION_SECRET` — benchmark and runner bearer token;
- `GITHUB_WEBHOOK_SECRET` — GitHub webhook signature secret;
- `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` — preferred repository-dispatch credentials;
- `GITHUB_AUTOMATION_TOKEN` — optional scoped local fallback; do not use when the App is configured;
- `AGENT_SECRET` — worker API bearer token;
- `CRON_SECRET` — Vercel cron bearer token;
- `BENCHMARK_URL` — defaults to the current Archic Benchmark JSON endpoint.

Run `npm run db:migrate`, then `npm run db:seed` once. The migration runner applies every unapplied file in order. The seed contains the audited real benchmark snapshot, journey contracts, autonomous autofix queue and one policy-ratification decision.

## GitHub App

Create an App owned by Archic with repository permissions for Actions (write), Contents (write), Deployments (write), Metadata (read), Pull requests (write) and Checks (read). Subscribe to pull requests, workflow runs, check runs, deployments, deployment statuses and pushes. Install it only on managed Archic repositories.

Webhook target: `https://control.archic.es/api/webhooks/github`. Callback URL is not required. Store the App ID and PEM private key only in Vercel; newline-escaped PEM values are supported.

## GitHub webhook

Target: `https://control.archic.es/api/webhooks/github`

Use the same generated webhook secret as `GITHUB_WEBHOOK_SECRET`. GitHub delivery IDs are deduplicated before processing.

## DNS

Add `control.archic.es` to the Vercel project, then add the DNS record Vercel provides at the domain host. Do this only after `/api/health` returns HTTP 200 in the production environment.

## Promotion check

Before assigning the domain:

1. migration and seed complete;
2. production login succeeds;
3. a benchmark sync is idempotent;
4. approving a decision writes `audit_log`;
5. a signed GitHub test delivery is accepted;
6. `/api/health` reports `deploymentReady: true`;
7. Playwright desktop and mobile suites pass against the deployment;
8. a preview deployment produces smoke evidence without creating a human decision unless the full gate passes.

The repository is deployable before project adapters are installed; missing adapters remain visible as automation work and never bypass the Quality Gate.

## Hobby and Pro scheduling

The checked-in `vercel.json` is compatible with Hobby: two daily safety-net crons. Normal task dispatch is event-driven after benchmark ingestion, GitHub webhooks and human approvals, so it does not wait for a cron. On Pro, the safety net may be increased to hourly without changing application code.
