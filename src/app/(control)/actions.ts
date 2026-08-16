"use server";

import { revalidatePath } from "next/cache";
import { getBenchmarkHealth } from "@/lib/benchmark-health";
import { resolveDecision } from "@/lib/repository";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";

export async function resolveDecisionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("decisionId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  if (!id || (outcome !== "approved" && outcome !== "rejected")) {
    throw new Error("Invalid decision resolution");
  }

  if (outcome === "approved" && id.startsWith("preview:") && id.endsWith(":approval")) {
    const benchmarkHealth = await getBenchmarkHealth();
    if (!benchmarkHealth.fresh) {
      throw new Error("Final approval is blocked until Archic Control has fresh benchmark evidence.");
    }
  }

  await resolveDecision(id, outcome, note);
  dispatchQueuedTasksAfterResponse();
  revalidatePath("/");
  revalidatePath("/decisions");
}
