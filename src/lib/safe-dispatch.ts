import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { getControlPublicUrl } from "@/lib/control-url";
import { db, hasDatabase } from "@/lib/db";
import {
  dispatchRepositoryTask,
  isGithubAutomationConfigured,
  repositoryTaskReadiness,
} from "@/lib/github-app";

type Row = Record<string, unknown>;

function number(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 2_000) : String(error).slice(0, 2_000);
}

export async function dispatchReadyTasks(
  limit = 10,
): Promise<{ dispatched: number; failed: number; deferred: number }> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  if (!isGithubAutomationConfigured()) throw new Error("GitHub automation is not configured");
  const controlUrl = getControlPublicUrl();

  const sql = db();
  const rows = await sql.query(
    `select t.*, p.repository_full_name
     from agent_tasks t
     join projects p on p.id=t.project_id
     where t.executor='github_dispatch'
       and t.status='queued'
       and t.available_at<=now()
       and t.attempt<t.max_attempts
     order by t.priority desc,t.created_at asc
     limit $1`,
    [Math.min(Math.max(limit, 1), 25)],
  );

  let dispatched = 0;
  let failed = 0;
  let deferred = 0;

  for (const row of rows as Row[]) {
    const repositoryFullName = String(row.repository_full_name);
    const taskType = String(row.task_type);

    let readiness: Awaited<ReturnType<typeof repositoryTaskReadiness>>;
    try {
      readiness = await repositoryTaskReadiness(repositoryFullName, taskType);
    } catch (error) {
      await sql.query(
        `update agent_tasks
         set last_error=$2,available_at=now()+interval '10 minutes'
         where id=$1 and status='queued'`,
        [row.id, `Repository capability check failed: ${message(error)}`],
      );
      failed += 1;
      continue;
    }

    if (!readiness.ready) {
      await sql.query(
        `update agent_tasks
         set last_error=$2,available_at=now()+interval '6 hours'
         where id=$1 and status='queued'`,
        [row.id, readiness.detail],
      );
      deferred += 1;
      continue;
    }

    const callbackToken = randomBytes(32).toString("base64url");
    const callbackTokenHash = createHash("sha256").update(callbackToken).digest("hex");

    try {
      const claimed = await sql.query(
        `update agent_tasks
         set status='dispatched',attempt=attempt+1,started_at=coalesce(started_at,now()),
             leased_until=now()+interval '30 minutes',lease_owner='github-actions',lease_token_hash=$2,last_error=null
         where id=$1 and status='queued'
         returning id`,
        [row.id, callbackTokenHash],
      );
      if (!claimed[0]) continue;

      await dispatchRepositoryTask(repositoryFullName, {
        taskId: String(row.id),
        taskType,
        projectId: row.project_id ? String(row.project_id) : null,
        attempt: number(row.attempt) + 1,
        input: row.payload,
        callbackToken,
        controlUrl,
      });
      dispatched += 1;
    } catch (error) {
      await sql.query(
        `update agent_tasks
         set last_error=$2,available_at=now()+interval '10 minutes',lease_token_hash=null,leased_until=null,
             status=case when attempt>=max_attempts then 'blocked' else 'queued' end
         where id=$1 and status='dispatched'`,
        [row.id, message(error)],
      );
      failed += 1;
    }
  }

  return { dispatched, failed, deferred };
}
