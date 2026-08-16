import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/security";
import { dispatchReadyTasks } from "@/lib/safe-dispatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await dispatchReadyTasks()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dispatch failed";
    return NextResponse.json({ error: message }, { status: message.includes("configured") ? 503 : 500 });
  }
}

export const GET = POST;
