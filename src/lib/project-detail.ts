import "server-only";

import { benchmarkSnapshot } from "@/lib/bootstrap";
import { db, hasDatabase } from "@/lib/db";
import type { BenchmarkGate, BenchmarkIssue, BenchmarkProject } from "@/lib/types";
import { evaluateQualityGate } from "@/quality/gate";
import { getLatestRubricReport } from "@/quality/rubric-repository";

type Row = Record<string, unknown>;

function asRecord(value: unknown): Row {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Row
    : {};
}

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asOptionalNumber(value: unknown): number | undefined {
  if (value == null) return undefined;
  const parsed = asNumber(value, Number.NaN);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function findingToIssue(row: Row): BenchmarkIssue {
  const evidence = asRecord(row.evidence);
  return {
    id: row.check_id ? String(row.check_id) : String(row.id),
    severity: row.severity ? String(row.severity) : undefined,
    title: String(row.title),
    detail: row.detail ? String(row.detail) : undefined,
    priority: asOptionalNumber(evidence.priority),
    recommendation: row.automation_action ? String(row.automation_action) : undefined,
    evidence: Object.prototype.hasOwnProperty.call(evidence, "raw") ? evidence.raw : row.evidence,
  };
}

function readGates(value: unknown, fallback: BenchmarkGate[]): BenchmarkGate[] {
  return Array.isArray(value) ? value as BenchmarkGate[] : fallback;
}

function readCategoryScores(value: unknown, fallback?: Record<string, number>): Record<string, number> | undefined {
  const record = asRecord(value);
  const entries = Object.entries(record)
    .map(([key, score]) => [key, asOptionalNumber(score)] as const)
    .filter((entry): entry is readonly [string, number] => entry[1] !== undefined);
  return entries.length ? Object.fromEntries(entries) : fallback;
}

export async function getLiveProject(id: string) {
  const bootstrap = benchmarkSnapshot.projects.find((project) => project.id === id);

  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Archic Control refuses non-persistent production mode. Configure DATABASE_URL.");
    }
    if (!bootstrap) return null;
    return { project: bootstrap, rubric: null, gate: evaluateQualityGate(bootstrap) };
  }

  const sql = db();
  const projectRows = await sql.query(
    `select * from projects where id = $1 limit 1`,
    [id],
  );
  const projectRow = projectRows[0] as Row | undefined;
  if (!projectRow) return null;

  const [runRows, rubric] = await Promise.all([
    sql.query(
      `select id, raw_score, final_score, input, output, started_at
       from quality_runs
       where project_id = $1 and source = 'archic-benchmark'
       order by started_at desc
       limit 1`,
      [id],
    ),
    getLatestRubricReport(id),
  ]);
  const latestRun = runRows[0] as Row | undefined;
  const latestInput = asRecord(latestRun?.input);

  const findingRows = latestRun?.id
    ? await sql.query(
      `select id, check_id, severity, title, detail, evidence, automation_action
       from findings
       where project_id = $1
         and run_id = $2
         and status in ('open','fixing','blocked')
       order by
         case severity when 'critical' then 4 when 'high' then 3 when 'medium' then 2 else 1 end desc,
         updated_at desc`,
      [id, latestRun.id],
    )
    : [];

  const score = projectRow.current_score == null
    ? asNumber(latestInput.score, bootstrap?.score ?? 0)
    : asNumber(projectRow.current_score, bootstrap?.score ?? 0);

  const project: BenchmarkProject = {
    id: String(projectRow.id),
    name: String(projectRow.name),
    url: String(projectRow.production_url),
    repository: String(projectRow.repository_full_name),
    profile: String(projectRow.benchmark_profile),
    status: latestInput.status ? String(latestInput.status) : (String(projectRow.gate_status) === "passed" ? "ok" : "issues"),
    score,
    rawScore: latestRun?.raw_score == null ? asOptionalNumber(latestInput.rawScore) : asOptionalNumber(latestRun.raw_score),
    tier: latestInput.tier ? String(latestInput.tier) : bootstrap?.tier,
    delta: asOptionalNumber(latestInput.delta) ?? bootstrap?.delta,
    categoryScores: readCategoryScores(latestInput.categoryScores, bootstrap?.categoryScores),
    gates: readGates(latestInput.gates, bootstrap?.gates ?? []),
    issues: (findingRows as Row[]).map(findingToIssue),
    reviewedAt: latestRun?.started_at ? String(latestRun.started_at) : bootstrap?.reviewedAt,
  };

  return { project, rubric, gate: evaluateQualityGate(project, { rubric }) };
}
