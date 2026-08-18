import "server-only";
import { db, hasDatabase } from "@/lib/db";
import type { SalesOwner } from "@/sales/types";

export type SalesActivityType = "call" | "message" | "email" | "note";

export async function recordSalesActivity(input: {
  leadId: string;
  type: SalesActivityType;
  note: string;
  actor: SalesOwner;
}): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");

  await db().query(`
    with activity as (
      insert into sales_activities(lead_id,type,note,actor)
      values($1,$2,$3,$4)
      returning lead_id
    )
    update sales_leads
    set last_contact_at = case when $2 = 'note' then last_contact_at else now() end,
        updated_at = now()
    where id = (select lead_id from activity)
  `, [input.leadId, input.type, input.note, input.actor]);
}

export async function updateSalesNextAction(input: {
  leadId: string;
  nextAction: string | null;
  nextActionOwner: SalesOwner;
  nextActionAt: string | null;
  actor: SalesOwner;
}): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");

  const note = input.nextAction
    ? `Siguiente acción: ${input.nextAction}`
    : "Siguiente acción eliminada.";

  await db().query(`
    with updated as (
      update sales_leads
      set next_action=$2,
          next_action_owner=$3,
          next_action_at=$4::timestamptz,
          updated_at=now()
      where id=$1
      returning id
    )
    insert into sales_activities(lead_id,type,note,actor)
    select id,'note',$5,$6 from updated
  `, [input.leadId, input.nextAction, input.nextActionOwner, input.nextActionAt, note, input.actor]);
}
