import { NextResponse } from "next/server";
import { syncBenchmarkFromSource } from "@/lib/benchmark-sync";
import { verifyBearer } from "@/lib/security";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncBenchmarkFromSource();
  if (result.error) {
    return NextResponse.json(
      { error: result.error, source: result.source, health: result.health },
      { status: 502 },
    );
  }

  dispatchQueuedTasksAfterResponse();
  return NextResponse.json({
    ok: true,
    source: result.source,
    ingested: result.ingested,
    health: result.health,
  });
}
