import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { benchmarkSnapshot } from "@/lib/bootstrap";
import { db, hasDatabase } from "@/lib/db";
import { dispatchRepositoryTask, isGithubAutomationConfigured } from "@/lib/github-app";
import type { AgentTask, AgentTaskType, AutomationData, DeploymentPreview } from "@/lib/types";

type Row = Record<string, unknown>;

function iso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return value ? String(value) : new Date().toISOString();
}

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapTask(row: Row): AgentTask {
  const payload = typeof row.payload === "object" && row.payload ? row.payload as Record<string, unknown> : {};
  return {
    id: String(row.id),
    projectId: row.project_id ? String(row.project_id) : null,
    projectName: row.project_name ? String(row.project_name) : null,
    repositoryFullName: row.repository_full_name ? String(row.repository_full_name) : null,
    findingId: row.finding_id ? String(row.finding_id) : null,
    type: row.task_type as AgentTask["type"],
    executor: row.executor as AgentTask["executor"],
    status: row.status as AgentTask["status"],
    priority: number(row.priority),
    attempt: number(row.attempt),
    maxAttempts: number(row.max_attempts),
    summary: String(payload.summary ?? payload.title ?? row.task_type),
    input: payload,
    externalUrl: row.external_url ? String(row.external_url) : null,
    lastError: row.last_error ? String(row.last_error) : null,
    createdAt: iso(row.created_at),
  };
}

function deploymentReadiness() {
  return [
    { label: "Postgres", ready: hasDatabase(), detail: "Durable control-plane state" },
    { label: "Owner authentication", ready: Boolean(process.env.CONTROL_ACCESS_KEY && process.env.SESSION_SECRET), detail: "Signed owner session" },
    { label: "Machine API", ready: Boolean(process.env.AGENT_SECRET), detail: "Authenticated worker leasing" },
    { label: "GitHub events", ready: Boolean(process.env.GITHUB_WEBHOOK_SECRET), detail: "Signed delivery ingestion" },
    { label: "GitHub automation", ready: isGithubAutomationConfigured(), detail: "App installation or scoped token" },
    { label: "Benchmark ingestion", ready: Boolean(process.env.INTEGRATION_SECRET), detail: "Signed quality reports" },
    { label: "Scheduled control", ready: Boolean(process.env.CRON_SECRET), detail: "Dispatch and reconciliation" },
  ];
}

export async function getAutomationData(): Promise<AutomationData> {
  const readiness = deploymentReadiness();
  if (!hasDatabase()) {
    const tasks: AgentTask[] = benchmarkSnapshot.projects.flatMap((project) => project.issues.slice(0, 1).map((issue, index) => ({
      id: `bootstrap-${project.id}-${issue.id}`,
      projectId: project.id,
      projectName: project.name,
      repositoryFullName: project.repository,
      findingId: `${project.id}:benchmark:${issue.id}`,
      type: "autofix" as const,
      executor: "github_dispatch" as const,
      status: "queued" as const,
      priority: Math.max(1, Number(issue.priority ?? 50) - index),
      attempt: 0,
      maxAttempts: 3,
      summary: issue.title,
      input: { summary: issue.title, finding: issue },
      externalUrl: null,
      lastError: null,
      createdAt: benchmarkSnapshot.generatedAt,
    })));
    return { tasks, previews: [], counts: { queued: tasks.length, running: 0, blocked: 0, readyPreviews: 0 }, deploymentReadiness: readiness };
  }

  const sql = db();
  const [taskRows, previewRows] = await Promise.all([
    sql.query(`
      select t.*, p.name as project_name, p.repository_full_name
      from agent_tasks t left join projects p on p.id = t.project_id
      order by case t.status when 'blocked' then 0 when 'running' then 1 when 'leased' then 1 when 'dispatched' then 2 when 'queued' then 3 else 4 end,
        t.priority desc, t.created_at desc limit 80
    `),
    sql.query(`
      select d.*, p.name as project_name,
        coalesce((select s.status from smoke_checks s where s.deployment_id = d.id order by s.started_at desc limit 1), 'unknown') as smoke_status
      from deployment_previews d join projects p on p.id = d.project_id
      order by d.created_at desc limit 30
    `),
  ]);
  const tasks = (taskRows as Row[]).map(mapTask);
  const previews: DeploymentPreview[] = (previewRows as Row[]).map((row) => ({
    id: String(row.id), projectId: String(row.project_id), projectName: String(row.project_name),
    environment: row.environment as DeploymentPreview["environment"], gitSha: row.git_sha ? String(row.git_sha) : null,
    gitRef: row.git_ref ? String(row.git_ref) : null, url: String(row.url), status: row.status as DeploymentPreview["status"],
    qualityStatus: row.quality_status as DeploymentPreview["qualityStatus"], smokeStatus: row.smoke_status as DeploymentPreview["smokeStatus"],
    createdAt: iso(row.created_at),
  }));
  return {
    tasks,
    previews,
    counts: {
      queued: tasks.filter((task) => task.status === "queued" || task.status === "dispatched").length,
      running: tasks.filter((task) => task.status === "leased" || task.status === "running").length,
      blocked: tasks.filter((task) => task.status === "blocked").length,
      readyPreviews: previews.filter((preview) => preview.status === "ready" && preview.smokeStatus === "passed" && preview.qualityStatus === "passed").length,
    },
    deploymentReadiness: readiness,
  };
}

export async function enqueueTask(input: {
  projectId: string | null;
  findingId?: string | null;
  type: AgentTaskType;
  executor?: "worker" | "github_dispatch";
  priority?: number;
  payload: Record<string, unknown>;
  idempotencyKey: string;
  maxAttempts?: number;
}): Promise<string | null> {
  if (!hasDatabase()) return null;
  const rows = await db().query(
    `insert into agent_tasks(project_id,finding_id,task_type,executor,priority,payload,idempotency_key,max_attempts)
     values($1,$2,$3,$4,$5,$6::jsonb,$7,$8)
     on conflict(idempotency_key) do update set priority=greatest(agent_tasks.priority,excluded.priority), payload=excluded.payload
     returning id`,
    [input.projectId, input.findingId ?? null, input.type, input.executor ?? "worker", input.priority ?? 50, JSON.stringify(input.payload), input.idempotencyKey, input.maxAttempts ?? 3],
  );
  return rows[0]?.id ? String(rows[0].id) : null;
}

export async function leaseTask(workerId: string, acceptedTypes: AgentTaskType[]): Promise<{ task: AgentTask; leaseToken: string } | null> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  const leaseToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(leaseToken).digest("hex");
  const rows = await db().query(
    `with candidate as (
       select id from agent_tasks
       where executor = 'worker'
         and ((status = 'queued' and available_at <= now()) or (status in ('leased','running') and leased_until < now()))
         and attempt < max_attempts
         and (cardinality($1::text[]) = 0 or task_type = any($1::text[]))
       order by priority desc, created_at asc for update skip locked limit 1
     )
     update agent_tasks t set status='leased', lease_owner=$2, lease_token_hash=$3, leased_until=now()+interval '15 minutes',
       attempt=t.attempt+1, started_at=coalesce(t.started_at,now()), last_error=null
     from candidate where t.id=candidate.id
     returning t.*`,
    [acceptedTypes, workerId, tokenHash],
  );
  if (!rows[0]) return null;
  const row = rows[0] as Row;
  const projectRows = row.project_id
    ? await db().query("select name as project_name, repository_full_name from projects where id=$1", [row.project_id])
    : [];
  return { task: mapTask({ ...row, ...(projectRows[0] ?? {}) }), leaseToken };
}

export async function startTask(id: string, leaseToken: string, externalUrl?: string): Promise<boolean> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  const tokenHash = createHash("sha256").update(leaseToken).digest("hex");
  const rows = await db().query(
    `update agent_tasks set status='running', leased_until=now()+interval '15 minutes', external_url=coalesce($3,external_url)
     where id=$1 and status in ('leased','dispatched') and lease_token_hash=$2 and leased_until>now() returning id`,
    [id, tokenHash, externalUrl ?? null],
  );
  return rows.length === 1;
}

export async function completeTask(input: { id: string; leaseToken: string; outcome: "succeeded" | "failed"; result: Record<string, unknown>; error?: string }): Promise<"succeeded" | "queued" | "blocked"> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  const sql = db();
  const tokenHash = createHash("sha256").update(input.leaseToken).digest("hex");
  const rows = await sql.query(
    `update agent_tasks set
       status=case when $3='succeeded' then 'succeeded' when attempt>=max_attempts then 'blocked' else 'queued' end,
       result=$4::jsonb, last_error=$5, completed_at=case when $3='succeeded' or attempt>=max_attempts then now() else null end,
       available_at=case when $3='failed' and attempt<max_attempts then now()+(least(attempt,5)*interval '5 minutes') else available_at end,
       lease_token_hash=null, leased_until=null
     where id=$1 and status in ('leased','running','dispatched') and lease_token_hash=$2 and leased_until>now()
     returning *`,
    [input.id, tokenHash, input.outcome, JSON.stringify(input.result), input.error ?? null],
  );
  if (!rows[0]) throw new Error("Task lease is invalid or expired");
  const task = rows[0] as Row;
  const status = task.status as "succeeded" | "queued" | "blocked";
  if (task.finding_id) {
    await sql.query(
      `update findings set status=$2, retry_count=$3 where id=$1`,
      [task.finding_id, status === "succeeded" ? "resolved" : status === "blocked" ? "blocked" : "fixing", task.attempt],
    );
  }
  if (status === "blocked") {
    await sql.query(
      `insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
       values($1,$2,'risk_acceptance','Automation exhausted its retry budget',$3,$4,$5,'pending',true,'agent-runtime')
       on conflict(id) do nothing`,
      [`task:${input.id}:risk`, task.project_id, input.error ?? "The worker failed without a diagnostic.", "Accept the risk, change scope, or assign a human fix.", `Task ${task.task_type} failed after ${task.attempt} attempts.`],
    );
  }
  if (task.task_type === "quality" && task.project_id && status === "succeeded") {
    const reportedGate = input.result.gateStatus;
    const gateStatus = reportedGate === "passed" || reportedGate === "failed" || reportedGate === "needs_evidence" ? reportedGate : "needs_evidence";
    await sql.query(`update projects set gate_status=$2,phase=case when $2='passed' then 'preview' else 'quality' end where id=$1`, [task.project_id, gateStatus]);
  }
  if (task.task_type === "smoke") {
    const payload = typeof task.payload === "object" && task.payload ? task.payload as Record<string, unknown> : {};
    const deploymentId = typeof payload.deploymentId === "string" ? payload.deploymentId : null;
    if (deploymentId) {
      const smokeStatus = status === "succeeded" ? "passed" : "failed";
      await sql.query(
        `insert into smoke_checks(deployment_id,task_id,status,checks,duration_ms,external_url,started_at,completed_at)
         values($1,$2,$3,$4::jsonb,$5,$6,coalesce($7::timestamptz,now()),now())`,
        [deploymentId, input.id, smokeStatus, JSON.stringify(input.result.checks ?? []), input.result.durationMs ?? null, input.result.externalUrl ?? null, task.started_at ?? null],
      );
      const reportedQuality = input.result.qualityStatus;
      let qualityStatus = reportedQuality === "passed" || reportedQuality === "failed" || reportedQuality === "needs_evidence"
        ? reportedQuality : status === "succeeded" ? "needs_evidence" : "failed";
      if (qualityStatus === "passed" && task.project_id) {
        const projectRows = await sql.query(
          `select p.gate_status,
             (select q.output->>'status'
              from quality_runs q
              where q.project_id=p.id and q.source='archic-rubric'
              order by q.started_at desc
              limit 1) as archic_status
           from projects p where p.id=$1`,
          [task.project_id],
        );
        const project = projectRows[0] as Row | undefined;
        const rubricReady = project?.archic_status === "CLIENT_READY" || project?.archic_status === "FLAGSHIP_READY";
        if (project?.gate_status !== "passed" || !rubricReady) qualityStatus = "needs_evidence";
      }
      await sql.query(`update deployment_previews set quality_status=$2 where id=$1`, [deploymentId, qualityStatus]);
      if (status === "succeeded" && qualityStatus === "passed" && task.project_id) {
        await sql.query(
          `insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
           values($1,$2,'final_approval','Approve validated preview',$3,$4,$5,'pending',true,'quality-gate')
           on conflict(id) do nothing`,
          [`preview:${deploymentId}:approval`, task.project_id, `Preview ${deploymentId} passed Quality Gate, Archic Rubric, project journeys and smoke tests.`, "Approve this exact artifact for promotion to main/production.", "Approval promotes an immutable, already-tested artifact."],
        );
        await sql.query(`update projects set phase='approval' where id=$1`, [task.project_id]);
      }
    }
  }
  const previewUrl = typeof input.result.previewUrl === "string" ? input.result.previewUrl : null;
  if (status === "succeeded" && previewUrl && task.project_id) {
    const previewId = `agent:${input.id}`;
    await sql.query(
      `insert into deployment_previews(id,project_id,environment,git_sha,git_ref,url,status,quality_status,ready_at)
       values($1,$2,'preview',$3,$4,$5,'ready','running',now())
       on conflict(id) do update set url=excluded.url,status='ready',updated_at=now()`,
      [previewId, task.project_id, input.result.gitSha ?? null, input.result.gitRef ?? null, previewUrl],
    );
    await enqueueTask({ projectId: String(task.project_id), type: "smoke", executor: "worker", priority: 95,
      payload: { summary: `Smoke test ${previewUrl}`, deploymentId: previewId, baseUrl: previewUrl }, idempotencyKey: `smoke:${previewId}` });
  }
  await sql.query(`insert into audit_log(actor,action,entity_type,entity_id,metadata) values($1,$2,'agent_task',$3,$4::jsonb)`,
    [String(task.lease_owner ?? "worker"), `task.${status}`, input.id, JSON.stringify({ attempt: task.attempt, error: input.error ?? null })]);
  return status;
}

export async function dispatchQueuedTasks(limit = 10): Promise<{ dispatched: number; failed: number }> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  if (!isGithubAutomationConfigured()) throw new Error("GitHub automation is not configured");
  const sql = db();
  const rows = await sql.query(
    `select t.*, p.repository_full_name from agent_tasks t join projects p on p.id=t.project_id
     where t.executor='github_dispatch' and t.status='queued' and t.available_at<=now() and t.attempt<t.max_attempts
     order by t.priority desc,t.created_at asc limit $1`, [Math.min(Math.max(limit, 1), 25)],
  );
  let dispatched = 0;
  let failed = 0;
  for (const row of rows as Row[]) {
    const callbackToken = randomBytes(32).toString("base64url");
    const callbackTokenHash = createHash("sha256").update(callbackToken).digest("hex");
    try {
      const claimed = await sql.query(`update agent_tasks set status='dispatched',attempt=attempt+1,started_at=coalesce(started_at,now()),leased_until=now()+interval '30 minutes',lease_owner='github-actions',lease_token_hash=$2 where id=$1 and status='queued' returning id`, [row.id, callbackTokenHash]);
      if (!claimed[0]) continue;
      await dispatchRepositoryTask(String(row.repository_full_name), {
        taskId: String(row.id), taskType: String(row.task_type), projectId: row.project_id ? String(row.project_id) : null,
        attempt: number(row.attempt) + 1, input: row.payload, callbackToken,
      });
      dispatched += 1;
    } catch (error) {
      await sql.query(`update agent_tasks set last_error=$2,available_at=now()+interval '10 minutes',lease_token_hash=null,leased_until=null,
        status=case when attempt>=max_attempts then 'blocked' else 'queued' end where id=$1 and status='dispatched'`, [row.id, error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000)]);
      failed += 1;
    }
  }
  return { dispatched, failed };
}
