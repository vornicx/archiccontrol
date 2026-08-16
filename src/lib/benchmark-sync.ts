import "server-only";
import { benchmarkReportSchema } from "@/lib/benchmark-schema";
import { getBenchmarkHealth, type BenchmarkHealth } from "@/lib/benchmark-health";
import { db, hasDatabase } from "@/lib/db";
import { ingestBenchmark } from "@/lib/repository";
import type { BenchmarkReport } from "@/lib/types";

export interface BenchmarkSyncResult {
  health: BenchmarkHealth;
  attempted: boolean;
  ingested: boolean;
  source: string;
  error: string | null;
}

export async function ingestBenchmarkEvidence(report: BenchmarkReport): Promise<{ projects: number; findings: number }> {
  const result = await ingestBenchmark(report);
  if (!hasDatabase()) return result;

  const projectIds = report.projects.map((project) => project.id);
  if (projectIds.length) {
    await db().query(
      `update agent_tasks t
       set status='cancelled',
           completed_at=coalesce(t.completed_at,now()),
           lease_owner=null,
           lease_token_hash=null,
           leased_until=null,
           last_error='Superseded by fresher benchmark evidence.'
       where t.project_id = any($1::text[])
         and t.executor='github_dispatch'
         and t.task_type='autofix'
         and t.status in ('queued','dispatched','leased','running')
         and not exists (
           select 1
           from quality_runs q
           where q.id::text = t.payload->>'qualityRunId'
             and q.project_id=t.project_id
             and q.source='archic-benchmark'
             and q.started_at=$2::timestamptz
         )`,
      [projectIds, report.generatedAt],
    );
  }

  return result;
}

export async function syncBenchmarkFromSource(): Promise<BenchmarkSyncResult> {
  const source = process.env.BENCHMARK_URL ?? "https://archicbenchmark.vercel.app/api/latest.json";
  const before = await getBenchmarkHealth();

  try {
    const response = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
    if (!response.ok) throw new Error(`Benchmark source unavailable (${response.status})`);

    const parsed = benchmarkReportSchema.safeParse(await response.json());
    if (!parsed.success) throw new Error("Benchmark source returned an invalid report");

    const incomingAt = new Date(parsed.data.generatedAt).getTime();
    const currentAt = before.lastBenchmarkAt ? new Date(before.lastBenchmarkAt).getTime() : 0;
    if (!Number.isFinite(incomingAt)) throw new Error("Benchmark source timestamp is invalid");

    const shouldIngest = !before.lastBenchmarkAt || !Number.isFinite(currentAt) || incomingAt > currentAt;
    if (shouldIngest) await ingestBenchmarkEvidence(parsed.data);

    const health = await getBenchmarkHealth();
    return {
      health,
      attempted: true,
      ingested: shouldIngest,
      source,
      error: null,
    };
  } catch (error) {
    return {
      health: await getBenchmarkHealth(),
      attempted: true,
      ingested: false,
      source,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function ensureFreshBenchmark(): Promise<BenchmarkSyncResult> {
  const health = await getBenchmarkHealth();
  const source = process.env.BENCHMARK_URL ?? "https://archicbenchmark.vercel.app/api/latest.json";
  if (health.fresh) {
    return { health, attempted: false, ingested: false, source, error: null };
  }
  return syncBenchmarkFromSource();
}
