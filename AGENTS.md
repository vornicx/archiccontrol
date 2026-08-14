# Archic Control agent contract

Archic Control is the control plane. It owns orchestration state, evidence, decisions and audit history. It does not absorb specialist runners such as Archic Benchmark.

## Invariants

- “Needs Vadim” contains only final approval, brand direction, risk acceptance, scope change or an irreversible action.
- Retryable failures, ordinary findings and known fixes remain in the agent queue.
- Scores prioritize work; a score never overrides a blocking Quality Gate check.
- Production must have durable Postgres persistence and configured authentication. It must fail closed rather than fall back to bootstrap state.
- Every integration is signed or bearer-authenticated and idempotent.
- Every human decision writes an audit record.
- Quality Standard changes require an explicit version.

## Before completing work

Run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

For interface work, inspect desktop and mobile output. Preserve keyboard operation, visible focus, 44 px touch targets and reduced motion.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
