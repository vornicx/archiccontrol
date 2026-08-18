import { NextResponse } from "next/server";
import { verifyBearer } from "@/lib/security";
import { qualityReviewInputSchema, qualityRubric } from "@/quality/rubric";
import { ingestRubricReview } from "@/quality/rubric-repository";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  return verifyBearer(request, process.env.INTEGRATION_SECRET);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    name: qualityRubric.name,
    version: qualityRubric.version,
    principle: qualityRubric.principle,
    criteria: qualityRubric.criteria,
    pageModes: qualityRubric.page_modes,
    hardGates: qualityRubric.hard_gates,
    sectionScoring: qualityRubric.section_scoring,
    aiSlopDetector: qualityRubric.ai_slop_detector,
    approvalRules: qualityRubric.approval_rules,
    goldenReferences: qualityRubric.golden_references,
  });
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = qualityReviewInputSchema.safeParse(await request.json());
  if (!input.success) {
    return NextResponse.json({ error: "Invalid rubric review", issues: input.error.issues }, { status: 400 });
  }
  try {
    return NextResponse.json(await ingestRubricReview(input.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rubric ingestion failed";
    const status = message === "Project not found" ? 404 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
