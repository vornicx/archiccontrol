import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { ensureFreshBenchmark } from "@/lib/benchmark-sync";
import { db, hasDatabase } from "@/lib/db";
import { verifyGitHubActionsOidcToken } from "@/lib/github-oidc";
import { isGithubAutomationConfigured } from "@/lib/github-app";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  supportedTaskTypes: z.array(z.literal("autofix")).min(1).max(1),
});

function bearer(request: Request): string | null {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return null;
  const token = authorization.slice(7).trim();
  return token || null;
}

export async function POST(request: Request) {
  const token = bearer(request);
  if (!token) return NextResponse.json({ error: "Missing GitHub OIDC bearer" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid repository lease request" }, { status: 400 });
  if (!hasDatabase()) return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });

  let identity: Awaited<ReturnType<typeof verifyGitHubActionsOidcToken>>;
  try {
    identity = await verifyGitHubActionsOidcToken(token);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid GitHub OIDC identity" }, { status: 401 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ ok: true, task: null, reason: "autofix_not_configured" });
  }
  if (!isGithubAutomationConfigured()) {
    return NextResponse.json({ ok: true, task: null, reason: "github_publication_not_configured" });
  }

  const freshness = await ensureFreshBenchmark();
  if (!freshness.health.fresh) {
    return NextResponse.json({
      ok: true,
      task: null,
      reason: "benchmark_stale",
      detail: freshness.error ?? "Fresh benchmark evidence could not be established.",
      lastBenchmarkAt: freshness.health.lastBenchmarkAt,
    });
  }

  const sql = db();
  const projectRows = await sql.query(
    `select id from projects where repository_full_name=$1 and status='active' limit 1`,
    [identity.repository],
  );
  if (!projectRows[0]) return NextResponse.json({ error: "Repository is not managed by Archic Control" }, { status: 403 });

  const callbackToken = randomBytes(32).toString("base64url");
  const callbackTokenHash = createHash("sha256").update(callbackToken).digest("hex");
  const rows = await sql.query(
    `with candidate as (
       select t.id
       from agent_tasks t
       join projects p on p.id=t.project_id
       where p.repository_full_name=$1
         and p.status='active'
         and t.executor='github_dispatch'
         and t.task_type='autofix'
         and t.status='queued'
         and t.available_at<=now()
         and t.attempt<t.max_attempts
       order by t.priority desc,t.created_at asc
       for update of t skip locked
       limit 1
     )
     update agent_tasks t
     set status='dispatched',
         attempt=attempt+1,
         started_at=coalesce(started_at,now()),
         leased_until=now()+interval '30 minutes',
         lease_owner='github-oidc',
         lease_token_hash=$2,
         last_error=null
     from candidate c
     where t.id=c.id
     returning t.id,t.project_id,t.finding_id,t.task_type,t.priority,t.payload,t.attempt,t.max_attempts`,
    [identity.repository, callbackTokenHash],
  );

  if (!rows[0]) return NextResponse.json({ ok: true, task: null, reason: "queue_clear" });
  const row = rows[0] as Record<string, unknown>;
  await sql.query(
    `insert into audit_log(actor,action,entity_type,entity_id,metadata)
     values($1,'repository_task_lease','agent_task',$2,jsonb_build_object('repository',$3,'event',$4,'runId',$5))`,
    [identity.actor ? `github:${identity.actor}` : "github-actions", row.id, identity.repository, identity.eventName, identity.runId],
  );

  return NextResponse.json({
    ok: true,
    task: {
      id: String(row.id),
      projectId: String(row.project_id),
      findingId: row.finding_id ? String(row.finding_id) : null,
      taskType: String(row.task_type),
      priority: Number(row.priority),
      payload: row.payload,
      attempt: Number(row.attempt),
      maxAttempts: Number(row.max_attempts),
      callbackToken,
      controlUrl: new URL(request.url).origin,
    },
  });
}
