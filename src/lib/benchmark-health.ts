import "server-only";
import { benchmarkSnapshot } from "@/lib/bootstrap";
import { db, hasDatabase } from "@/lib/db";

const STALE_AFTER_HOURS = 30;

type Row = Record<string, unknown>;

export interface BenchmarkHealth {
  fresh: boolean;
  lastBenchmarkAt: string | null;
  ageHours: number | null;
  activeProjects: number;
  staleAfterHours: number;
}

function iso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

function healthFrom(lastBenchmarkAt: string | null, activeProjects: number): BenchmarkHealth {
  if (!lastBenchmarkAt) {
    return {
      fresh: false,
      lastBenchmarkAt: null,
      ageHours: null,
      activeProjects,
      staleAfterHours: STALE_AFTER_HOURS,
    };
  }

  const timestamp = new Date(lastBenchmarkAt).getTime();
  const ageHours = Number.isFinite(timestamp)
    ? Math.max(0, (Date.now() - timestamp) / 3_600_000)
    : null;

  return {
    fresh: ageHours !== null && ageHours <= STALE_AFTER_HOURS,
    lastBenchmarkAt,
    ageHours,
    activeProjects,
    staleAfterHours: STALE_AFTER_HOURS,
  };
}

export async function getBenchmarkHealth(): Promise<BenchmarkHealth> {
  if (!hasDatabase()) {
    return healthFrom(benchmarkSnapshot.generatedAt, benchmarkSnapshot.projects.length);
  }

  const rows = await db().query(`
    select
      max(last_benchmark_at) as last_benchmark_at,
      count(*) filter (where status='active')::int as active_projects
    from projects
  `);
  const row = (rows[0] ?? {}) as Row;
  return healthFrom(iso(row.last_benchmark_at), Number(row.active_projects ?? 0));
}
