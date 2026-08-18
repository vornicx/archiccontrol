import { z } from "zod";
import rubricJson from "../../config/quality-rubric.v1.json";

export const pageModes = ["Atmosphere", "Explore", "Decide", "Convert", "Story", "Prove"] as const;
export const pageRoles = ["home", "critical_conversion", "explore_detail", "supporting"] as const;
export const criterionIds = [
  "specificity",
  "information_architecture",
  "art_direction",
  "photography",
  "typography",
  "layout_rhythm",
  "components_data",
  "ux_conversion",
  "mobile",
  "motion",
  "robustness",
] as const;
export const sectionDimensionIds = ["purpose", "specificity", "hierarchy", "composition", "handoff"] as const;

const rubricSchema = z.object({
  name: z.string(),
  version: z.literal("1.0"),
  principle: z.string(),
  criteria: z.array(z.object({ id: z.enum(criterionIds), name: z.string(), base_weight: z.number(), question: z.string() })).length(criterionIds.length),
  page_modes: z.object({
    Atmosphere: z.record(z.enum(criterionIds), z.number()),
    Explore: z.record(z.enum(criterionIds), z.number()),
    Decide: z.record(z.enum(criterionIds), z.number()),
    Convert: z.record(z.enum(criterionIds), z.number()),
    Story: z.record(z.enum(criterionIds), z.number()),
    Prove: z.record(z.enum(criterionIds), z.number()),
  }),
  hard_gates: z.array(z.object({ id: z.string(), name: z.string(), rule: z.string() })).length(10),
  section_scoring: z.object({
    max_score: z.number(), pass_min: z.number(), hero_min: z.number(),
    dimensions: z.array(z.object({ id: z.enum(sectionDimensionIds), max: z.number(), description: z.string() })),
  }),
  ai_slop_detector: z.array(z.object({
    id: z.string(), label: z.string(), description: z.string(), severity: z.enum(["high", "medium", "low"]), penalty: z.number(),
  })).length(50),
  quality_levels: z.array(z.object({
    score_min: z.number(), score_max: z.number(), archic_level: z.string(), label: z.string(), release: z.string(),
  })),
  approval_rules: z.object({
    client_ready_min_project_score: z.number(), recommended_target: z.number(), flagship_min: z.number(), home_min: z.number(),
    critical_page_min: z.number(), critical_section_min: z.number(), hero_section_min: z.number(), mobile_min: z.number(),
    max_high_slop_findings: z.number(), max_total_slop_penalty_before_rework: z.number(), hard_gate_failures_allowed: z.number(),
    project_weighting_default: z.object({ home: z.number(), critical_conversion_pages: z.number(), explore_and_detail_pages: z.number(), supporting_pages: z.number() }),
  }),
  golden_references: z.record(z.string(), z.array(z.string())),
});

export const qualityRubric = rubricSchema.parse(rubricJson);
export type PageMode = typeof pageModes[number];
export type PageRole = typeof pageRoles[number];
export type CriterionId = typeof criterionIds[number];

const criterionScoresSchema = z.object({
  specificity: z.number().min(0).max(10),
  information_architecture: z.number().min(0).max(10),
  art_direction: z.number().min(0).max(10),
  photography: z.number().min(0).max(10),
  typography: z.number().min(0).max(10),
  layout_rhythm: z.number().min(0).max(10),
  components_data: z.number().min(0).max(10),
  ux_conversion: z.number().min(0).max(10),
  mobile: z.number().min(0).max(10),
  motion: z.number().min(0).max(10),
  robustness: z.number().min(0).max(10),
});

const sectionScoresSchema = z.object({
  purpose: z.number().min(0).max(4),
  specificity: z.number().min(0).max(4),
  hierarchy: z.number().min(0).max(4),
  composition: z.number().min(0).max(4),
  handoff: z.number().min(0).max(4),
});

export const qualityReviewInputSchema = z.object({
  projectId: z.string().min(1),
  reviewer: z.string().min(1).default("quality-agent"),
  reviewedAt: z.string().datetime().optional(),
  pages: z.array(z.object({
    path: z.string().min(1),
    label: z.string().min(1).optional(),
    mode: z.enum(pageModes),
    role: z.enum(pageRoles),
    criteria: criterionScoresSchema,
    sections: z.array(z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      kind: z.enum(["hero", "standard"]).default("standard"),
      scores: sectionScoresSchema,
    })).min(1),
    mobileScore: z.number().min(0).max(100),
    mobileFindings: z.array(z.string().min(1)).default([]),
    slopFindings: z.array(z.object({ signalId: z.string().regex(/^S\d{2}$/), evidence: z.string().min(1) })).default([]),
  })).min(1),
  hardGates: z.array(z.object({ id: z.string().regex(/^G\d{2}$/), passed: z.boolean(), evidence: z.string().min(1) })),
  topFixes: z.array(z.string().min(1)).max(7).default([]),
  goldenReferenceAlignment: z.array(z.object({ reference: z.string().min(1), principle: z.string().min(1) })).default([]),
});

export type QualityReviewInput = z.infer<typeof qualityReviewInputSchema>;

const slopFindingReportSchema = z.object({
  path: z.string(), signalId: z.string(), label: z.string(), severity: z.enum(["high", "medium", "low"]), penalty: z.number(), evidence: z.string(),
});
const sectionFailureSchema = z.object({ path: z.string(), sectionId: z.string(), label: z.string(), score: z.number(), required: z.number() });
const hardGateFailureSchema = z.object({ id: z.string(), name: z.string(), evidence: z.string() });
const pageScoreSchema = z.object({
  path: z.string(), label: z.string(), mode: z.enum(pageModes), role: z.enum(pageRoles), rawScore: z.number(), slopPenalty: z.number(), finalScore: z.number(), mobileScore: z.number(), highSlopFindings: z.number(),
});

export const qualityRubricReportSchema = z.object({
  rubricVersion: z.literal("1.0"),
  projectId: z.string(),
  reviewedAt: z.string(),
  reviewer: z.string(),
  rawProjectScore: z.number(),
  projectScore: z.number(),
  archicLevel: z.string(),
  levelLabel: z.string(),
  status: z.enum(["REJECT", "INTERNAL_ONLY", "CLIENT_READY", "FLAGSHIP_READY"]),
  mobileScore: z.number(),
  totalSlopPenalty: z.number(),
  highSlopFindings: z.number(),
  hardGateFailures: z.array(hardGateFailureSchema),
  pageScores: z.array(pageScoreSchema),
  sectionFailures: z.array(sectionFailureSchema),
  slopFindings: z.array(slopFindingReportSchema),
  mobileFindings: z.array(z.object({ path: z.string(), finding: z.string() })),
  topFixes: z.array(z.string()),
  goldenReferenceAlignment: z.array(z.object({ reference: z.string(), principle: z.string() })),
});

export type QualityRubricReport = z.infer<typeof qualityRubricReportSchema>;

const roleWeights: Record<PageRole, number> = {
  home: qualityRubric.approval_rules.project_weighting_default.home,
  critical_conversion: qualityRubric.approval_rules.project_weighting_default.critical_conversion_pages,
  explore_detail: qualityRubric.approval_rules.project_weighting_default.explore_and_detail_pages,
  supporting: qualityRubric.approval_rules.project_weighting_default.supporting_pages,
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function weightedByRole<T extends { role: PageRole }>(items: T[], read: (item: T) => number): number {
  let numerator = 0;
  let denominator = 0;
  for (const role of pageRoles) {
    const group = items.filter((item) => item.role === role);
    if (!group.length) continue;
    const average = group.reduce((sum, item) => sum + read(item), 0) / group.length;
    numerator += average * roleWeights[role];
    denominator += roleWeights[role];
  }
  return denominator ? numerator / denominator : 0;
}

function resolveLevel(score: number) {
  return qualityRubric.quality_levels.find((level) => score >= level.score_min && score <= level.score_max)
    ?? qualityRubric.quality_levels.at(-1)!;
}

export function evaluateQualityRubric(value: QualityReviewInput): QualityRubricReport {
  const input = qualityReviewInputSchema.parse(value);
  const slopById = new Map(qualityRubric.ai_slop_detector.map((signal) => [signal.id, signal]));
  const expectedGates = new Map(qualityRubric.hard_gates.map((gate) => [gate.id, gate]));
  const slopFindings: QualityRubricReport["slopFindings"] = [];
  const sectionFailures: QualityRubricReport["sectionFailures"] = [];

  const pages = input.pages.map((page) => {
    const weights = qualityRubric.page_modes[page.mode];
    const rawScore = criterionIds.reduce((sum, criterion) => sum + (page.criteria[criterion] / 10) * weights[criterion], 0);
    const uniqueSignals = new Map(page.slopFindings.map((finding) => [finding.signalId, finding]));
    let slopPenalty = 0;
    let highSlopFindings = 0;
    for (const finding of uniqueSignals.values()) {
      const signal = slopById.get(finding.signalId);
      if (!signal) continue;
      slopPenalty += signal.penalty;
      if (signal.severity === "high") highSlopFindings += 1;
      slopFindings.push({ path: page.path, signalId: signal.id, label: signal.label, severity: signal.severity, penalty: signal.penalty, evidence: finding.evidence });
    }

    for (const section of page.sections) {
      const score = sectionDimensionIds.reduce((sum, dimension) => sum + section.scores[dimension], 0);
      const required = section.kind === "hero" ? qualityRubric.section_scoring.hero_min : qualityRubric.section_scoring.pass_min;
      if (score < required) sectionFailures.push({ path: page.path, sectionId: section.id, label: section.label, score, required });
    }

    return {
      path: page.path,
      label: page.label ?? page.path,
      mode: page.mode,
      role: page.role,
      rawScore: round(rawScore),
      slopPenalty,
      finalScore: round(Math.max(0, rawScore - slopPenalty)),
      mobileScore: round(page.mobileScore),
      highSlopFindings,
    };
  });

  const reviewedGateIds = new Set(input.hardGates.map((gate) => gate.id));
  const hardGateFailures: QualityRubricReport["hardGateFailures"] = [];
  for (const [id, gate] of expectedGates) {
    const review = input.hardGates.find((candidate) => candidate.id === id);
    if (!review) hardGateFailures.push({ id, name: gate.name, evidence: "Not reviewed." });
    else if (!review.passed) hardGateFailures.push({ id, name: gate.name, evidence: review.evidence });
  }
  for (const review of input.hardGates) {
    if (!expectedGates.has(review.id) && !reviewedGateIds.has(review.id)) continue;
  }

  const rawProjectScore = round(weightedByRole(pages, (page) => page.rawScore));
  const projectScore = round(weightedByRole(pages, (page) => page.finalScore));
  const mobileScore = round(weightedByRole(pages, (page) => page.mobileScore));
  const totalSlopPenalty = slopFindings.reduce((sum, finding) => sum + finding.penalty, 0);
  const highSlopFindings = slopFindings.filter((finding) => finding.severity === "high").length;
  const homePages = pages.filter((page) => page.role === "home");
  const criticalPages = pages.filter((page) => page.role === "critical_conversion");
  const homePass = homePages.length > 0 && homePages.every((page) => page.finalScore >= qualityRubric.approval_rules.home_min);
  const criticalPass = criticalPages.every((page) => page.finalScore >= qualityRubric.approval_rules.critical_page_min);
  const clientReady =
    projectScore >= qualityRubric.approval_rules.client_ready_min_project_score
    && homePass
    && criticalPass
    && mobileScore >= qualityRubric.approval_rules.mobile_min
    && sectionFailures.length === 0
    && hardGateFailures.length === 0
    && highSlopFindings <= qualityRubric.approval_rules.max_high_slop_findings
    && totalSlopPenalty < qualityRubric.approval_rules.max_total_slop_penalty_before_rework;
  const flagshipReady = clientReady
    && projectScore >= qualityRubric.approval_rules.flagship_min
    && pages.every((page) => page.finalScore >= 88);

  const status: QualityRubricReport["status"] = hardGateFailures.length > 0 || projectScore < 70
    ? "REJECT"
    : flagshipReady
      ? "FLAGSHIP_READY"
      : clientReady
        ? "CLIENT_READY"
        : "INTERNAL_ONLY";
  const level = resolveLevel(projectScore);

  return qualityRubricReportSchema.parse({
    rubricVersion: qualityRubric.version,
    projectId: input.projectId,
    reviewedAt: input.reviewedAt ?? new Date().toISOString(),
    reviewer: input.reviewer,
    rawProjectScore,
    projectScore,
    archicLevel: level.archic_level,
    levelLabel: level.label,
    status,
    mobileScore,
    totalSlopPenalty,
    highSlopFindings,
    hardGateFailures,
    pageScores: pages,
    sectionFailures,
    slopFindings,
    mobileFindings: input.pages.flatMap((page) => page.mobileFindings.map((finding) => ({ path: page.path, finding }))),
    topFixes: input.topFixes,
    goldenReferenceAlignment: input.goldenReferenceAlignment,
  });
}

export function rubricAllowsClientReview(report: QualityRubricReport | null | undefined): boolean {
  return report?.status === "CLIENT_READY" || report?.status === "FLAGSHIP_READY";
}
