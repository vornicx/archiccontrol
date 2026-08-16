import "server-only";
import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";

type Row = Record<string, unknown>;

export interface AuthorizedAutofixTask {
  id: string;
  projectId: string;
  repositoryFullName: string;
  findingId: string | null;
  payload: Record<string, unknown>;
}

export async function authorizeAutofixTask(id: string, leaseToken: string): Promise<AuthorizedAutofixTask | null> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  const tokenHash = createHash("sha256").update(leaseToken).digest("hex");
  const rows = await db().query(
    `select t.id,t.project_id,t.finding_id,t.payload,p.repository_full_name
     from agent_tasks t
     join projects p on p.id=t.project_id
     where t.id=$1
       and t.task_type='autofix'
       and t.status in ('dispatched','running')
       and t.lease_token_hash=$2
       and t.leased_until>now()
     limit 1`,
    [id, tokenHash],
  );
  if (!rows[0]) return null;
  const row = rows[0] as Row;
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    repositoryFullName: String(row.repository_full_name),
    findingId: row.finding_id ? String(row.finding_id) : null,
    payload: typeof row.payload === "object" && row.payload ? row.payload as Record<string, unknown> : {},
  };
}

export async function recordAutofixPullRequest(id: string, pullRequestUrl: string): Promise<void> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  await db().query(
    `update agent_tasks
     set external_url=$2,
         result=coalesce(result,'{}'::jsonb) || jsonb_build_object('pullRequestUrl',$2)
     where id=$1 and task_type='autofix'`,
    [id, pullRequestUrl],
  );
}

export async function preserveAutofixFinding(id: string, status: "succeeded" | "queued" | "blocked"): Promise<void> {
  if (!hasDatabase() || status !== "succeeded") return;
  await db().query(
    `update findings f
     set status='fixing'
     from agent_tasks t
     where t.id=$1
       and t.task_type='autofix'
       and t.finding_id=f.id
       and t.status='succeeded'`,
    [id],
  );
}
