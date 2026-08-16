import { NextResponse } from "next/server";
import { benchmarkReportSchema } from "@/lib/benchmark-schema";
import { ingestBenchmarkEvidence } from "@/lib/benchmark-sync";
import { verifyBearer } from "@/lib/security";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.INTEGRATION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = benchmarkReportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid benchmark report", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await ingestBenchmarkEvidence(parsed.data);
  dispatchQueuedTasksAfterResponse();
  return NextResponse.json({ ok: true, ...result });
}
