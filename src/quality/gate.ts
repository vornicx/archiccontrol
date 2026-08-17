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
    label: `Puntuación del benchmark ≥ ${threshold}`,
    status: project.score >= threshold ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: `Resultado observado: ${project.score.toFixed(1)} / 100.`,
  });

  checks.push({
    id: "benchmark-hard-gates",
    label: "Sin bloqueos duros de calidad activos",
    status: project.gates.length === 0 ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: project.gates.length === 0
      ? "El benchmark no ha detectado límites activos."
      : project.gates.map((gate) => gate.label ?? gate.id).join(" · "),
  });

  const severeIssues = project.issues.filter((issue) => severityRank[normalizeSeverity(issue.severity)] >= severityRank.high);
  checks.push({
    id: "severe-findings",
    label: "Sin incidencias críticas o altas sin resolver",
    status: severeIssues.length === 0 ? "passed" : "failed",
    source: "benchmark",
    blocking: true,
    detail: severeIssues.length === 0
      ? "No se han detectado incidencias graves."
      : `${severeIssues.length} incidencia(s) grave(s): ${severeIssues.slice(0, 3).map((issue) => issue.title).join(" · ")}`,
  });

  checks.push({
    id: "manual-evidence",
    label: "La evidencia manual y en dispositivos reales está completa",
    status: options.manualEvidenceComplete ? "passed" : "needs_evidence",
    source: "human",
    blocking: true,
    detail: options.manualEvidenceComplete
      ? "La evidencia obligatoria de validación está adjunta."
      : "Quedan por validar las pruebas en dispositivo real, teclado, lector de pantalla y veracidad del contenido.",
  });

  checks.push({
    id: "polish-pass",
    label: "Pasada final de pulido y criterio visual",
    status: options.polishPassed ? "passed" : "needs_evidence",
    source: "human",
    blocking: true,
    detail: options.polishPassed
      ? "Pasada de pulido validada."
      : "La pasada de criterio visual no puede inferirse únicamente a partir de una puntuación numérica.",
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
    ? "Enviar las incidencias a un agente, repetir la fase fallida y volver a evaluar."
    : status === "needs_evidence"
      ? "Recoger la evidencia manual que falta y completar la pasada de pulido."
      : "Crear una única decisión de aprobación final para Vadim.";

  return {
    projectId: project.id,
    standardVersion: qualityStandard.version,
    status,
    promotion,
    score: project.score,
    checks,
    blockers,
    summary: blockers.length === 0
      ? "La evidencia automática y manual cumple el Estándar de Calidad Archic v1.0."
      : `Quedan ${blockers.length} condición(es) bloqueante(s); todavía no se solicita aprobación humana.`,
    nextAction,
  };
}
