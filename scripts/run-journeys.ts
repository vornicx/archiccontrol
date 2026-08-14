import { readFile } from "node:fs/promises";
import { chromium, type Page } from "@playwright/test";
import { parseJourneyManifest, type JourneyManifest } from "../src/automation/journey-schema";

const projectId = process.argv[2];
if (!projectId || !/^[a-z0-9-]+$/.test(projectId)) {
  throw new Error("Usage: npm run journeys:run -- <project-id> [base-url]");
}

const raw = JSON.parse(await readFile(new URL(`../config/journeys/${projectId}.json`, import.meta.url), "utf8"));
const manifest = parseJourneyManifest({ ...raw, baseUrl: process.argv[3] ?? raw.baseUrl });
const browser = await chromium.launch({ headless: true });
const results: Array<{ journey: string; viewport: string; status: "passed" | "failed"; error?: string }> = [];

async function runSteps(page: Page, journey: JourneyManifest["journeys"][number]) {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("favicon")) consoleErrors.push(message.text());
  });
  for (const step of journey.steps) {
    if (step.action === "goto") {
      const response = await page.goto(new URL(step.path, manifest.baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: manifest.timeoutMs });
      if (!response?.ok()) throw new Error(`Navigation returned ${response?.status() ?? "no response"}`);
    } else if (step.action === "click") {
      await page.locator(step.selector).first().click({ timeout: manifest.timeoutMs });
    } else if (step.action === "fill") {
      await page.locator(step.selector).first().fill(step.value, { timeout: manifest.timeoutMs });
    } else if (step.action === "assertVisible") {
      await page.locator(step.selector).first().waitFor({ state: "visible", timeout: manifest.timeoutMs });
    } else if (step.action === "assertAnyVisible") {
      const matches = await Promise.all(step.selectors.map((selector) => page.locator(selector).first().isVisible().catch(() => false)));
      if (!matches.some(Boolean)) throw new Error(`None of the conversion selectors is visible: ${step.selectors.join(", ")}`);
    } else if (step.action === "assertUrl") {
      if (!new RegExp(step.pattern).test(page.url())) throw new Error(`URL ${page.url()} does not match ${step.pattern}`);
    } else if (step.action === "assertTitle") {
      const title = await page.title();
      if (!new RegExp(step.pattern).test(title)) throw new Error(`Title ${JSON.stringify(title)} does not match ${step.pattern}`);
    } else if (step.action === "assertNoConsoleErrors" && consoleErrors.length) {
      throw new Error(`Console errors: ${consoleErrors.slice(0, 3).join(" · ")}`);
    }
  }
}

try {
  for (const journey of manifest.journeys) {
    for (const viewport of journey.viewports) {
      const context = await browser.newContext({ viewport: viewport === "mobile" ? { width: 390, height: 844 } : { width: 1440, height: 1000 } });
      const page = await context.newPage();
      try {
        await runSteps(page, journey);
        results.push({ journey: journey.id, viewport, status: "passed" });
      } catch (error) {
        results.push({ journey: journey.id, viewport, status: "failed", error: error instanceof Error ? error.message : String(error) });
      } finally {
        await context.close();
      }
    }
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify({ projectId, baseUrl: manifest.baseUrl, results }, null, 2));
if (results.some((result) => result.status === "failed")) process.exitCode = 1;

