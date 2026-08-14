import { NextResponse } from "next/server";
import { benchmarkReportSchema } from "@/lib/benchmark-schema";
import { ingestBenchmark } from "@/lib/repository";
import { verifyBearer } from "@/lib/security";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const source = process.env.BENCHMARK_URL ?? "https://archicbenchmark.vercel.app/api/latest.json";
  const response = await fetch(source, { cache: "no-store", signal: AbortSignal.timeout(25_000) });
  if (!response.ok) {
    return NextResponse.json({ error: "Benchmark source unavailable", status: response.status }, { status: 502 });
  }
  const parsed = benchmarkReportSchema.safeParse(await response.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Benchmark source returned an invalid report" }, { status: 502 });
  }
  const result = await ingestBenchmark(parsed.data);
  dispatchQueuedTasksAfterResponse();
  return NextResponse.json({ ok: true, source, ...result });
}
