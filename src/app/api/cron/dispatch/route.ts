import { NextResponse } from "next/server";
import { dispatchQueuedTasks } from "@/lib/automation-repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await dispatchQueuedTasks()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 500 });
  }
}

export const GET = POST;
