import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";
import { processGithubEvent } from "@/lib/github-events";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";
import { hmacHex, secureEqual } from "@/lib/security";

export const runtime = "nodejs";
export const maxDuration = 60;

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

  let payload: { repository?: { full_name?: string } };
  try {
    payload = JSON.parse(body) as typeof payload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const eventType = request.headers.get("x-github-event") ?? "unknown";
  const deliveryId = request.headers.get("x-github-delivery");
  if (!deliveryId) return NextResponse.json({ error: "Missing GitHub delivery id" }, { status: 400 });
  const repository = payload.repository?.full_name ?? null;
  const sql = db();
  const projectRows = repository
    ? await sql.query("select id from projects where repository_full_name = $1 limit 1", [repository])
    : [];
  const projectId = projectRows[0]?.id ? String(projectRows[0].id) : null;
  const eventRows = await sql.query(
    `insert into integration_events(provider,delivery_id,event_type,project_id,payload,processed_at)
     values('github',$1,$2,$3,$4::jsonb,now())
     on conflict(provider,delivery_id) do nothing returning id`,
    [deliveryId, eventType, projectId, body],
  );
  if (!eventRows[0]) return NextResponse.json({ ok: true, duplicate: true, eventType, projectId });
  const actions = await processGithubEvent(eventType, payload, projectId, String(eventRows[0].id));
  dispatchQueuedTasksAfterResponse();
  return NextResponse.json({ ok: true, eventType, projectId, actions });
}
