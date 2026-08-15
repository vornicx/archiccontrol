import { NextResponse } from "next/server";
import { db, hasDatabase } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Check = { ok: boolean; detail: string };

export async function GET() {
  const checks: Record<string, Check> = {
    database: {
      ok: hasDatabase(),
      detail: hasDatabase() ? "DATABASE_URL configured" : "DATABASE_URL missing",
    },
    openai: {
      ok: Boolean(process.env.OPENAI_API_KEY),
      detail: process.env.OPENAI_API_KEY ? "OPENAI_API_KEY configured" : "OPENAI_API_KEY missing",
    },
    githubPublisher: {
      ok: Boolean(process.env.GITHUB_AUTOMATION_TOKEN && process.env.GITHUB_PROSPECT_OWNER),
      detail:
        process.env.GITHUB_AUTOMATION_TOKEN && process.env.GITHUB_PROSPECT_OWNER
          ? "GitHub prototype publisher configured"
          : "GITHUB_AUTOMATION_TOKEN or GITHUB_PROSPECT_OWNER missing",
    },
    vercelPublisher: {
      ok: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID),
      detail:
        process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID
          ? "Vercel prototype publisher configured"
          : "VERCEL_TOKEN or VERCEL_TEAM_ID missing",
    },
    reconciler: {
      ok: Boolean(process.env.CRON_SECRET),
      detail: process.env.CRON_SECRET ? "CRON_SECRET configured" : "CRON_SECRET missing",
    },
    prospectsTable: {
      ok: false,
      detail: "Not checked",
    },
  };

  if (checks.database.ok) {
    try {
      const rows = await db().query("select to_regclass('public.prospects') as relation");
      const exists = Boolean(rows[0]?.relation);
      checks.prospectsTable = {
        ok: exists,
        detail: exists ? "prospects table available" : "prospects table missing",
      };
    } catch (error) {
      checks.prospectsTable = {
        ok: false,
        detail: error instanceof Error ? `Database check failed: ${error.message}` : "Database check failed",
      };
    }
  }

  const ok = Object.values(checks).every((check) => check.ok);
  return NextResponse.json(
    {
      ok,
      checkedAt: new Date().toISOString(),
      checks,
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
