import { NextResponse } from "next/server";
import { z } from "zod";
import { startTask } from "@/lib/automation-repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";
const bodySchema = z.object({ leaseToken: z.string().min(32), externalUrl: z.string().url().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const machineAuthorized = verifyBearer(request, process.env.AGENT_SECRET);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid start request" }, { status: 400 });
  const { id } = await context.params;
  const started = await startTask(id, parsed.data.leaseToken, parsed.data.externalUrl);
  if (!started) {
    return NextResponse.json(
      { error: machineAuthorized ? "Task lease is invalid or expired" : "Unauthorized" },
      { status: machineAuthorized ? 409 : 401 },
    );
  }
  return NextResponse.json({ ok: true });
}
