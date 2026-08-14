# Deployment to `control.archic.es`

## Required Vercel environment

- `DATABASE_URL` — pooled Neon connection string;
- `CONTROL_ACCESS_KEY` — owner entry key;
- `SESSION_SECRET` — high-entropy signing secret;
- `INTEGRATION_SECRET` — benchmark and runner bearer token;
- `GITHUB_WEBHOOK_SECRET` — GitHub webhook signature secret;
- `CRON_SECRET` — Vercel cron bearer token;
- `BENCHMARK_URL` — defaults to the current Archic Benchmark JSON endpoint.

Apply `db/migrations/001_initial_control_plane.sql`, then run the seed once. The seed contains the audited real benchmark snapshot and one real policy-ratification decision.

## GitHub webhook

Target: `https://control.archic.es/api/webhooks/github`

Subscribe initially to workflow runs, check suites, pull requests, deployment statuses and issues. Use the same value as `GITHUB_WEBHOOK_SECRET`.

## DNS

Add `control.archic.es` to the Vercel project, then add the DNS record Vercel provides at the domain host. Do this only after `/api/health` returns HTTP 200 in the production environment.

## Promotion check

Before assigning the domain:

1. migration and seed complete;
2. production login succeeds;
3. a benchmark sync is idempotent;
4. approving a decision writes `audit_log`;
5. a signed GitHub test delivery is accepted;
6. Playwright desktop and mobile suites pass against the deployment.

