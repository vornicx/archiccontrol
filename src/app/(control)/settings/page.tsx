import { StatusPill } from "@/components/status-pill";
import { Topbar } from "@/components/topbar";
import { hasDatabase } from "@/lib/db";
import { isGithubAutomationConfigured } from "@/lib/github-app";

const integrations = [
  { name: "Archic Benchmark", detail: "Signed report ingestion and Quality Gate evaluation.", configured: Boolean(process.env.INTEGRATION_SECRET) },
  { name: "GitHub", detail: "Verified webhooks for checks, pull requests and workflow runs.", configured: Boolean(process.env.GITHUB_WEBHOOK_SECRET) },
  { name: "GitHub App runtime", detail: "Repository dispatch for Quality Gate and autofix workers.", configured: isGithubAutomationConfigured() },
  { name: "Agent API", detail: "Durable leasing, bounded retries and signed completion callbacks.", configured: Boolean(process.env.AGENT_SECRET) },
  { name: "Neon Postgres", detail: "Durable projects, findings, decisions, events and audit history.", configured: hasDatabase() },
  { name: "Reconciler", detail: "Escalates only exhausted, decision-bearing automation failures.", configured: Boolean(process.env.CRON_SECRET) },
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
