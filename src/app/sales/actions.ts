"use server";

import { revalidatePath } from "next/cache";
import { recordSalesOutcome } from "@/sales/repository";
import { salesOutcomes, type SalesOutcome } from "@/sales/types";

export async function recordOutcomeAction(formData: FormData): Promise<void> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim() as SalesOutcome;
  const noteValue = String(formData.get("note") ?? "").trim();
  if (!leadId || !salesOutcomes.includes(outcome)) return;
  await recordSalesOutcome({ leadId, outcome, note: noteValue || null, actor: "antero" });
  revalidatePath("/sales");
  revalidatePath("/sales/pipeline");
  revalidatePath("/sales/follow-ups");
  revalidatePath("/sales/performance");
  revalidatePath(`/sales/leads/${leadId}`);
}
