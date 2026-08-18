import { NextResponse } from "next/server";
import { z } from "zod";
import { ingestRubricReview } from "@/quality/rubric-repository";
import { reviewPreviewWithGoldenSet, rubricPageEvidenceSchema } from "@/quality/reviewer";
import { authorizeRubricTask } from "@/quality/reviewer-task";

export const runtime = "nodejs";
export const maxDuration = 120;

const bodySchema = z.object({
  leaseToken: z.string().min(20).max(500),
  pages: z.array(rubricPageEvidenceSchema).min(1).max(4),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid rubric evidence", issues: body.error.issues }, { status: 400 });

  try {
    const task = await authorizeRubricTask(id, body.data.leaseToken);
    if (!task) return NextResponse.json({ error: "Rubric task lease is invalid or expired" }, { status: 409 });
    const review = await reviewPreviewWithGoldenSet({ task, pages: body.data.pages });
    const report = await ingestRubricReview(review);
    return NextResponse.json({ review, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rubric review failed";
    const status = message.includes("OPENAI_API_KEY") ? 503 : message.includes("OpenAI quality review failed") ? 502 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
