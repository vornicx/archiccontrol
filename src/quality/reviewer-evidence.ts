import { z } from "zod";

export const rubricPageEvidenceSchema = z.object({
  path: z.string().min(1).max(300),
  title: z.string().max(500),
  bodyText: z.string().max(20_000),
  headings: z.array(z.string().max(500)).max(80),
  links: z.array(z.object({ text: z.string().max(300), href: z.string().max(1_000) })).max(160),
  brokenImages: z.array(z.string().max(1_000)).max(40),
  consoleErrors: z.array(z.string().max(1_000)).max(30),
  overflowX: z.boolean(),
  desktopImageBase64: z.string().min(100).max(420_000),
  mobileImageBase64: z.string().min(100).max(420_000),
});

export type RubricPageEvidence = z.infer<typeof rubricPageEvidenceSchema>;
