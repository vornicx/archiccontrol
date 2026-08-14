import { NextResponse } from "next/server";
import { z } from "zod";
import { benchmarkSnapshot } from "@/lib/bootstrap";
import { verifyBearer } from "@/lib/security";
import { evaluateQualityGate } from "@/quality/gate";

export const runtime = "nodejs";

const inputSchema = z.object({
  projectId: z.string(),
  manualEvidenceComplete: z.boolean().optional(),
  polishPassed: z.boolean().optional(),
});

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.INTEGRATION_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const input = inputSchema.safeParse(await request.json());
  if (!input.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  const project = benchmarkSnapshot.projects.find((candidate) => candidate.id === input.data.projectId);
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 });
  return NextResponse.json(evaluateQualityGate(project, input.data));
}

