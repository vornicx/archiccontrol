"use server";

import { revalidatePath } from "next/cache";
import { updateProspectManual } from "@/prospecting/repository";
import type { ProspectStatus } from "@/prospecting/types";

const statuses = new Set<ProspectStatus>(["researching", "verified", "ready", "discarded", "blocked"]);

function requiredText(formData: FormData, key: string): string {
  const value = String(formData.get(key) ?? "").trim();
  if (!value) throw new Error(`${key} is required`);
  return value;
}

function optionalText(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function optionalAmount(formData: FormData, key: string): number | null {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  if (!Number.isFinite(value) || value < 0) throw new Error(`${key} must be a positive amount`);
  return Math.round(value * 100) / 100;
}

export async function updateProspectAction(formData: FormData): Promise<void> {
  const status = requiredText(formData, "status") as ProspectStatus;
  if (!statuses.has(status)) throw new Error("Invalid prospect status");

  await updateProspectManual({
    id: requiredText(formData, "prospectId"),
    name: requiredText(formData, "name"),
    city: optionalText(formData, "city"),
    category: optionalText(formData, "category"),
    websiteUrl: optionalText(formData, "websiteUrl"),
    socialUrl: optionalText(formData, "socialUrl"),
    status,
    potentialPrice: optionalAmount(formData, "potentialPrice"),
    maintenanceMonthly: optionalAmount(formData, "maintenanceMonthly"),
    contactName: optionalText(formData, "contactName"),
    contactRole: optionalText(formData, "contactRole"),
    email: optionalText(formData, "email"),
    phone: optionalText(formData, "phone"),
    whatsapp: optionalText(formData, "whatsapp"),
    outreachMessage: optionalText(formData, "outreachMessage"),
    manualNote: optionalText(formData, "manualNote"),
  });

  revalidatePath("/prospects");
}
