import { NextResponse } from "next/server";
import { benchmarkReportSchema } from "@/lib/benchmark-schema";
import { ingestBenchmark } from "@/lib/repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.INTEGRATION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const parsed = benchmarkReportSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid benchmark report", details: parsed.error.flatten() }, { status: 400 });
  }
  const result = await ingestBenchmark(parsed.data);
  return NextResponse.json({ ok: true, ...result });
}
