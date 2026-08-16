import { NextResponse } from "next/server";
import { z } from "zod";
import { isAutofixContextPath, normalizeAutofixPath } from "@/autofix/policy";
import { planAutofix } from "@/autofix/planner";
import { authorizeAutofixTask } from "@/autofix/task";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  leaseToken: z.string().min(32).max(256),
  round: z.union([z.literal(1), z.literal(2)]),
  fileIndex: z.array(z.string().min(1).max(300)).max(700),
  files: z.array(z.object({
    path: z.string().min(1).max(300),
    content: z.string().max(80_000),
  })).min(1).max(18),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid autofix planning request", issues: parsed.error.issues }, { status: 400 });
  }

  const { id } = await context.params;
  const task = await authorizeAutofixTask(id, parsed.data.leaseToken);
  if (!task) return NextResponse.json({ error: "Unauthorized or expired autofix task" }, { status: 401 });

  const fileIndex = Array.from(new Set(parsed.data.fileIndex
    .map(normalizeAutofixPath)
    .filter((path): path is string => Boolean(path) && isAutofixContextPath(path as string))))
    .slice(0, 700);

  const seen = new Set<string>();
  const files = parsed.data.files.flatMap((file) => {
    const path = normalizeAutofixPath(file.path);
    if (!path || seen.has(path) || !fileIndex.includes(path) || !isAutofixContextPath(path)) return [];
    seen.add(path);
    return [{ path, content: file.content }];
  });

  const totalBytes = files.reduce((sum, file) => sum + Buffer.byteLength(file.content, "utf8"), 0);
  if (!files.length || totalBytes > 180_000) {
    return NextResponse.json({ error: "Autofix context is empty or exceeds the 180 KB safety limit" }, { status: 413 });
  }

  try {
    const plan = await planAutofix({ task, fileIndex, files, round: parsed.data.round });
    return NextResponse.json({ ok: true, plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: message.includes("OPENAI_API_KEY") ? 503 : 502 });
  }
}
