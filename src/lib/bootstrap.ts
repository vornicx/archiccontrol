import snapshotJson from "@/data/benchmark-snapshot.json";
import type { BenchmarkReport, DashboardData, Decision, WorkflowRun } from "@/lib/types";
import { evaluateQualityGate, normalizeSeverity } from "@/quality/gate";

export const benchmarkSnapshot = snapshotJson as BenchmarkReport;

const standardDecision: Decision = {
  id: "ratify-quality-standard-v1",
  projectId: null,
  projectName: null,
  type: "irreversible_action",
  title: "Ratify Archic Quality Standard v1.0",
  context: "The standard unifies 87 delivery checks, the mandatory Polish pass, benchmark thresholds and the promotion policy used by Archic Control.",
  recommendation: "Approve v1.0 as the required baseline for every production delivery. Amendments should ship as explicit versions, never as silent exceptions.",
  risk: "Approval makes the gate binding. Projects that score well but lack evidence will remain blocked.",
  status: "pending",
  blocking: true,
  createdAt: "2026-08-14T10:00:00.000Z",
  dueAt: null,
};

declare global {
  var __archicBootstrapDecision: Decision | undefined;
}

export function getBootstrapDecision(): Decision {
  globalThis.__archicBootstrapDecision ??= { ...standardDecision };
  return globalThis.__archicBootstrapDecision;
}

export function resolveBootstrapDecision(status: "approved" | "rejected"): void {
  globalThis.__archicBootstrapDecision = { ...getBootstrapDecision(), status };
}

export function buildBootstrapDashboard(): DashboardData {
  const projects = benchmarkSnapshot.projects.map((project) => {
    const gate = evaluateQualityGate(project);
    return {
      id: project.id,
      name: project.name,
      repositoryFullName: project.repository,
      productionUrl: project.url,
      benchmarkProfile: project.profile,
      phase: "quality" as const,
      score: project.score,
      delta: project.delta ?? null,
      tier: project.tier ?? null,
      gateStatus: gate.status,
      activeGates: project.gates.length,
      openFindings: project.issues.length,
      criticalFindings: project.issues.filter((issue) => normalizeSeverity(issue.severity) === "critical").length,
      nextAction: gate.nextAction,
      lastBenchmarkAt: project.reviewedAt ?? benchmarkSnapshot.generatedAt,
    };
  });

  const runs: WorkflowRun[] = benchmarkSnapshot.projects.slice(0, 5).map((project) => ({
    id: `benchmark-${project.id}-${benchmarkSnapshot.generatedAt}`,
    projectId: project.id,
    projectName: project.name,
    workflow: "Daily quality pipeline",
    stage: "benchmark",
    status: project.status === "ok" ? "succeeded" : "failed",
    summary: `${project.score.toFixed(1)} / 100 · ${project.gates.length} active gate(s)`,
    startedAt: project.reviewedAt ?? benchmarkSnapshot.generatedAt,
    externalUrl: "https://archicbenchmark.vercel.app",
  }));

  const decision = getBootstrapDecision();
  return {
    generatedAt: benchmarkSnapshot.generatedAt,
    source: "bootstrap",
    needsVadim: decision.status === "pending" ? [decision] : [],
    projects,
    runs,
    portfolio: {
      score: benchmarkSnapshot.portfolio.score,
      delta: benchmarkSnapshot.portfolio.delta,
      activeGates: benchmarkSnapshot.portfolio.activeGates,
      projectsScored: benchmarkSnapshot.portfolio.projectsScored,
      automationHealth: 100,
    },
  };
}
