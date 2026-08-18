import "server-only";
import { db, hasDatabase } from "@/lib/db";

export async function updateSalesContact(input: {
  leadId: string;
  contactId: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  notes: string | null;
  isPrimary: boolean;
  wasPrimary: boolean;
}): Promise<void> {
  if (!hasDatabase()) throw new Error("Sales persistence is not configured");

  if (input.isPrimary) {
    await db().query("update sales_contacts set is_primary=false where lead_id=$1", [input.leadId]);
  }

  await db().query(`
    update sales_contacts
    set name=$3,role=$4,phone=$5,email=$6,whatsapp=$7,notes=$8,is_primary=$9,updated_at=now()
    where lead_id=$1 and id=$2
  `, [
    input.leadId,
    input.contactId,
    input.name,
    input.role,
    input.phone,
    input.email,
    input.whatsapp,
    input.notes,
    input.isPrimary,
  ]);

  if (input.isPrimary) {
    await db().query(
      "update sales_leads set contact_name=$2,phone=$3,email=$4,updated_at=now() where id=$1",
      [input.leadId, input.name, input.phone || input.whatsapp, input.email],
    );
  } else if (input.wasPrimary) {
    await db().query(
      "update sales_leads set contact_name=null,phone=null,email=null,updated_at=now() where id=$1",
      [input.leadId],
    );
  }
}
