import "server-only";
import { enqueueTask } from "@/lib/automation-repository";
import { db } from "@/lib/db";

type GithubPayload = {
  action?: string;
  repository?: { full_name?: string };
  pull_request?: { number?: number; html_url?: string; merged?: boolean; head?: { sha?: string; ref?: string }; base?: { ref?: string } };
  workflow_run?: { id?: number; name?: string; status?: string; conclusion?: string | null; html_url?: string; head_sha?: string; head_branch?: string };
  deployment?: { id?: number; environment?: string; sha?: string; ref?: string; payload?: Record<string, unknown> };
  deployment_status?: { id?: number; state?: string; target_url?: string; environment_url?: string; description?: string };
  check_run?: { id?: number; name?: string; status?: string; conclusion?: string | null; html_url?: string; head_sha?: string };
  ref?: string;
  after?: string;
};

function runStatus(status?: string, conclusion?: string | null): "queued" | "running" | "succeeded" | "failed" | "cancelled" {
  if (status !== "completed") return status === "queued" || status === "requested" || status === "waiting" ? "queued" : "running";
  if (conclusion === "success" || conclusion === "neutral" || conclusion === "skipped") return "succeeded";
  if (conclusion === "cancelled") return "cancelled";
  return "failed";
}

function safeUrl(...values: Array<string | undefined>): string | null {
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.protocol === "https:") return url.toString();
    } catch { /* Ignore malformed provider URLs. */ }
  }
  return null;
}

export async function processGithubEvent(eventType: string, payload: GithubPayload, projectId: string | null, eventId: string): Promise<string[]> {
  if (!projectId) return ["stored_unmatched_repository"];
  const sql = db();
  const actions: string[] = [];

  if (eventType === "pull_request" && payload.pull_request?.number) {
    const pull = payload.pull_request;
    const status = payload.action === "closed" ? (pull.merged ? "succeeded" : "cancelled") : "running";
    await sql.query(
      `insert into workflow_runs(id,project_id,workflow,stage,status,summary,external_url,started_at,completed_at)
       values($1,$2,'GitHub pull request','development',$3,$4,$5,now(),case when $3 in ('succeeded','cancelled') then now() else null end)
       on conflict(id) do update set status=excluded.status,summary=excluded.summary,external_url=excluded.external_url,completed_at=excluded.completed_at`,
      [`github:pr:${projectId}:${pull.number}`, projectId, status, `PR #${pull.number} · ${payload.action ?? "updated"}`, pull.html_url ?? null],
    );
    await sql.query(`update projects set phase=$2 where id=$1`, [projectId, pull.merged && pull.base?.ref === "main" ? "preview" : "development"]);
    actions.push("pull_request_synced");
    if (payload.action === "ready_for_review" || payload.action === "synchronize") {
      await enqueueTask({ projectId, type: "quality", executor: "github_dispatch", priority: 90,
        payload: { summary: `Run Quality Gate for PR #${pull.number}`, pullRequest: pull.number, gitSha: pull.head?.sha, gitRef: pull.head?.ref },
        idempotencyKey: `quality:${projectId}:${pull.head?.sha ?? pull.number}` });
      actions.push("quality_task_enqueued");
    }
  }

  if (eventType === "workflow_run" && payload.workflow_run?.id) {
    const run = payload.workflow_run;
    const status = runStatus(run.status, run.conclusion);
    await sql.query(
      `insert into workflow_runs(id,project_id,workflow,stage,status,summary,external_url,started_at,completed_at)
       values($1,$2,$3,'ci',$4,$5,$6,now(),case when $4 in ('succeeded','failed','cancelled') then now() else null end)
       on conflict(id) do update set status=excluded.status,summary=excluded.summary,external_url=excluded.external_url,completed_at=excluded.completed_at`,
      [`github:workflow:${run.id}`, projectId, run.name ?? "GitHub Actions", status, `${run.head_branch ?? "branch"} · ${run.conclusion ?? run.status ?? "running"}`, run.html_url ?? null],
    );
    actions.push("workflow_run_synced");
  }

  if (eventType === "check_run" && payload.check_run?.id) {
    const check = payload.check_run;
    const status = runStatus(check.status, check.conclusion);
    await sql.query(
      `insert into workflow_runs(id,project_id,workflow,stage,status,summary,external_url,started_at,completed_at)
       values($1,$2,$3,'checks',$4,$5,$6,now(),case when $4 in ('succeeded','failed','cancelled') then now() else null end)
       on conflict(id) do update set status=excluded.status,summary=excluded.summary,external_url=excluded.external_url,completed_at=excluded.completed_at`,
      [`github:check:${check.id}`, projectId, check.name ?? "GitHub check", status, check.conclusion ?? check.status ?? null, check.html_url ?? null],
    );
    actions.push("check_run_synced");
  }

  if (eventType === "deployment_status" && payload.deployment?.id && payload.deployment_status) {
    const deployment = payload.deployment;
    const statusEvent = payload.deployment_status;
    const environment = (deployment.environment ?? "preview").toLowerCase().includes("production") ? "production" : "preview";
    const state = statusEvent.state === "success" ? "ready" : statusEvent.state === "failure" || statusEvent.state === "error" ? "failed" : "building";
    const url = safeUrl(statusEvent.environment_url, statusEvent.target_url);
    if (url) {
      const deploymentId = `github:${deployment.id}`;
      await sql.query(
        `insert into deployment_previews(id,project_id,provider,environment,git_sha,git_ref,url,status,source_event_id,ready_at)
         values($1,$2,'github',$3,$4,$5,$6,$7,$8,case when $7='ready' then now() else null end)
         on conflict(id) do update set url=excluded.url,status=excluded.status,ready_at=coalesce(excluded.ready_at,deployment_previews.ready_at),updated_at=now()`,
        [deploymentId, projectId, environment, deployment.sha ?? null, deployment.ref ?? null, url, state, eventId],
      );
      actions.push("deployment_synced");
      if (state === "ready") {
        await enqueueTask({ projectId, type: "smoke", executor: "worker", priority: 98,
          payload: { summary: `Smoke test ${environment} deployment`, deploymentId, baseUrl: url, environment },
          idempotencyKey: `smoke:${deploymentId}` });
        if (environment === "production") {
          const approvals = await sql.query(`select id from decisions where project_id=$1 and type='final_approval' and status='approved' and resolved_at>now()-interval '48 hours' order by resolved_at desc limit 1`, [projectId]);
          if (!approvals[0]) {
            await sql.query(
              `insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
               values($1,$2,'risk_acceptance','Production observed without a matching approval',$3,$4,$5,'pending',true,'deployment-policy')
               on conflict(id) do nothing`,
              [`deployment:${deploymentId}:risk`, projectId, `Deployment ${deploymentId} is live at ${url}, but Control found no final approval in the preceding 48 hours.`, "Confirm the exception or initiate rollback.", "An artifact may have crossed the protected human boundary without recorded approval."],
            );
            actions.push("unapproved_production_escalated");
          }
          await sql.query(`update projects set phase='monitoring' where id=$1`, [projectId]);
        } else {
          await sql.query(`update projects set phase='preview' where id=$1`, [projectId]);
        }
        actions.push("smoke_task_enqueued");
      }
    }
  }

  if (eventType === "push" && payload.ref === "refs/heads/main") {
    await enqueueTask({ projectId, type: "monitor", executor: "worker", priority: 85,
      payload: { summary: "Monitor main after push", gitSha: payload.after }, idempotencyKey: `monitor:${projectId}:${payload.after ?? eventId}` });
    actions.push("main_push_monitor_enqueued");
  }
  return actions.length ? actions : ["stored_no_handler"];
}
