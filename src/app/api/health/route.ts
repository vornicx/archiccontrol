import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db";
import { qualityStandard } from "@/quality/standard";
import { isGithubAutomationConfigured } from "@/lib/github-app";

export const runtime = "nodejs";

export async function GET() {
  const persistenceReady = hasDatabase();
  const ready = persistenceReady || process.env.NODE_ENV !== "production";
  const autofixWorkerReady = persistenceReady && Boolean(process.env.OPENAI_API_KEY);
  const integrations = {
    ownerAuth: Boolean(process.env.CONTROL_ACCESS_KEY && process.env.SESSION_SECRET),
    agentApi: Boolean(process.env.AGENT_SECRET),
    githubEvents: Boolean(process.env.GITHUB_WEBHOOK_SECRET),
    githubAutomation: isGithubAutomationConfigured(),
    benchmarkIngestion: Boolean(process.env.INTEGRATION_SECRET),
    scheduler: Boolean(process.env.CRON_SECRET),
  };
  return NextResponse.json({
    ok: ready,
    service: "archic-control",
    standardVersion: qualityStandard.version,
    persistence: persistenceReady ? "postgres" : "bootstrap",
    autofixWorkerReady,
    deploymentReady: persistenceReady && autofixWorkerReady && Object.values(integrations).every(Boolean),
    integrations,
    timestamp: new Date().toISOString(),
  }, { status: ready ? 200 : 503 });
}
