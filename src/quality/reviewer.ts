import "server-only";

import { z } from "zod";
import type { AuthorizedRubricTask } from "@/quality/reviewer-task";
import { qualityReviewInputSchema, qualityRubric, type QualityReviewInput } from "@/quality/rubric";

const slopIds = qualityRubric.ai_slop_detector.map((signal) => signal.id);
const gateIds = qualityRubric.hard_gates.map((gate) => gate.id);
const goldenReferences = Object.keys(qualityRubric.golden_references);

export const rubricPageEvidenceSchema = z.object({
  path: z.string().min(1).max(300),
  title: z.string().max(500),
  bodyText: z.string().max(20_000),
  headings: z.array(z.string().max(500)).max(80),
  links: z.array(z.object({ text: z.string().max(300), href: z.string().max(1_000) })).max(160),
  brokenImages: z.array(z.string().max(1_000)).max(40),
  consoleErrors: z.array(z.string().max(1_000)).max(30),
  overflowX: z.boolean(),
  desktopImageBase64: z.string().min(100).max(500_000),
  mobileImageBase64: z.string().min(100).max(500_000),
});

export type RubricPageEvidence = z.infer<typeof rubricPageEvidenceSchema>;

const modelPageSchema = z.object({
  path: z.string(),
  label: z.string().min(1).max(120),
  mode: z.enum(["Atmosphere", "Explore", "Decide", "Convert", "Story", "Prove"]),
  role: z.enum(["home", "critical_conversion", "explore_detail", "supporting"]),
  criteria: z.object({
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
  }),
  sections: z.array(z.object({
    id: z.string().min(1).max(120),
    label: z.string().min(1).max(180),
    kind: z.enum(["hero", "standard"]),
    scores: z.object({
      purpose: z.number().min(0).max(4),
      specificity: z.number().min(0).max(4),
      hierarchy: z.number().min(0).max(4),
      composition: z.number().min(0).max(4),
      handoff: z.number().min(0).max(4),
    }),
  })).min(1).max(10),
  mobileScore: z.number().min(0).max(100),
  mobileFindings: z.array(z.string().min(1).max(500)).max(8),
  slopFindings: z.array(z.object({ signalId: z.string(), evidence: z.string().min(1).max(800) })).max(12),
});

const modelOutputSchema = z.object({
  pages: z.array(modelPageSchema).min(1).max(4),
  hardGates: z.array(z.object({ id: z.string(), passed: z.boolean(), evidence: z.string().min(1).max(800) })).length(10),
  topFixes: z.array(z.string().min(1).max(500)).max(7),
  goldenReferenceAlignment: z.array(z.object({ reference: z.string().min(1), principle: z.string().min(1).max(500) })).max(4),
});

type OpenAIResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

function outputText(payload: OpenAIResponse): string {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  throw new Error("OpenAI rubric response did not contain structured output text");
}

function responsesEndpoint(): string {
  const configured = process.env.QUALITY_REVIEW_API_BASE_URL
    ?? process.env.ARCHIC_OPENAI_BASE_URL
    ?? process.env.OPENAI_BASE_URL
    ?? "https://api.openai.com";
  const base = configured.trim().replace(/\/+$/, "");
  return base.endsWith("/v1") ? `${base}/responses` : `${base}/v1/responses`;
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function jsonSchema() {
  const criterionProperties = Object.fromEntries(qualityRubric.criteria.map((criterion) => [criterion.id, { type: "number", minimum: 0, maximum: 10 }]));
  const sectionProperties = Object.fromEntries(qualityRubric.section_scoring.dimensions.map((dimension) => [dimension.id, { type: "number", minimum: 0, maximum: dimension.max }]));
  return {
    type: "object",
    additionalProperties: false,
    required: ["pages", "hardGates", "topFixes", "goldenReferenceAlignment"],
    properties: {
      pages: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "label", "mode", "role", "criteria", "sections", "mobileScore", "mobileFindings", "slopFindings"],
          properties: {
            path: { type: "string" },
            label: { type: "string" },
            mode: { type: "string", enum: ["Atmosphere", "Explore", "Decide", "Convert", "Story", "Prove"] },
            role: { type: "string", enum: ["home", "critical_conversion", "explore_detail", "supporting"] },
            criteria: {
              type: "object",
              additionalProperties: false,
              required: qualityRubric.criteria.map((criterion) => criterion.id),
              properties: criterionProperties,
            },
            sections: {
              type: "array", minItems: 1, maxItems: 10,
              items: {
                type: "object", additionalProperties: false,
                required: ["id", "label", "kind", "scores"],
                properties: {
                  id: { type: "string" }, label: { type: "string" }, kind: { type: "string", enum: ["hero", "standard"] },
                  scores: { type: "object", additionalProperties: false, required: qualityRubric.section_scoring.dimensions.map((dimension) => dimension.id), properties: sectionProperties },
                },
              },
            },
            mobileScore: { type: "number", minimum: 0, maximum: 100 },
            mobileFindings: { type: "array", maxItems: 8, items: { type: "string" } },
            slopFindings: {
              type: "array", maxItems: 12,
              items: {
                type: "object", additionalProperties: false, required: ["signalId", "evidence"],
                properties: { signalId: { type: "string", enum: slopIds }, evidence: { type: "string" } },
              },
            },
          },
        },
      },
      hardGates: {
        type: "array", minItems: 10, maxItems: 10,
        items: {
          type: "object", additionalProperties: false, required: ["id", "passed", "evidence"],
          properties: { id: { type: "string", enum: gateIds }, passed: { type: "boolean" }, evidence: { type: "string" } },
        },
      },
      topFixes: { type: "array", maxItems: 7, items: { type: "string" } },
      goldenReferenceAlignment: {
        type: "array", maxItems: 4,
        items: {
          type: "object", additionalProperties: false, required: ["reference", "principle"],
          properties: { reference: { type: "string", enum: goldenReferences }, principle: { type: "string" } },
        },
      },
    },
  };
}

function evidenceText(task: AuthorizedRubricTask, pages: RubricPageEvidence[]): string {
  const slop = qualityRubric.ai_slop_detector.map((signal) => `${signal.id} ${signal.label}: ${signal.description}`).join("\n");
  const gates = qualityRubric.hard_gates.map((gate) => `${gate.id} ${gate.name}: ${gate.rule}`).join("\n");
  const criteria = qualityRubric.criteria.map((criterion) => `${criterion.id} (${criterion.base_weight} base): ${criterion.question}`).join("\n");
  const refs = Object.entries(qualityRubric.golden_references).map(([reference, principles]) => `${reference}: ${principles.join(", ")}`).join("\n");
  const pageText = pages.map((page) => [
    `PAGE ${page.path}`,
    `Title: ${page.title}`,
    `Overflow X: ${page.overflowX}`,
    `Broken images: ${page.brokenImages.length ? page.brokenImages.join(" | ") : "none observed"}`,
    `Console errors: ${page.consoleErrors.length ? page.consoleErrors.join(" | ") : "none observed"}`,
    `Headings: ${page.headings.join(" | ")}`,
    `Links: ${page.links.slice(0, 80).map((link) => `${link.text} -> ${link.href}`).join(" | ")}`,
    `Rendered text:\n${page.bodyText}`,
  ].join("\n")).join("\n\n");

  return `You are the visual quality reviewer inside Archic Control. Review the supplied live preview evidence using the Archic Golden Training Set and executable rubric. You are not redesigning the website and you are not rewarding generic luxury aesthetics.

PROJECT
Name: ${task.projectName}
Repository: ${task.repositoryFullName}
Benchmark profile: ${task.benchmarkProfile}
Preview: ${String(task.payload.baseUrl ?? "unknown")}

CENTRAL STANDARD
${qualityRubric.principle}

SCORING CRITERIA
${criteria}

HARD GATES
${gates}

AI SLOP SIGNALS
${slop}

GOLDEN REFERENCES — USE PRINCIPLES, NEVER PIXEL COPYING
${refs}

REVIEW RULES
- Base every finding on the screenshots and rendered evidence supplied in this request.
- Do not invent business facts, customer claims, awards, prices, missing pages, hidden interactions or technical failures.
- A beautiful page can still score badly if it is generic, commercially unclear, information-poor or mismatched to the business.
- Quiet luxury is not a synonym for beige, serif, whitespace or low information density.
- Score 9–10 only when a dimension is genuinely exceptional; do not inflate ratings.
- Assign exactly one dominant Page Mode and one role to each page.
- For the homepage, role must be home. Use critical_conversion only when the page primarily completes a booking, enquiry, checkout, contact or equivalent action.
- Identify actual visual sections. Score purpose, specificity, hierarchy, composition and handoff 0–4. The first dominant section should normally be kind=hero.
- MobileScore is 0–100 and must compare the supplied mobile evidence to the desktop intent, not merely check that content stacks.
- Only emit AI Slop signals when visible evidence clearly supports them.
- Hard gates are a visual/DOM evidence layer; independent benchmark, journeys and smoke tests enforce runtime truth elsewhere. Mark a gate failed when the supplied evidence shows the failure. Otherwise mark passed and state the evidence actually inspected; never claim hidden behavior was tested.
- G05 passes only because both desktop and mobile captures are supplied for every reviewed page.
- G02 must fail if overflowX=true or the mobile capture visibly clips core content.
- G04 must fail if brokenImages is non-empty or a critical asset is visibly unusable.
- G10 must fail if console errors or visual instability evidence materially affects the experience.
- Return at most seven fixes, ordered by structural impact before micro-polish.
- Golden reference alignment must name the principle being borrowed, never a layout to copy.

LIVE PAGE EVIDENCE
${pageText}`;
}

function normalizeOutput(task: AuthorizedRubricTask, evidence: RubricPageEvidence[], raw: z.infer<typeof modelOutputSchema>): QualityReviewInput {
  const allowedPaths = new Set(evidence.map((page) => page.path));
  if (raw.pages.some((page) => !allowedPaths.has(page.path))) throw new Error("Rubric reviewer returned an unobserved page path");
  if (new Set(raw.pages.map((page) => page.path)).size !== raw.pages.length) throw new Error("Rubric reviewer returned duplicate page paths");
  if (raw.pages.length !== evidence.length) throw new Error("Rubric reviewer omitted observed pages");

  const allowedSlop = new Set(slopIds);
  const allowedGates = new Set(gateIds);
  const allowedRefs = new Set(goldenReferences);
  const gates = raw.hardGates.filter((gate) => allowedGates.has(gate.id));
  if (new Set(gates.map((gate) => gate.id)).size !== gateIds.length) throw new Error("Rubric reviewer did not return every hard gate exactly once");

  return qualityReviewInputSchema.parse({
    projectId: task.projectId,
    reviewer: "archic-vision-reviewer",
    reviewedAt: new Date().toISOString(),
    pages: raw.pages.map((page) => ({
      ...page,
      slopFindings: page.slopFindings.filter((finding) => allowedSlop.has(finding.signalId)),
    })),
    hardGates: gates,
    topFixes: raw.topFixes,
    goldenReferenceAlignment: raw.goldenReferenceAlignment.filter((alignment) => allowedRefs.has(alignment.reference)),
  });
}

export async function reviewPreviewWithGoldenSet(input: {
  task: AuthorizedRubricTask;
  pages: RubricPageEvidence[];
}): Promise<QualityReviewInput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");
  const pages = z.array(rubricPageEvidenceSchema).min(1).max(4).parse(input.pages);
  const text = evidenceText(input.task, pages);
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text }];
  for (const page of pages) {
    content.push({ type: "input_text", text: `Desktop capture for ${page.path}` });
    content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${page.desktopImageBase64}`, detail: "high" });
    content.push({ type: "input_text", text: `Mobile capture for ${page.path}` });
    content.push({ type: "input_image", image_url: `data:image/jpeg;base64,${page.mobileImageBase64}`, detail: "high" });
  }

  const response = await fetch(responsesEndpoint(), {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.QUALITY_REVIEW_MODEL || "gpt-5.6-sol",
      input: [{ role: "user", content }],
      max_output_tokens: boundedInteger(process.env.QUALITY_REVIEW_MAX_OUTPUT_TOKENS, 14_000, 4_000, 24_000),
      text: { format: { type: "json_schema", name: "archic_quality_review", strict: true, schema: jsonSchema() } },
    }),
    signal: AbortSignal.timeout(boundedInteger(process.env.QUALITY_REVIEW_TIMEOUT_MS, 105_000, 30_000, 115_000)),
  });
  if (!response.ok) throw new Error(`OpenAI quality review failed (${response.status}): ${(await response.text()).slice(0, 800)}`);
  const parsed = modelOutputSchema.parse(JSON.parse(outputText(await response.json() as OpenAIResponse)));
  return normalizeOutput(input.task, pages, parsed);
}
