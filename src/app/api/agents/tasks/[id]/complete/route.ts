import { NextResponse } from "next/server";
import { z } from "zod";
import { completeTask } from "@/lib/automation-repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";
const bodySchema = z.object({
  leaseToken: z.string().min(32),
  outcome: z.enum(["succeeded", "failed"]),
  result: z.record(z.string(), z.unknown()).default({}),
  error: z.string().max(2_000).optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!verifyBearer(request, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid completion request", issues: parsed.error.issues }, { status: 400 });
  const { id } = await context.params;
  try {
    const status = await completeTask({ id, ...parsed.data });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("lease")) return NextResponse.json({ error: error.message }, { status: 409 });
    throw error;
  }
}
