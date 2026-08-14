import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const taskType = process.env.TASK_TYPE;
const input = JSON.parse(process.env.TASK_INPUT || "{}");
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const scripts = pkg.scripts || {};
const evidence = [];

function run(script, required = false) {
  if (!scripts[script]) {
    if (required) throw new Error(`Required script is missing: ${script}`);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const child = spawn("npm", ["run", script], { stdio: "inherit", shell: false });
    child.on("exit", (code) => {
      evidence.push({ check: script, status: code === 0 ? "passed" : "failed", durationMs: Date.now() - started });
      if (code === 0) resolve();
      else reject(new Error(`${script} exited ${code}`));
    });
    child.on("error", reject);
  });
}

const started = Date.now();
if (taskType === "quality") {
  for (const script of ["lint", "typecheck", "test", "build", "test:e2e"]) await run(script);
} else if (taskType === "autofix") {
  await run("archic:autofix", true);
  for (const script of ["lint", "typecheck", "test", "build", "test:e2e"]) await run(script);
} else if (taskType === "playwright") {
  await run("test:e2e", true);
} else if (taskType === "smoke") {
  const baseUrl = input.baseUrl;
  if (typeof baseUrl !== "string" || !baseUrl.startsWith("https://")) throw new Error("Smoke task requires an HTTPS baseUrl");
  const response = await fetch(baseUrl, { redirect: "follow", signal: AbortSignal.timeout(20_000) });
  const html = await response.text();
  evidence.push({ check: "https", status: response.ok ? "passed" : "failed", statusCode: response.status });
  evidence.push({ check: "html", status: /<title[^>]*>.+<\/title>/is.test(html) && html.length > 1_000 ? "passed" : "failed" });
  if (!evidence.every((item) => item.status === "passed")) throw new Error("Smoke checks failed");
  await run("archic:journeys");
} else {
  await run(`archic:${taskType}`, true);
}

await writeFile(".archic/task-result.json", JSON.stringify({
  checks: evidence,
  durationMs: Date.now() - started,
  gateStatus: taskType === "quality" ? "passed" : undefined,
  qualityStatus: taskType === "smoke" && scripts["archic:journeys"] ? "passed" : taskType === "smoke" ? "needs_evidence" : undefined,
}, null, 2));
