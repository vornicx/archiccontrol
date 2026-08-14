import { z } from "zod";
import standardJson from "../../config/quality-standard.v1.json";

const checkSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  verification: z.enum(["automated", "manual", "hybrid"]),
  required: z.boolean(),
  blocking: z.boolean(),
  evidenceSources: z.array(z.string()),
});

const qualityStandardSchema = z.object({
  schemaVersion: z.literal("1.0"),
  version: z.string(),
  frozenAt: z.string(),
  source: z.object({
    repository: z.string(),
    path: z.string(),
    sha: z.string(),
  }),
  intent: z.string(),
  thresholds: z.object({
    benchmarkScoreForApproval: z.number(),
    lcpMs: z.number(),
    inpMs: z.number(),
    cls: z.number(),
    lighthouse: z.object({
      performance: z.number(),
      accessibility: z.number(),
      bestPractices: z.number(),
      seo: z.number(),
    }),
    touchTargetPx: z.number(),
    touchTargetSeparationPx: z.number(),
  }),
  promotionPolicy: z.object({
    preview: z.array(z.string()),
    humanApproval: z.array(z.string()),
    production: z.array(z.string()),
  }),
  needsVadimPolicy: z.object({
    allowedDecisionTypes: z.array(z.string()),
    suppress: z.array(z.string()),
    escalateAfterRetries: z.number(),
  }),
  sections: z.array(z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    checks: z.array(checkSchema),
  })),
  polish: z.object({
    id: z.string(),
    name: z.string(),
    verification: z.literal("manual"),
    required: z.boolean(),
    blocking: z.boolean(),
    label: z.string(),
  }),
});

export const qualityStandard = qualityStandardSchema.parse(standardJson);
export type QualityStandard = z.infer<typeof qualityStandardSchema>;
export type QualityCheck = z.infer<typeof checkSchema>;

export const standardStats = {
  checks: qualityStandard.sections.reduce((sum, section) => sum + section.checks.length, 0) + 1,
  automated: qualityStandard.sections.flatMap((section) => section.checks).filter((check) => check.verification === "automated").length,
  manual: qualityStandard.sections.flatMap((section) => section.checks).filter((check) => check.verification === "manual").length + 1,
  hybrid: qualityStandard.sections.flatMap((section) => section.checks).filter((check) => check.verification === "hybrid").length,
};

