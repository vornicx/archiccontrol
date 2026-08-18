"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { updateSalesContact } from "@/sales/contact-operations";
import { recordSalesActivity, updateSalesNextAction, type SalesActivityType } from "@/sales/crm-operations";
import {
  addSalesContact,
  createSalesLead,
  deleteSalesContact,
  getSalesLead,
  recordSalesOutcome,
  setPrimarySalesContact,
  updateSalesLead,
  updateSalesLeadStage,
  updateSalesPipelineStage,
  type SalesLeadInput,
} from "@/sales/repository";
import {
  salesOutcomes,
  salesStages,
  type SalesOutcome,
  type SalesOwner,
  type SalesStage,
} from "@/sales/types";

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value || null;
}

function numberValue(formData: FormData, key: string): number | null {
  const raw = text(formData, key);
  if (!raw) return null;
  const value = Number(raw.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

function ownerValue(formData: FormData, key: string, fallback: SalesOwner): SalesOwner {
  const value = text(formData, key);
  return value === "vadim" || value === "antero" ? value : fallback;
}

function stageValue(formData: FormData, fallback: SalesStage): SalesStage {
  const value = text(formData, "stage") as SalesStage | null;
  return value && salesStages.includes(value) ? value : fallback;
}

function madridOffsetMinutes(utcMs: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(utcMs));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const localAsUtc = Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second),
  );
  return Math.round((localAsUtc - utcMs) / 60000);
}

function madridLocalToIso(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const localAsUtc = Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  let offset = madridOffsetMinutes(localAsUtc);
  let actual = localAsUtc - offset * 60_000;
  offset = madridOffsetMinutes(actual);
  actual = localAsUtc - offset * 60_000;
  return new Date(actual).toISOString();
}

function readLeadInput(formData: FormData, fallback?: { stage: SalesStage; owner: SalesOwner; nextActionOwner: SalesOwner; contactName: string | null; phone: string | null; email: string | null }): SalesLeadInput {
  const name = text(formData, "name");
  if (!name) throw new Error("El nombre del prospecto es obligatorio");
  const score = numberValue(formData, "score");
  return {
    name,
    city: text(formData, "city"),
    category: text(formData, "category"),
    stage: stageValue(formData, fallback?.stage ?? "researched"),
    score: score == null ? null : Math.max(0, Math.min(100, score)),
    estimatedValue: numberValue(formData, "estimatedValue"),
    quotedPrice: numberValue(formData, "quotedPrice"),
    maintenanceMonthly: numberValue(formData, "maintenanceMonthly"),
    source: text(formData, "source"),
    contactName: text(formData, "contactName") ?? fallback?.contactName ?? null,
    phone: text(formData, "phone") ?? fallback?.phone ?? null,
    email: text(formData, "email") ?? fallback?.email ?? null,
    websiteUrl: text(formData, "websiteUrl"),
    socialUrl: text(formData, "socialUrl"),
    prototypeUrl: text(formData, "prototypeUrl"),
    repositoryFullName: text(formData, "repositoryFullName"),
    owner: ownerValue(formData, "owner", fallback?.owner ?? "antero"),
    nextActionOwner: ownerValue(formData, "nextActionOwner", fallback?.nextActionOwner ?? "antero"),
    nextAction: text(formData, "nextAction"),
    nextActionAt: madridLocalToIso(text(formData, "nextActionAt")),
    notes: text(formData, "notes"),
  };
}

function revalidateSales(leadId?: string) {
  revalidatePath("/");
  revalidatePath("/sales");
  revalidatePath("/sales/opportunities");
  revalidatePath("/sales/pipeline");
  revalidatePath("/sales/follow-ups");
  revalidatePath("/sales/performance");
  revalidatePath("/sales/pipeline/settings");
  if (leadId) revalidatePath(`/sales/leads/${leadId}`);
}

export async function createLeadAction(formData: FormData): Promise<void> {
  const input = readLeadInput(formData);
  const lead = await createSalesLead(input);
  if (input.contactName) {
    await addSalesContact({
      leadId: lead.id,
      name: input.contactName,
      role: text(formData, "contactRole"),
      phone: input.phone,
      email: input.email,
      whatsapp: text(formData, "whatsapp"),
      notes: null,
      isPrimary: true,
    });
  }
  revalidateSales(lead.id);
  redirect(`/sales/leads/${lead.id}`);
}

export async function updateLeadAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  if (!leadId) return;
  const current = await getSalesLead(leadId);
  if (!current.lead) return;
  const input = readLeadInput(formData, {
    stage: current.lead.stage,
    owner: current.lead.owner,
    nextActionOwner: current.lead.nextActionOwner,
    contactName: current.lead.contactName,
    phone: current.lead.phone,
    email: current.lead.email,
  });
  await updateSalesLead(leadId, input, "vadim");
  revalidateSales(leadId);
  redirect(`/sales/leads/${leadId}`);
}

export async function updateStageAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const rawStage = text(formData, "stage") as SalesStage | null;
  if (!leadId || !rawStage || !salesStages.includes(rawStage)) return;
  await updateSalesLeadStage(leadId, rawStage, "vadim");
  revalidateSales(leadId);
}

export async function updateNextActionAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  if (!leadId) return;
  await updateSalesNextAction({
    leadId,
    nextAction: text(formData, "nextAction"),
    nextActionOwner: ownerValue(formData, "nextActionOwner", "antero"),
    nextActionAt: madridLocalToIso(text(formData, "nextActionAt")),
    actor: ownerValue(formData, "actor", "vadim"),
  });
  revalidateSales(leadId);
}

export async function recordActivityAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const note = text(formData, "note");
  const rawType = text(formData, "type");
  const allowed: SalesActivityType[] = ["call", "message", "email", "note"];
  const type = allowed.includes(rawType as SalesActivityType) ? rawType as SalesActivityType : "note";
  if (!leadId || !note) return;
  await recordSalesActivity({
    leadId,
    type,
    note,
    actor: ownerValue(formData, "actor", "vadim"),
  });
  revalidateSales(leadId);
}

export async function addContactAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const name = text(formData, "name");
  if (!leadId || !name) return;
  await addSalesContact({
    leadId,
    name,
    role: text(formData, "role"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    whatsapp: text(formData, "whatsapp"),
    notes: text(formData, "notes"),
    isPrimary: formData.get("isPrimary") === "on",
  });
  revalidateSales(leadId);
}

export async function updateContactAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const contactId = text(formData, "contactId");
  const name = text(formData, "name");
  if (!leadId || !contactId || !name) return;
  await updateSalesContact({
    leadId,
    contactId,
    name,
    role: text(formData, "role"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    whatsapp: text(formData, "whatsapp"),
    notes: text(formData, "notes"),
    isPrimary: formData.get("isPrimary") === "on",
    wasPrimary: formData.get("wasPrimary") === "true",
  });
  revalidateSales(leadId);
}

export async function setPrimaryContactAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const contactId = text(formData, "contactId");
  if (!leadId || !contactId) return;
  await setPrimarySalesContact(leadId, contactId);
  revalidateSales(leadId);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const leadId = text(formData, "leadId");
  const contactId = text(formData, "contactId");
  if (!leadId || !contactId) return;
  await deleteSalesContact(leadId, contactId);
  revalidateSales(leadId);
}

export async function updatePipelineStageAction(formData: FormData): Promise<void> {
  const rawKey = text(formData, "key") as SalesStage | null;
  const label = text(formData, "label");
  if (!rawKey || !salesStages.includes(rawKey) || !label) return;
  await updateSalesPipelineStage({
    key: rawKey,
    label,
    position: Math.max(0, Math.round(numberValue(formData, "position") ?? 0)),
    active: formData.get("active") === "on",
    probability: Math.max(0, Math.min(100, Math.round(numberValue(formData, "probability") ?? 0))),
  });
  revalidateSales();
}

export async function recordOutcomeAction(formData: FormData): Promise<void> {
  const leadId = String(formData.get("leadId") ?? "").trim();
  const outcome = String(formData.get("outcome") ?? "").trim() as SalesOutcome;
  const noteValue = String(formData.get("note") ?? "").trim();
  if (!leadId || !salesOutcomes.includes(outcome)) return;
  await recordSalesOutcome({ leadId, outcome, note: noteValue || null, actor: "antero" });
  revalidateSales(leadId);
}
