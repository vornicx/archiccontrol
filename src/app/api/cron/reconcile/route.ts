import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });
  const sql = db();
  const expiredRows = await sql.query(`
    update agent_tasks set
      status=case when attempt>=max_attempts then 'blocked' else 'queued' end,
      available_at=case when attempt>=max_attempts then available_at else now()+interval '5 minutes' end,
      last_error=coalesce(last_error,'Worker lease expired before completion'),
      lease_token_hash=null, leased_until=null
    where status in ('leased','running','dispatched') and leased_until<now()
    returning id,status,finding_id
  `);
  await sql.query(`
    update findings f set status='blocked',retry_count=t.attempt
    from agent_tasks t where t.finding_id=f.id and t.status='blocked'
  `);
  const findingRows = await sql.query(`
    insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
    select
      f.id || ':risk',
      f.project_id,
      'risk_acceptance',
      'Automation exhausted its retry budget',
      f.title || ': ' || f.detail,
      'Choose whether to accept the risk, change scope, or assign a human fix.',
      'The quality pipeline is blocked after three automated attempts.',
      'pending',
      true,
      'reconciler'
    from findings f
    where f.status = 'blocked' and f.retry_count >= 3
    on conflict(id) do nothing
    returning id
  `);
  const taskRows = await sql.query(`
    insert into decisions(id,project_id,type,title,context,recommendation,risk,status,blocking,requested_by)
    select
      'task:' || t.id || ':risk', t.project_id, 'risk_acceptance', 'Automation exhausted its retry budget',
      coalesce(t.last_error,'Task failed without a diagnostic.'),
      'Choose whether to accept the risk, change scope, or assign a human fix.',
      'The autonomous task ' || t.task_type || ' is blocked after ' || t.attempt || ' attempts.',
      'pending', true, 'reconciler'
    from agent_tasks t where t.status='blocked'
    on conflict(id) do nothing returning id
  `);
  return NextResponse.json({ ok: true, recovered: expiredRows.filter((row) => row.status === "queued").length, blocked: expiredRows.filter((row) => row.status === "blocked").length, escalated: findingRows.length + taskRows.length });
}

export const GET = POST;
