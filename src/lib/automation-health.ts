import "server-only";
import { db, hasDatabase } from "@/lib/db";
import { isGithubAutomationConfigured } from "@/lib/github-app";

type Row = Record<string, unknown>;

export interface AutomationHealth {
  score: number;
  queued: number;
  staleQueued: number;
  active: number;
  blocked: number;
  oldestQueuedAt: string | null;
  githubConfigured: boolean;
  state: "healthy" | "working" | "degraded" | "blocked";
  detail: string;
}

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getAutomationHealth(): Promise<AutomationHealth> {
  const githubConfigured = isGithubAutomationConfigured();
  if (!hasDatabase()) {
    return {
      score: githubConfigured ? 80 : 0,
      queued: 0,
      staleQueued: 0,
      active: 0,
      blocked: 0,
      oldestQueuedAt: null,
      githubConfigured,
      state: githubConfigured ? "working" : "blocked",
      detail: githubConfigured ? "Automation is configured without durable queue telemetry." : "GitHub automation is not configured.",
    };
  }

  const rows = await db().query(`
    select
      count(*) filter (where status in ('queued','dispatched'))::int as queued,
      count(*) filter (where status='queued' and created_at < now()-interval '2 hours')::int as stale_queued,
      count(*) filter (where status in ('leased','running','dispatched'))::int as active,
      count(*) filter (where status='blocked')::int as blocked,
      min(created_at) filter (where status='queued') as oldest_queued_at
    from agent_tasks
  `);
  const row = (rows[0] ?? {}) as Row;
  const queued = count(row.queued);
  const staleQueued = count(row.stale_queued);
  const active = count(row.active);
  const blocked = count(row.blocked);
  const oldestQueuedAt = iso(row.oldest_queued_at);

  if (!githubConfigured && queued > 0) {
    return {
      score: 0,
      queued,
      staleQueued,
      active,
      blocked,
      oldestQueuedAt,
      githubConfigured,
      state: "blocked",
      detail: `${queued} repository task(s) are waiting but GitHub automation is not configured.`,
    };
  }

  if (blocked > 0) {
    return {
      score: 15,
      queued,
      staleQueued,
      active,
      blocked,
      oldestQueuedAt,
      githubConfigured,
      state: "blocked",
      detail: `${blocked} task(s) exhausted their automated retry budget.`,
    };
  }

  if (staleQueued > 0) {
    return {
      score: 35,
      queued,
      staleQueued,
      active,
      blocked,
      oldestQueuedAt,
      githubConfigured,
      state: "degraded",
      detail: `${staleQueued} queued task(s) have not started for more than two hours.`,
    };
  }

  if (active > 0 || queued > 0) {
    return {
      score: 90,
      queued,
      staleQueued,
      active,
      blocked,
      oldestQueuedAt,
      githubConfigured,
      state: "working",
      detail: `${active} active and ${queued} queued task(s).`,
    };
  }

  return {
    score: 100,
    queued,
    staleQueued,
    active,
    blocked,
    oldestQueuedAt,
    githubConfigured,
    state: "healthy",
    detail: "Automation queue is clear.",
  };
}
