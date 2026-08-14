import { z } from "zod";

const selectorSchema = z.string().min(1).max(500);

export const journeyStepSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("goto"), path: z.string().startsWith("/") }),
  z.object({ action: z.literal("click"), selector: selectorSchema }),
  z.object({ action: z.literal("fill"), selector: selectorSchema, value: z.string().max(2_000) }),
  z.object({ action: z.literal("assertVisible"), selector: selectorSchema }),
  z.object({ action: z.literal("assertAnyVisible"), selectors: z.array(selectorSchema).min(1).max(12) }),
  z.object({ action: z.literal("assertUrl"), pattern: z.string().min(1).max(500) }),
  z.object({ action: z.literal("assertTitle"), pattern: z.string().min(1).max(500) }),
  z.object({ action: z.literal("assertNoConsoleErrors") }),
]);

export const journeyManifestSchema = z.object({
  schemaVersion: z.literal("1.0"),
  projectId: z.string().regex(/^[a-z0-9-]+$/),
  baseUrl: z.string().url().refine((value) => value.startsWith("https://"), "baseUrl must use HTTPS"),
  timeoutMs: z.number().int().min(1_000).max(120_000).default(30_000),
  journeys: z.array(z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    name: z.string().min(1).max(120),
    critical: z.boolean().default(true),
    viewports: z.array(z.enum(["desktop", "mobile"])).min(1),
    steps: z.array(journeyStepSchema).min(2).max(40),
  })).min(1).max(20),
}).superRefine((manifest, context) => {
  const ids = new Set<string>();
  for (const journey of manifest.journeys) {
    if (ids.has(journey.id)) {
      context.addIssue({ code: "custom", path: ["journeys"], message: `Duplicate journey id: ${journey.id}` });
    }
    ids.add(journey.id);
  }
});

export type JourneyManifest = z.infer<typeof journeyManifestSchema>;

export function parseJourneyManifest(value: unknown): JourneyManifest {
  return journeyManifestSchema.parse(value);
}

