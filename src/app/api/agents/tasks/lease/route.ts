import { NextResponse } from "next/server";
import { z } from "zod";
import { leaseTask } from "@/lib/automation-repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";

const bodySchema = z.object({
  workerId: z.string().min(3).max(120).regex(/^[A-Za-z0-9_.:-]+$/),
  acceptedTypes: z.array(z.enum(["research", "implement", "autofix", "quality", "playwright", "benchmark", "preview", "smoke", "monitor"])).max(9).default([]),
});

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.AGENT_SECRET)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid lease request", issues: parsed.error.issues }, { status: 400 });
  const lease = await leaseTask(parsed.data.workerId, parsed.data.acceptedTypes);
  return lease ? NextResponse.json(lease) : new NextResponse(null, { status: 204 });
}

