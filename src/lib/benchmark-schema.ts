import { z } from "zod";

export const benchmarkReportSchema = z.object({
  generatedAt: z.string(),
  portfolio: z.object({
    score: z.number(),
    delta: z.number().default(0),
    projectsScored: z.number(),
    activeGates: z.number(),
  }).passthrough(),
  projects: z.array(z.object({
    id: z.string(),
    name: z.string(),
    url: z.url(),
    repository: z.string(),
    profile: z.string(),
    status: z.string(),
    score: z.number(),
    rawScore: z.number().optional(),
    tier: z.string().optional(),
    delta: z.number().optional(),
    categoryScores: z.record(z.string(), z.number()).optional(),
    gates: z.array(z.object({
      id: z.string(),
      severity: z.string().optional(),
      label: z.string().optional(),
      cap: z.number().optional(),
    }).passthrough()),
    issues: z.array(z.object({
      id: z.string(),
      category: z.string().optional(),
      severity: z.string().optional(),
      title: z.string(),
      detail: z.string().optional(),
      priority: z.number().optional(),
      recommendation: z.string().optional(),
      evidence: z.unknown().optional(),
    }).passthrough()),
    reviewedAt: z.string().optional(),
  }).passthrough()),
});

