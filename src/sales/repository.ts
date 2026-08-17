import "server-only";
import { db, hasDatabase } from "@/lib/db";
import { seedSalesActivities, seedSalesLeads } from "@/sales/seed";
import type { SalesActivity, SalesData, SalesLead, SalesOutcome, SalesOwner, SalesStage } from "@/sales/types";

type Row = Record<string, unknown>;

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
