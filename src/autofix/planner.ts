import "server-only";
import type { AuthorizedAutofixTask } from "@/autofix/task";
import { sanitizeAutofixPlan, type AutofixPlan } from "@/autofix/policy";

type OpenAIResponse = {
  output?: Array<{ type?: string; content?: Array<{ type?: string; text?: string }> }>;
};

export interface AutofixContextFile {
  path: string;
  content: string;
}

function outputText(payload: OpenAIResponse): string {
  for (const item of payload.output ?? []) {
    if (item.type !== "message") continue;
    for (const part of item.content ?? []) {
      if (part.type === "output_text" && part.text) return part.text;
    }
  }
  throw new Error("OpenAI autofix response did not contain structured output text");
}

function responsesEndpoint(): string {
  const configured = process.env.AUTOFIX_API_BASE_URL
    ?? process.env.ARCHIC_OPENAI_BASE_URL
    ?? process.env.OPENAI_BASE_URL
    ?? "https://api.openai.com";
  const base = configured.trim().replace(/\/+$/, "");
  if (!base) return "https://api.openai.com/v1/responses";
  return base.endsWith("/v1") ? `${base}/responses` : `${base}/v1/responses`;
}

function boundedInteger(value: string | undefined, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(parsed)));
}

function planSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["action", "summary", "confidence", "requestedPaths", "changes"],
    properties: {
      action: { type: "string", enum: ["apply", "need_files", "cannot_fix"] },
      summary: { type: "string" },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      requestedPaths: {
        type: "array",
        maxItems: 6,
        items: { type: "string" },
      },
      changes: {
        type: "array",
        maxItems: 4,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["path", "content", "reason"],
          properties: {
            path: { type: "string" },
            content: { type: "string" },
            reason: { type: "string" },
          },
        },
      },
    },
  };
}

function findingText(payload: Record<string, unknown>): string {
  const finding = typeof payload.finding === "object" && payload.finding ? payload.finding as Record<string, unknown> : {};
  return [
    `Summary: ${String(payload.summary ?? "Autofix benchmark finding")}`,
    `Check: ${String(finding.id ?? "unknown")}`,
    `Severity: ${String(finding.severity ?? "unknown")}`,
    `Detail: ${String(finding.detail ?? "")}`,
    `Recommended direction: ${String(finding.recommendation ?? "")}`,
  ].join("\n");
}

export async function planAutofix(input: {
  task: AuthorizedAutofixTask;
  fileIndex: string[];
  files: AutofixContextFile[];
  round: 1 | 2;
}): Promise<AutofixPlan> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const fileContext = input.files.map((file) => `\n--- FILE: ${file.path} ---\n${file.content}`).join("\n");
  const prompt = `You are the bounded code-repair engine inside Archic Control. Fix exactly one verified quality finding in a real production website repository.

Repository: ${input.task.repositoryFullName}
Task id: ${input.task.id}
Round: ${input.round} of 2

FINDING
${findingText(input.task.payload)}

OPERATING RULES
- Make the smallest high-quality change that actually addresses the finding without degrading the design.
- Preserve existing brand direction, architecture, copy truth and business behavior unless the finding specifically requires changing them.
- Never invent business claims, awards, prices, contact details, routes, integrations or customer facts.
- Do not change dependencies, lockfiles, CI, deployment configuration, secrets, environment files, database files or the Archic worker.
- Existing files may be changed only when their full content is provided below.
- You may create a new source/public file only when it is clearly required to solve the finding and can be implemented without guessing.
- Return full replacement content for each changed file, not a patch fragment.
- Maximum four changed files.
- If the necessary existing file is listed in REPOSITORY FILES but its contents are not provided, choose action=need_files and request only those exact paths (maximum six). Do not guess their contents.
- If the finding cannot be safely fixed with repository code or requires genuine business/design direction that cannot be inferred, choose action=cannot_fix and explain why in summary.
- When action=apply, requestedPaths must be empty. When action=need_files or cannot_fix, changes must be empty.

REPOSITORY FILES
${input.fileIndex.join("\n")}

PROVIDED FILE CONTENTS
${fileContext}`;

  const maxOutputTokens = boundedInteger(process.env.AUTOFIX_MAX_OUTPUT_TOKENS, 12_000, 2_000, 24_000);
  const requestTimeoutMs = boundedInteger(process.env.AUTOFIX_REQUEST_TIMEOUT_MS, 95_000, 30_000, 105_000);
  const response = await fetch(responsesEndpoint(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AUTOFIX_MODEL || "gpt-5.6-terra",
      input: prompt,
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: "archic_autofix_plan",
          strict: true,
          schema: planSchema(),
        },
      },
    }),
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  if (!response.ok) {
    throw new Error(`OpenAI autofix failed (${response.status}): ${(await response.text()).slice(0, 600)}`);
  }

  const raw = JSON.parse(outputText(await response.json() as OpenAIResponse)) as AutofixPlan;
  const sanitized = sanitizeAutofixPlan(raw, input.files.map((file) => file.path), input.fileIndex);
  if (sanitized.action === "need_files" && input.round === 2) {
    return {
      ...sanitized,
      action: "cannot_fix",
      requestedPaths: [],
      changes: [],
      summary: `${sanitized.summary} The planner already used its second context round.`.slice(0, 1_000),
    };
  }
  return sanitized;
}
