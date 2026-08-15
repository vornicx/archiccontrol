import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { hasDatabase } from "@/lib/db";
import { isGithubAutomationConfigured } from "@/lib/github-app";

const integrations = [
  { name: "Archic Benchmark", detail: "Signed report ingestion and Quality Gate evaluation.", configured: Boolean(process.env.INTEGRATION_SECRET) },
  { name: "OpenAI research", detail: "Current-web research and structured daily prospect selection.", configured: Boolean(process.env.OPENAI_API_KEY) },
  { name: "GitHub", detail: "Verified webhooks for checks, pull requests and workflow runs.", configured: Boolean(process.env.GITHUB_WEBHOOK_SECRET) },
  { name: "GitHub App runtime", detail: "Repository dispatch for Quality Gate and autofix workers.", configured: isGithubAutomationConfigured() },
  { name: "Prototype publisher", detail: "Creates one repository for the selected daily prospect and writes the generated Archic prototype.", configured: Boolean(process.env.GITHUB_AUTOMATION_TOKEN && process.env.GITHUB_PROSPECT_OWNER) },
  { name: "Vercel publisher", detail: "Creates the prototype project from GitHub and triggers a production deployment.", configured: Boolean(process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID) },
  { name: "Agent API", detail: "Durable leasing, bounded retries and signed completion callbacks.", configured: Boolean(process.env.AGENT_SECRET) },
  { name: "Neon Postgres", detail: "Durable projects, prospects, findings, decisions, events and audit history.", configured: hasDatabase() },
  { name: "Reconciler", detail: "Daily safety net for retries plus the idempotent commercial prospecting iteration.", configured: Boolean(process.env.CRON_SECRET) },
];

export default function SettingsPage() {
  return (
    <>
      <Topbar eyebrow="Control plane" title="Integrations" meta="Least-privilege boundaries" />
      <section className="settings-grid">
        {integrations.map((integration) => (
          <article className="integration-card" key={integration.name}>
            <h3>{integration.name}</h3>
            <p>{integration.detail}</p>
            <div className="integration-state"><StatusPill status={integration.configured ? "passed" : "needs_evidence"} label={integration.configured ? "configured" : "environment required"} /></div>
          </article>
        ))}
      </section>
    </>
  );
}
