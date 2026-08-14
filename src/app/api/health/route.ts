import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { qualityStandard } from "@/quality/standard";

export const runtime = "nodejs";

export async function GET() {
  const ready = hasDatabase() || process.env.NODE_ENV !== "production";
  return NextResponse.json({
    ok: ready,
    service: "archic-control",
    standardVersion: qualityStandard.version,
    persistence: hasDatabase() ? "postgres" : "bootstrap",
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503 });
}
