import "server-only";
import { randomUUID } from "node:crypto";
import { db, hasDatabase } from "@/lib/db";
import { seedSalesActivities, seedSalesLeads } from "@/sales/seed";
import {
  defaultPipelineStages,
  type SalesActivity,
  type SalesContact,
  type SalesData,
  type SalesLead,
  type SalesOutcome,
  type SalesOwner,
  type SalesPipelineStage,
  type SalesStage,
} from "@/sales/types";

type Row = Record<string, unknown>;

export type SalesLeadInput = {
  name: string;
  city: string | null;
  category: string | null;
  stage: SalesStage;
  score: number | null;
  estimatedValue: number | null;
  quotedPrice: number | null;
  maintenanceMonthly: number | null;
  source: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  websiteUrl: string | null;
  socialUrl: string | null;
  prototypeUrl: string | null;
  repositoryFullName: string | null;
  owner: SalesOwner;
  nextActionOwner: SalesOwner;
  nextAction: string | null;
  nextActionAt: string | null;
  notes: string | null;
};

export type SalesContactInput = {
  leadId: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  isPrimary: boolean;
};

function asIso(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function nullable(value: unknown): string | null {
  return value == null || value === "" ? null : String(value);
}

function mapLead(row: Row): SalesLead {
  return {
    id: String(row.id),
    prospectId: nullable(row.prospect_id),
    name: String(row.name),
    city: nullable(row.city),
    category: nullable(row.category),
    stage: row.stage as SalesStage,
    score: row.score == null ? null : Number(row.score),
    estimatedValue: row.estimated_value == null ? null : Number(row.estimated_value),
    quotedPrice: row.quoted_price == null ? null : Number(row.quoted_price),
    maintenanceMonthly: row.maintenance_monthly == null ? null : Number(row.maintenance_monthly),
    source: nullable(row.source),
    contactName: nullable(row.contact_name),
    phone: nullable(row.phone),
    email: nullable(row.email),
    websiteUrl: nullable(row.website_url),
    socialUrl: nullable(row.social_url),
    prototypeUrl: nullable(row.prototype_url),
    repositoryFullName: nullable(row.repository_full_name),
    owner: row.owner as SalesOwner,
    nextActionOwner: row.next_action_owner as SalesOwner,
    nextAction: nullable(row.next_action),
    nextActionAt: row.next_action_at == null ? null : asIso(row.next_action_at),
    lastContactAt: row.last_contact_at == null ? null : asIso(row.last_contact_at),
    notes: nullable(row.notes),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapContact(row: Row): SalesContact {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    name: String(row.name),
    role: nullable(row.role),
    phone: nullable(row.phone),
    email: nullable(row.email),
    whatsapp: nullable(row.whatsapp),
    notes: nullable(row.notes),
    isPrimary: Boolean(row.is_primary),
    createdAt: asIso(row.created_at),
    updatedAt: asIso(row.updated_at),
  };
}

function mapPipelineStage(row: Row): SalesPipelineStage {
  return {
    key: row.key as SalesStage,
    label: String(row.label),
    position: Number(row.position),
    active: Boolean(row.active),
    probability: Number(row.probability),
    terminal: Boolean(row.terminal),
  };
}

function mapActivity(row: Row): SalesActivity {
  return {
    id: String(row.id),
    leadId: String(row.lead_id),
    type: row.type as SalesActivity["type"],
    outcome: row.outcome == null ? null : row.outcome as SalesOutcome,
    note: nullable(row.note),
    actor: row.actor as SalesActivity["actor"],
    createdAt: asIso(row.created_at),
  };
}

async function databaseLeads(): Promise<SalesLead[] | null> {
  if (!hasDatabase()) return null;
  try {
    const rows = await db().query("select * from sales_leads order by coalesce(next_action_at, 'infinity'::timestamptz), score desc nulls last, name") as Row[];
    return rows.map(mapLead);
  } catch {
    return null;
  }
}

export async function getSalesData(): Promise<SalesData> {
  const rows = await databaseLeads();
  if (rows == null) return { leads: seedSalesLeads, persistenceConfigured: false };
  return { leads: rows, persistenceConfigured: true };
}

export async function getSalesClock(): Promise<string> {
  if (hasDatabase()) {
    try {
      const rows = await db().query("select now() as current_time") as Row[];
      if (rows[0]?.current_time) return asIso(rows[0].current_time);
    } catch {
      // Preview mode can still render even if persistence is temporarily unavailable.
    }
  }
  return new Date().toISOString();
}

export async function getSalesLead(id: string): Promise<{ lead: SalesLead | null; persistenceConfigured: boolean }> {
  const rows = await databaseLeads();
  if (rows == null) return { lead: seedSalesLeads.find((lead) => lead.id === id) ?? null, persistenceConfigured: false };
  return { lead: rows.find((lead) => lead.id === id) ?? null, persistenceConfigured: true };
}

export async function getSalesActivities(leadId: string): Promise<SalesActivity[]> {
  if (!hasDatabase()) return seedSalesActivities.filter((item) => item.leadId === leadId);
  try {
    const rows = await db().query("select * from sales_activities where lead_id=$1 order by created_at desc limit 50", [leadId]) as Row[];
    return rows.map(mapActivity);
  } catch {
    return seedSalesActivities.filter((item) => item.leadId === leadId);
  }
}

export async function getSalesContacts(leadId: string): Promise<SalesContact[]> {
  if (!hasDatabase()) return [];
  try {
    const rows = await db().query("select * from sales_contacts where lead_id=$1 order by is_primary desc, created_at", [leadId]) as Row[];
    return rows.map(mapContact);
  } catch {
    return [];
  }
}

export async function getSalesPipelineStages(): Promise<SalesPipelineStage[]> {
  if (!hasDatabase()) return defaultPipelineStages;
  try {
    const rows = await db().query("select * from sales_pipeline_stages order by position, label") as Row[];
    return rows.length ? rows.map(mapPipelineStage) : defaultPipelineStages;
  } catch {
    return defaultPipelineStages;
  }
}

export async function createSalesLead(input: SalesLeadInput): Promise<SalesLead> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  const id = `${input.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "prospecto"}-${randomUUID().slice(0, 8)}`;
  const rows = await db().query(`
    insert into sales_leads(
      id,name,city,category,stage,score,estimated_value,quoted_price,maintenance_monthly,source,
      contact_name,phone,email,website_url,social_url,prototype_url,repository_full_name,
      owner,next_action_owner,next_action,next_action_at,notes
    ) values(
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::timestamptz,$22
    ) returning *
  `, [
    id, input.name, input.city, input.category, input.stage, input.score, input.estimatedValue,
    input.quotedPrice, input.maintenanceMonthly, input.source, input.contactName, input.phone, input.email,
    input.websiteUrl, input.socialUrl, input.prototypeUrl, input.repositoryFullName, input.owner,
    input.nextActionOwner, input.nextAction, input.nextActionAt, input.notes,
  ]) as Row[];
  return mapLead(rows[0]);
}

export async function updateSalesLead(id: string, input: SalesLeadInput, actor: SalesOwner = "vadim"): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  const before = await db().query("select stage from sales_leads where id=$1", [id]) as Row[];
  await db().query(`
    update sales_leads set
      name=$2,city=$3,category=$4,stage=$5,score=$6,estimated_value=$7,quoted_price=$8,
      maintenance_monthly=$9,source=$10,contact_name=$11,phone=$12,email=$13,website_url=$14,
      social_url=$15,prototype_url=$16,repository_full_name=$17,owner=$18,next_action_owner=$19,
      next_action=$20,next_action_at=$21::timestamptz,notes=$22,updated_at=now()
    where id=$1
  `, [
    id, input.name, input.city, input.category, input.stage, input.score, input.estimatedValue,
    input.quotedPrice, input.maintenanceMonthly, input.source, input.contactName, input.phone, input.email,
    input.websiteUrl, input.socialUrl, input.prototypeUrl, input.repositoryFullName, input.owner,
    input.nextActionOwner, input.nextAction, input.nextActionAt, input.notes,
  ]);
  if (before[0]?.stage && String(before[0].stage) !== input.stage) {
    await db().query(
      "insert into sales_activities(lead_id,type,note,actor) values($1,'stage_change',$2,$3)",
      [id, `Etapa cambiada de ${String(before[0].stage)} a ${input.stage}.`, actor],
    );
  }
}

export async function updateSalesLeadStage(leadId: string, stage: SalesStage, actor: SalesOwner = "vadim"): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  const before = await db().query("select stage from sales_leads where id=$1", [leadId]) as Row[];
  await db().query("update sales_leads set stage=$2,updated_at=now() where id=$1", [leadId, stage]);
  if (before[0]?.stage && String(before[0].stage) !== stage) {
    await db().query(
      "insert into sales_activities(lead_id,type,note,actor) values($1,'stage_change',$2,$3)",
      [leadId, `Etapa cambiada de ${String(before[0].stage)} a ${stage}.`, actor],
    );
  }
}

export async function addSalesContact(input: SalesContactInput): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  if (input.isPrimary) {
    await db().query("update sales_contacts set is_primary=false where lead_id=$1", [input.leadId]);
  }
  await db().query(`
    insert into sales_contacts(lead_id,name,role,phone,email,whatsapp,notes,is_primary)
    values($1,$2,$3,$4,$5,$6,$7,$8)
  `, [input.leadId, input.name, input.role, input.phone, input.email, input.whatsapp, input.notes, input.isPrimary]);
  if (input.isPrimary) {
    await db().query(
      "update sales_leads set contact_name=$2,phone=$3,email=$4,updated_at=now() where id=$1",
      [input.leadId, input.name, input.phone || input.whatsapp, input.email],
    );
  }
}

export async function setPrimarySalesContact(leadId: string, contactId: string): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  await db().query("update sales_contacts set is_primary=false where lead_id=$1", [leadId]);
  const rows = await db().query(
    "update sales_contacts set is_primary=true where id=$2 and lead_id=$1 returning name,phone,email,whatsapp",
    [leadId, contactId],
  ) as Row[];
  if (rows[0]) {
    await db().query(
      "update sales_leads set contact_name=$2,phone=$3,email=$4,updated_at=now() where id=$1",
      [leadId, nullable(rows[0].name), nullable(rows[0].phone) || nullable(rows[0].whatsapp), nullable(rows[0].email)],
    );
  }
}

export async function deleteSalesContact(leadId: string, contactId: string): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  const rows = await db().query("delete from sales_contacts where id=$2 and lead_id=$1 returning is_primary", [leadId, contactId]) as Row[];
  if (rows[0]?.is_primary) {
    await db().query("update sales_leads set contact_name=null,phone=null,email=null,updated_at=now() where id=$1", [leadId]);
  }
}

export async function updateSalesPipelineStage(input: { key: SalesStage; label: string; position: number; active: boolean; probability: number }): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  await db().query(`
    update sales_pipeline_stages
    set label=$2,position=$3,active=$4,probability=$5,updated_at=now()
    where key=$1
  `, [input.key, input.label, input.position, input.active, input.probability]);
}

function outcomePlan(outcome: SalesOutcome): { stage: SalesStage; nextAction: string | null; nextOwner: SalesOwner; delayHours: number | null } {
  switch (outcome) {
    case "no_answer": return { stage: "contacted", nextAction: "Volver a llamar", nextOwner: "antero", delayHours: 24 };
    case "call_later": return { stage: "contacted", nextAction: "Llamar de nuevo", nextOwner: "antero", delayHours: 24 };
    case "interested": return { stage: "interested", nextAction: "Enviar el siguiente paso y concretar necesidad", nextOwner: "antero", delayHours: 4 };
    case "wants_proposal": return { stage: "proposal", nextAction: "Preparar y enviar propuesta", nextOwner: "vadim", delayHours: 8 };
    case "meeting": return { stage: "meeting", nextAction: "Preparar reunión", nextOwner: "antero", delayHours: 24 };
    case "not_interested": return { stage: "lost", nextAction: null, nextOwner: "antero", delayHours: null };
    case "won": return { stage: "won", nextAction: "Crear handoff de delivery", nextOwner: "vadim", delayHours: 1 };
  }
}

export async function recordSalesOutcome(input: { leadId: string; outcome: SalesOutcome; note: string | null; actor?: SalesOwner }): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");
  const plan = outcomePlan(input.outcome);
  const nextAt = plan.delayHours == null ? null : new Date(Date.now() + plan.delayHours * 60 * 60 * 1000).toISOString();
  const actor = input.actor ?? "antero";
  await db().query(`
    with updated as (
      update sales_leads
      set stage=$2,
          next_action=$3,
          next_action_owner=$4,
          next_action_at=$5::timestamptz,
          last_contact_at=now(),
          updated_at=now()
      where id=$1
      returning id
    )
    insert into sales_activities(lead_id,type,outcome,note,actor)
    select id,'call',$6,$7,$8 from updated
  `, [input.leadId, plan.stage, plan.nextAction, plan.nextOwner, nextAt, input.outcome, input.note, actor]);
}
