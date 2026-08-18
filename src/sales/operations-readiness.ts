import "server-only";
import { db, hasDatabase } from "@/lib/db";

type Row = Record<string, unknown>;

export async function salesOperationsConfigured(): Promise<boolean> {
  if (!hasDatabase()) return false;
  try {
    const rows = await db().query(`
      select
        exists(
          select 1 from information_schema.columns
          where table_schema='public' and table_name='sales_leads' and column_name='quoted_price'
        ) as pricing_ready,
        to_regclass('public.sales_contacts') is not null as contacts_ready,
        to_regclass('public.sales_pipeline_stages') is not null as pipeline_ready
    `) as Row[];
    const row = rows[0];
    return Boolean(row?.pricing_ready && row?.contacts_ready && row?.pipeline_ready);
  } catch {
    return false;
  }
}
