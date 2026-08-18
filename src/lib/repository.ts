import "server-only";
import { randomUUID } from "node:crypto";
import { buildBootstrapDashboard, benchmarkSnapshot, resolveBootstrapDecision } from "@/lib/bootstrap";
import { db, hasDatabase } from "@/lib/db";
import type { BenchmarkReport, DashboardData, Decision, ProjectSummary, WorkflowRun } from "@/lib/types";
import { evaluateQualityGate, normalizeSeverity } from "@/quality/gate";
import { enqueueTask } from "@/lib/automation-repository";

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
        latest_rubric.final_score as archic_score,
        latest_rubric.output->>'archicLevel' as archic_level,
        latest_rubric.output->>'status' as archic_status,
        count(f.id) filter (
          where f.status in ('open','fixing','blocked')
            and (f.source <> 'benchmark' or f.run_id = latest_benchmark.id)
        )::int as open_findings,
        count(f.id) filter (
          where f.status in ('open','fixing','blocked')
            and f.severity = 'critical'
            and (f.source <> 'benchmark' or f.run_id = latest_benchmark.id)
        )::int as critical_findings,
        count(f.id) filter (
          where f.status in ('open','fixing','blocked')
            and f.source = 'benchmark'
            and f.run_id = latest_benchmark.id
            and (f.evidence->>'gate')::boolean is true
        )::int as active_gates
      from projects p
      left join lateral (
        select q.id
        from quality_runs q
        where q.project_id = p.id and q.source = 'archic-benchmark'
        order by q.started_at desc
        limit 1
      ) latest_benchmark on true
      left join lateral (
        select q.final_score, q.output
        from quality_runs q
        where q.project_id = p.id and q.source = 'archic-rubric'
        order by q.started_at desc
        limit 1
      ) latest_rubric on true
      left join findings f on f.project_id = p.id
      where p.status = 'active'
      group by p.id, latest_benchmark.id, latest_rubric.final_score, latest_rubric.output
      order by p.updated_at desc
    `),
    sql.query(`
      select d.*, p.name as project_name
      from decisions d
      left join projects p on p.id = d.project_id
      left join agent_tasks t
        on d.requested_by = 'agent-runtime'
       and d.id = 'task:' || t.id::text || ':risk'
      left join deployment_previews dp
        on d.type = 'final_approval'
       and d.id = 'preview:' || dp.id || ':approval'
      where d.status = 'pending'
        and (d.project_id is null or p.status = 'active')
        and (d.requested_by <> 'agent-runtime' or t.status = 'blocked')
        and (
          d.type <> 'final_approval'
          or (dp.id is not null and dp.status = 'ready' and dp.quality_status = 'passed')
        )
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
    archicScore: row.archic_score == null ? null : asNumber(row.archic_score),
    archicLevel: row.archic_level ? String(row.archic_level) : null,
    archicStatus: row.archic_status ? String(row.archic_status) : null,
    delta: null,
    tier: null,
    gateStatus: row.gate_status as ProjectSummary["gateStatus"],
    activeGates: asNumber(row.active_gates),
    openFindings: asNumber(row.open_findings),
    criticalFindings: asNumber(row.critical_findings),
    nextAction: row.gate_status === "passed" && (row.archic_status === "CLIENT_READY" || row.archic_status === "FLAGSHIP_READY")
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
     returning id,project_id,type`,
    [id, outcome, note],
  );
  if (rows.length === 0) throw new Error("Decision is no longer pending");
  await sql.query(
    `insert into audit_log(actor, action, entity_type, entity_id, metadata)
     values ('vadim', $2, 'decision', $1, jsonb_build_object('note', $3))`,
    [id, outcome, note],
  );
  const decision = rows[0] as Row;
  if (decision.type === "final_approval" && decision.project_id) {
    const deploymentId = id.startsWith("preview:") && id.endsWith(":approval") ? id.slice(8, -9) : null;
    if (outcome === "approved") {
      await enqueueTask({
        projectId: String(decision.project_id), type: "preview", executor: "github_dispatch", priority: 100,
        payload: { summary: "Promote the approved immutable preview", decisionId: id, deploymentId, resolutionNote: note },
        idempotencyKey: `promote:${id}`, maxAttempts: 3,
      });
    } else if (deploymentId) {
      await sql.query(`update deployment_previews set status='superseded' where id=$1`, [deploymentId]);
      await sql.query(`update projects set phase='quality' where id=$1`, [decision.project_id]);
    }
  }
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
    const currentFindingIds = project.issues.map((issue) => `${project.id}:benchmark:${issue.id}`);

    const staleRows = await sql.query(
      `select id
       from findings
       where project_id=$1
         and source='benchmark'
         and status in ('open','fixing','blocked')
         and not (id = any($2::text[]))`,
      [project.id, currentFindingIds],
    );
    const staleFindingIds = (staleRows as Row[]).map((row) => String(row.id));

    if (staleFindingIds.length) {
      await sql.query(
        `update findings
         set status='resolved'
         where id = any($1::text[])`,
        [staleFindingIds],
      );
      await sql.query(
        `update agent_tasks
         set status='cancelled',
             completed_at=coalesce(completed_at,now()),
             lease_owner=null,
             lease_token_hash=null,
             leased_until=null,
             last_error='Superseded by a newer benchmark run.'
         where finding_id = any($1::text[])
           and status in ('queued','dispatched','leased','running')`,
        [staleFindingIds],
      );
      await sql.query(
        `update decisions d
         set status='superseded',
             resolved_by='control',
             resolution_note='The latest benchmark no longer reports the associated finding.',
             resolved_at=now()
         where d.status='pending'
           and d.requested_by='agent-runtime'
           and exists (
             select 1
             from agent_tasks t
             where d.id = 'task:' || t.id::text || ':risk'
               and t.finding_id = any($1::text[])
           )`,
        [staleFindingIds],
      );
    }

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
      await enqueueTask({
        projectId: project.id,
        findingId: `${project.id}:benchmark:${issue.id}`,
        type: "autofix",
        executor: "github_dispatch",
        priority: Math.min(100, Math.max(1, issue.priority ?? 50)),
        payload: {
          summary: issue.title,
          finding: { id: issue.id, severity: normalizeSeverity(issue.severity), detail: issue.detail ?? "", recommendation: issue.recommendation ?? "" },
          qualityRunId: runId,
          standardVersion: "1.0.0",
        },
        idempotencyKey: `autofix:${project.id}:${issue.id}:${report.generatedAt}`,
      });
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
