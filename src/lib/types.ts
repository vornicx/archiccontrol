export type GateStatus = "unknown" | "running" | "passed" | "failed" | "needs_evidence";
export type ProjectPhase =
  | "lead"
  | "research"
  | "brief"
  | "development"
  | "quality"
  | "preview"
  | "approval"
  | "production"
  | "monitoring";

export type Severity = "critical" | "high" | "medium" | "low";
export type DecisionType =
  | "final_approval"
  | "brand_direction"
  | "risk_acceptance"
  | "scope_change"
  | "irreversible_action";

export interface ProjectSummary {
  id: string;
  name: string;
  repositoryFullName: string;
  productionUrl: string;
  benchmarkProfile: string;
  phase: ProjectPhase;
  score: number | null;
  delta: number | null;
  tier: string | null;
  gateStatus: GateStatus;
  activeGates: number;
  openFindings: number;
  criticalFindings: number;
  nextAction: string;
  lastBenchmarkAt: string | null;
}

export interface Decision {
  id: string;
  projectId: string | null;
  projectName: string | null;
  type: DecisionType;
  title: string;
  context: string;
  recommendation: string;
  risk: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  blocking: boolean;
  createdAt: string;
  dueAt: string | null;
}

export interface WorkflowRun {
  id: string;
  projectId: string | null;
  projectName: string | null;
  workflow: string;
  stage: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  summary: string | null;
  startedAt: string;
  externalUrl: string | null;
}

export interface DashboardData {
  generatedAt: string;
  source: "postgres" | "bootstrap";
  needsVadim: Decision[];
  projects: ProjectSummary[];
  runs: WorkflowRun[];
  portfolio: {
    score: number;
    delta: number;
    activeGates: number;
    projectsScored: number;
    automationHealth: number;
  };
}

export type AgentTaskStatus = "queued" | "dispatched" | "leased" | "running" | "succeeded" | "failed" | "blocked" | "cancelled";
export type AgentTaskType = "research" | "implement" | "autofix" | "quality" | "playwright" | "benchmark" | "preview" | "smoke" | "monitor";

export interface AgentTask {
  id: string;
  projectId: string | null;
  projectName: string | null;
  repositoryFullName: string | null;
  findingId: string | null;
  type: AgentTaskType;
  executor: "worker" | "github_dispatch";
  status: AgentTaskStatus;
  priority: number;
  attempt: number;
  maxAttempts: number;
  summary: string;
  input: Record<string, unknown>;
  externalUrl: string | null;
  lastError: string | null;
  createdAt: string;
}

export interface DeploymentPreview {
  id: string;
  projectId: string;
  projectName: string;
  environment: "preview" | "production";
  gitSha: string | null;
  gitRef: string | null;
  url: string;
  status: "queued" | "building" | "ready" | "failed" | "promoted" | "superseded";
  qualityStatus: GateStatus;
  smokeStatus: "unknown" | "queued" | "running" | "passed" | "failed";
  createdAt: string;
}

export interface AutomationData {
  tasks: AgentTask[];
  previews: DeploymentPreview[];
  counts: { queued: number; running: number; blocked: number; readyPreviews: number };
  deploymentReadiness: Array<{ label: string; ready: boolean; detail: string }>;
}

export interface BenchmarkIssue {
  id: string;
  category?: string;
  severity?: string;
  title: string;
  detail?: string;
  priority?: number;
  recommendation?: string;
  evidence?: unknown;
}

export interface BenchmarkGate {
  id: string;
  severity?: string;
  label?: string;
  cap?: number;
}

export interface BenchmarkProject {
  id: string;
  name: string;
  url: string;
  repository: string;
  profile: string;
  status: string;
  score: number;
  rawScore?: number;
  tier?: string;
  delta?: number;
  categoryScores?: Record<string, number>;
  gates: BenchmarkGate[];
  issues: BenchmarkIssue[];
  reviewedAt?: string;
}

export interface BenchmarkReport {
  generatedAt: string;
  portfolio: {
    score: number;
    delta: number;
    projectsScored: number;
    activeGates: number;
  };
  projects: BenchmarkProject[];
}
