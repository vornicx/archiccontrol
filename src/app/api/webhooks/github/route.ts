import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { hmacHex, secureEqual } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook is not configured" }, { status: 503 });
  const body = await request.text();
  const expected = `sha256=${hmacHex(secret, body)}`;
  const supplied = request.headers.get("x-hub-signature-256") ?? "";
  if (!secureEqual(expected, supplied)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  if (!hasDatabase()) return NextResponse.json({ error: "Persistence is not configured" }, { status: 503 });

  const payload = JSON.parse(body) as { repository?: { full_name?: string } };
  const eventType = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery");
  const repository = payload.repository?.full_name ?? null;
  const sql = db();
  const projectRows = repository
    ? await sql.query("select id from projects where repository_full_name = $1 limit 1", [repository])
    : [];
  const projectId = projectRows[0]?.id ? String(projectRows[0].id) : null;
  await sql.query(
    `insert into integration_events(provider,delivery_id,event_type,project_id,payload,processed_at)
     values('github',$1,$2,$3,$4::jsonb,now())
     on conflict(provider,delivery_id) do nothing`,
    [deliveryId, eventType, projectId, body],
  );
  return NextResponse.json({ ok: true, eventType, projectId });
}

