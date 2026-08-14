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
  const rows = await sql.query(`
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
  return NextResponse.json({ ok: true, escalated: rows.length });
}

export const GET = POST;

