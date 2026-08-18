import "server-only";

import { createHash } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";

type Row = Record<string, unknown>;

export interface AuthorizedRubricTask {
  id: string;
  projectId: string;
  projectName: string;
  repositoryFullName: string;
  benchmarkProfile: string;
  payload: Record<string, unknown>;
}

export async function authorizeRubricTask(id: string, leaseToken: string): Promise<AuthorizedRubricTask | null> {
  if (!hasDatabase()) throw new Error("DATABASE_URL is required");
  const tokenHash = createHash("sha256").update(leaseToken).digest("hex");
  const rows = await db().query(
    `select t.id,t.project_id,t.payload,p.name,p.repository_full_name,p.benchmark_profile
     from agent_tasks t
     join projects p on p.id=t.project_id
     where t.id=$1
       and t.task_type='rubric'
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
    projectName: String(row.name),
    repositoryFullName: String(row.repository_full_name),
    benchmarkProfile: String(row.benchmark_profile),
    payload: typeof row.payload === "object" && row.payload ? row.payload as Record<string, unknown> : {},
  };
}
