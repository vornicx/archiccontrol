"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { resolveDecision } from "@/lib/repository";
import { dispatchQueuedTasksAfterResponse } from "@/lib/event-dispatch";

export async function resolveDecisionAction(formData: FormData): Promise<void> {
  await requireSession();
  const id = String(formData.get("decisionId") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const note = String(formData.get("note") ?? "").slice(0, 1000);
  if (!id || (outcome !== "approved" && outcome !== "rejected")) {
    throw new Error("Invalid decision resolution");
  }
  await resolveDecision(id, outcome, note);
  dispatchQueuedTasksAfterResponse();
  revalidatePath("/");
  revalidatePath("/decisions");
}
