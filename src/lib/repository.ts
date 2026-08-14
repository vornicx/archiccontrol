import "server-only";
import { randomUUID } from "node:crypto";
import { buildBootstrapDashboard, benchmarkSnapshot, resolveBootstrapDecision } from "@/lib/bootstrap";
import { db, hasDatabase } from "@/lib/db";
import type { BenchmarkReport, DashboardData, Decision, ProjectSummary, WorkflowRun } from "@/lib/types";
import { evaluateQualityGate, normalizeSeverity } from "@/quality/gate";

type Row = Record<string, unknown>;

function asNumber(value: unknown, fallback = 0): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asIso(value: unknown): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : String(value);
}

export async function getDashboard(): Promise<DashboardData> {
  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Archic Control refuses non-persistent production mode. Configure DATABASE_URL.");
    }
    return buildBootstrapDashboard();
  }
  const sql = db();

  const [projectRows, decisionRows, runRows, statsRows] = await Promise.all([
    sql.query(`
      select p.*,
        count(f.id) filter (where f.status in ('open','fixing','blocked'))::int as open_findings,
        count(f.id) filter (where f.status in ('open','fixing','blocked') and f.severity = 'critical')::int as critical_findings,
        count(f.id) filter (where f.status in ('open','fixing','blocked') and f.source = 'benchmark' and (f.evidence->>'gate')::boolean is true)::int as active_gates
      from projects p
      left join findings f on f.project_id = p.id
      where p.status = 'active'
      group by p.id
      order by p.updated_at desc
    `),
    sql.query(`
      select d.*, p.name as project_name
      from decisions d
      left join projects p on p.id = d.project_id
      where d.status = 'pending'
      order by d.blocking desc, d.created_at asc
    `),
    sql.query(`
      select w.*, p.name as project_name
      from workflow_runs w
      left join projects p on p.id = w.project_id
      order by w.started_at desc
      limit 8
    `),
    sql.query(`
      select
        coalesce(avg(current_score),0) as score,
        count(*) filter (where current_score is not null)::int as projects_scored,
        count(*) filter (where gate_status = 'failed')::int as failed_projects,
        count(*)::int as projects
      from projects where status = 'active'
    `),
  ]);

  const projects: ProjectSummary[] = (projectRows as Row[]).map((row) => ({
    id: String(row.id),
    name: String(row.name),
    repositoryFullName: String(row.repository_full_name),
    productionUrl: String(row.production_url),
    benchmarkProfile: String(row.benchmark_profile),
    phase: row.phase as ProjectSummary["phase"],
    score: row.current_score == null ? null : asNumber(row.current_score),
    delta: null,
    tier: null,
    gateStatus: row.gate_status as ProjectSummary["gateStatus"],
    activeGates: asNumber(row.active_gates),
    openFindings: asNumber(row.open_findings),
    criticalFindings: asNumber(row.critical_findings),
    nextAction: row.gate_status === "passed"
      ? "Ready for the human approval boundary."
      : "Agents continue on the highest-impact blocking finding.",
    lastBenchmarkAt: asIso(row.last_benchmark_at),
  }));

  const decisions: Decision[] = (decisionRows as Row[]).map((row) => ({
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    type: row.type as Decision["type"],
    title: String(row.title),
    context: String(row.context),
    recommendation: String(row.recommendation),
    risk: String(row.risk),
    status: row.status as Decision["status"],
    blocking: Boolean(row.blocking),
    createdAt: asIso(row.created_at) ?? new Date().toISOString(),
    dueAt: asIso(row.due_at),
  }));

  const runs: WorkflowRun[] = (runRows as Row[]).map((row) => ({
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    workflow: String(row.workflow),
    stage: String(row.stage),
    status: row.status as WorkflowRun["status"],
    summary: row.summary ? String(row.summary) : null,
    startedAt: asIso(row.started_at) ?? new Date().toISOString(),
    externalUrl: row.external_url ? String(row.external_url) : null,
  }));

  const stats = (statsRows as Row[])[0] ?? {};
  const succeeded = runs.filter((run) => run.status === "succeeded").length;
  return {
    generatedAt: new Date().toISOString(),
    source: "postgres",
    needsVadim: decisions,
    projects,
    runs,
    portfolio: {
      score: asNumber(stats.score),
      delta: 0,
      activeGates: projects.reduce((sum, project) => sum + project.activeGates, 0),
      projectsScored: asNumber(stats.projects_scored),
      automationHealth: runs.length ? Math.round((succeeded / runs.length) * 100) : 100,
    },
  };
}

export async function getProject(id: string) {
  const snapshot = benchmarkSnapshot.projects.find((project) => project.id === id);
  if (!snapshot) return null;
  return { project: snapshot, gate: evaluateQualityGate(snapshot) };
}

export async function resolveDecision(
  id: string,
  outcome: "approved" | "rejected",
  note: string,
): Promise<void> {
  if (!hasDatabase()) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Archic Control refuses non-persistent production mode.");
    }
    if (id === "ratify-quality-standard-v1") resolveBootstrapDecision(outcome);
    return;
  }
  const sql = db();
  const rows = await sql.query(
    `update decisions
     set status = $2, resolved_by = 'vadim', resolution_note = $3, resolved_at = now()
     where id = $1 and status = 'pending'
     returning id`,
    [id, outcome, note],
  );
  if (rows.length === 0) throw new Error("Decision is no longer pending");
  await sql.query(
    `insert into audit_log(actor, action, entity_type, entity_id, metadata)
     values ('vadim', $2, 'decision', $1, jsonb_build_object('note', $3))`,
    [id, outcome, note],
  );
}

export async function ingestBenchmark(report: BenchmarkReport): Promise<{ projects: number; findings: number }> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required for ingestion");
  const sql = db();
  let findings = 0;

  for (const project of report.projects) {
    const gate = evaluateQualityGate(project);
    await sql.query(
      `insert into projects(id,name,repository_full_name,production_url,benchmark_profile,phase,current_score,gate_status,last_benchmark_at)
       values($1,$2,$3,$4,$5,'quality',$6,$7,$8)
       on conflict(id) do update set
         name=excluded.name,
         repository_full_name=excluded.repository_full_name,
         production_url=excluded.production_url,
         benchmark_profile=excluded.benchmark_profile,
         current_score=excluded.current_score,
         gate_status=excluded.gate_status,
         last_benchmark_at=excluded.last_benchmark_at`,
      [project.id, project.name, project.repository, project.url, project.profile, project.score, gate.status, report.generatedAt],
    );

    const proposedRunId = randomUUID();
    const runRows = await sql.query(
      `insert into quality_runs(id,project_id,source,status,raw_score,final_score,input,output,started_at,completed_at)
       values($1,$2,'archic-benchmark',$3,$4,$5,$6::jsonb,$7::jsonb,$8,$8)
       on conflict(project_id,source,started_at) do update set
         status=excluded.status,
         raw_score=excluded.raw_score,
         final_score=excluded.final_score,
         input=excluded.input,
         output=excluded.output,
         completed_at=excluded.completed_at
       returning id`,
      [proposedRunId, project.id, gate.status, project.rawScore ?? project.score, project.score, JSON.stringify(project), JSON.stringify(gate), report.generatedAt],
    );
    const runId = runRows[0]?.id ? String(runRows[0].id) : proposedRunId;

    for (const issue of project.issues) {
      findings += 1;
      await sql.query(
        `insert into findings(id,run_id,project_id,check_id,source,severity,status,title,detail,evidence,automation_action,owner_type)
         values($1,$2,$3,$4,'benchmark',$5,'open',$6,$7,$8::jsonb,$9,'agent')
         on conflict(id) do update set
           run_id=excluded.run_id,
           severity=excluded.severity,
           status='open',
           title=excluded.title,
           detail=excluded.detail,
           evidence=excluded.evidence,
           automation_action=excluded.automation_action`,
        [
          `${project.id}:benchmark:${issue.id}`,
          runId,
          project.id,
          issue.id,
          normalizeSeverity(issue.severity),
          issue.title,
          issue.detail ?? "",
          JSON.stringify({ raw: issue.evidence ?? null, priority: issue.priority ?? null, gate: issue.id.startsWith("gate-") }),
          issue.recommendation ?? null,
        ],
      );
    }

    await sql.query(
      `insert into workflow_runs(id,project_id,workflow,stage,status,summary,external_url,started_at,completed_at)
       values($1,$2,'Daily quality pipeline','benchmark',$3,$4,'https://archicbenchmark.vercel.app',$5,$5)
       on conflict(id) do nothing`,
      [
        `benchmark:${project.id}:${report.generatedAt}`,
        project.id,
        project.status === "ok" ? "succeeded" : "failed",
        `${project.score.toFixed(1)} / 100 · ${project.gates.length} active gate(s)`,
        report.generatedAt,
      ],
    );
  }

  return { projects: report.projects.length, findings };
}
