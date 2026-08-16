import assert from "node:assert/strict";
import test from "node:test";
import {
  containsSensitiveAutofixContent,
  isAutofixContextPath,
  isSensitiveAutofixPath,
  sanitizeAutofixPlan,
  type AutofixPlan,
} from "../src/autofix/policy";

function applyPlan(changes: AutofixPlan["changes"]): AutofixPlan {
  return {
    action: "apply",
    summary: "Fix the verified finding.",
    confidence: "high",
    requestedPaths: [],
    changes,
  };
}

test("autofix blocks secrets, infrastructure and dependency state", () => {
  for (const path of [
    ".env",
    ".env.production",
    ".github/workflows/deploy.yml",
    ".archic/control-worker.mjs",
    "package-lock.json",
    "db/migrations/004.sql",
    "vercel.json",
    "src/credentials.ts",
  ]) {
    assert.equal(isSensitiveAutofixPath(path), true, path);
  }
});

test("package.json is readable context but never writable", () => {
  assert.equal(isAutofixContextPath("package.json"), true);
  const result = sanitizeAutofixPlan(
    applyPlan([{ path: "package.json", content: "{}", reason: "Do not allow dependency changes" }]),
    ["package.json"],
    ["package.json"],
  );
  assert.equal(result.action, "cannot_fix");
  assert.deepEqual(result.changes, []);
});

test("existing repository files cannot be changed unless their full contents were provided", () => {
  const result = sanitizeAutofixPlan(
    applyPlan([{ path: "src/app/page.tsx", content: "export default function Page(){return null}", reason: "Change page" }]),
    ["src/app/layout.tsx"],
    ["src/app/page.tsx", "src/app/layout.tsx"],
  );
  assert.equal(result.action, "cannot_fix");
});

test("need_files requests are limited to safe existing context paths", () => {
  const plan: AutofixPlan = {
    action: "need_files",
    summary: "Need route context.",
    confidence: "medium",
    requestedPaths: ["src/app/page.tsx", ".env", "missing.ts", "src/app/page.tsx", "package.json"],
    changes: [{ path: "src/app/layout.tsx", content: "ignored", reason: "must be removed" }],
  };
  const result = sanitizeAutofixPlan(plan, [], ["src/app/page.tsx", ".env", "package.json"]);
  assert.deepEqual(result.requestedPaths, ["src/app/page.tsx", "package.json"]);
  assert.deepEqual(result.changes, []);
});

test("safe new source and SEO files are allowed", () => {
  const result = sanitizeAutofixPlan(
    applyPlan([
      { path: "src/app/robots.ts", content: "export default function robots(){return {rules:{userAgent:'*',allow:'/'}}}", reason: "Add robots metadata route" },
      { path: "sitemap.xml", content: "<?xml version=\"1.0\"?><urlset></urlset>", reason: "Add static sitemap" },
    ]),
    [],
    ["src/app/page.tsx"],
  );
  assert.equal(result.action, "apply");
  assert.deepEqual(result.changes.map((change) => change.path), ["src/app/robots.ts", "sitemap.xml"]);
});

test("autofix caps one finding at four changed files", () => {
  const changes = Array.from({ length: 7 }, (_, index) => ({
    path: `src/components/Fix${index}.tsx`,
    content: `export const Fix${index}=()=>null`,
    reason: `bounded fix ${index}`,
  }));
  const result = sanitizeAutofixPlan(applyPlan(changes), [], []);
  assert.equal(result.changes.length, 4);
});

test("credential-like literal content never reaches or leaves the planner boundary", () => {
  assert.equal(containsSensitiveAutofixContent("const token = 'sk-abcdefghijklmnopqrstuvwxyz123456';"), true);
  assert.equal(containsSensitiveAutofixContent("const title = 'Premium vehicle rental';"), false);
  const result = sanitizeAutofixPlan(
    applyPlan([{ path: "src/config.ts", content: "const token='github_pat_abcdefghijklmnopqrstuvwxyz123456'", reason: "unsafe" }]),
    ["src/config.ts"],
    ["src/config.ts"],
  );
  assert.equal(result.action, "cannot_fix");
});
