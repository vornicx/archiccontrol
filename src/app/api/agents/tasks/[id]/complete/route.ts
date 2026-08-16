import { NextResponse } from "next/server";
import { z } from "zod";
import { preserveAutofixFinding, recordAutofixPullRequest } from "@/autofix/task";
import { completeTask } from "@/lib/automation-repository";
import { verifyBearer } from "@/lib/security";

export const runtime = "nodejs";
const bodySchema = z.object({
  leaseToken: z.string().min(32),
  outcome: z.enum(["succeeded", "failed"]),
  result: z.record(z.string(), z.unknown()).default({}),
  error: z.string().max(2_000).optional(),
});

function safePullRequestUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 500) return null;
  return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/pull\/\d+$/.test(value) ? value : null;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const machineAuthorized = verifyBearer(request, process.env.AGENT_SECRET);
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid completion request", issues: parsed.error.issues }, { status: 400 });
  const { id } = await context.params;
  try {
    const status = await completeTask({ id, ...parsed.data });
    const pullRequestUrl = safePullRequestUrl(parsed.data.result.pullRequestUrl);
    if (status === "succeeded" && pullRequestUrl) {
      await recordAutofixPullRequest(id, pullRequestUrl);
    }
    await preserveAutofixFinding(id, status);
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    if (error instanceof Error && error.message.includes("lease")) {
      return NextResponse.json(
        { error: machineAuthorized ? error.message : "Unauthorized" },
        { status: machineAuthorized ? 409 : 401 },
      );
    }
    throw error;
  }
}
