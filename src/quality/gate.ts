import type { BenchmarkProject, Severity } from "@/lib/types";
import { qualityStandard } from "@/quality/standard";

export type GateCheckStatus = "passed" | "failed" | "needs_evidence";

export interface GateCheckResult {
  id: string;
  label: string;
  status: GateCheckStatus;
  source: "benchmark" | "quality-standard" | "human";
  blocking: boolean;
  detail: string;
}

export interface QualityGateResult {
  projectId: string;
  standardVersion: string;
  status: "passed" | "failed" | "needs_evidence";
  promotion: "blocked" | "preview" | "human_approval";
  score: number;
  checks: GateCheckResult[];
  blockers: GateCheckResult[];
  summary: string;
  nextAction: string;
}

const severityRank: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function normalizeSeverity(value?: string): Severity {
  const normalized = value?.toLowerCase();
  return normalized === "critical" || normalized === "high" || normalized === "medium" || normalized === "low"
    ? normalized
    : "medium";
}

export function evaluateQualityGate(
  project: BenchmarkProject,
  options: { manualEvidenceComplete?: boolean; polishPassed?: boolean } = {},
): QualityGateResult {
  const checks: GateCheckResult[] = [];
  const threshold = qualityStandard.thresholds.benchmarkScoreForApproval;

  checks.push({
    id: "benchmark-score",
    label: `Benchmark score ≥ ${threshold}`,
    status: project.score >= threshold ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: `Observed ${project.score.toFixed(1)} / 100.`,
  });

  checks.push({
    id: "benchmark-hard-gates",
    label: "No active hard quality gates",
    status: project.gates.length === 0 ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: project.gates.length === 0
      ? "The benchmark reported no active caps."
      : project.gates.map((gate) => gate.label ?? gate.id).join(" · "),
  });

  const severeIssues = project.issues.filter((issue) => severityRank[normalizeSeverity(issue.severity)] >= severityRank.high);
  checks.push({
    id: "severe-findings",
    label: "No unresolved critical or high findings",
    status: severeIssues.length === 0 ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: severeIssues.length === 0
      ? "No severe findings were reported."
      : `${severeIssues.length} severe finding(s): ${severeIssues.slice(0, 3).map((issue) => issue.title).join(" · ")}`,
  });

  checks.push({
    id: "manual-evidence",
    label: "Manual and real-device evidence is complete",
    status: options.manualEvidenceComplete ? "passed" : "needs_evidence",
    source: "human",
    blocking: true,
    detail: options.manualEvidenceComplete
      ? "Required sign-off evidence is attached."
      : "Real-device, keyboard, screen-reader and content truth checks remain to be signed off.",
  });

  checks.push({
    id: "polish-pass",
    label: qualityStandard.polish.label,
    status: options.polishPassed ? "passed" : "needs_evidence",
    source: "human",
    blocking: true,
    detail: options.polishPassed
      ? "Polish pass signed."
      : "The judgement pass cannot be inferred from a numeric score.",
  });

  const blockers = checks.filter((check) => check.blocking && check.status !== "passed");
  const failed = blockers.some((check) => check.status === "failed");
  const status = failed ? "failed" : blockers.length ? "needs_evidence" : "passed";
  const promotion = status === "passed"
    ? "human_approval"
    : failed
      ? "blocked"
      : "preview";

  const nextAction = failed
    ? "Route findings to an agent, rerun the failed stage, then evaluate again."
    : status === "needs_evidence"
      ? "Collect the missing manual evidence and complete the Polish pass."
      : "Create one final approval decision for Vadim.";

  return {
    projectId: project.id,
    standardVersion: qualityStandard.version,
    status,
    promotion,
    score: project.score,
    checks,
    blockers,
    summary: blockers.length === 0
      ? "Automated and manual evidence satisfy Archic Quality Standard v1.0."
      : `${blockers.length} blocking condition(s) remain; human approval is not requested yet.`,
    nextAction,
  };
}

