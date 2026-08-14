import assert from "node:assert/strict";
import test from "node:test";
import { benchmarkSnapshot, buildBootstrapDashboard } from "../src/lib/bootstrap";
import { evaluateQualityGate } from "../src/quality/gate";
import { needsVadim } from "../src/quality/needs-vadim";
import { qualityStandard, standardStats } from "../src/quality/standard";

test("Quality Standard v1.0 preserves every canonical check", () => {
  const sectionCounts = Object.fromEntries(qualityStandard.sections.map((section) => [section.code, section.checks.length]));
  assert.deepEqual(sectionCounts, { A: 8, B: 12, C: 10, D: 11, E: 10, F: 10, G: 17, H: 9 });
  assert.equal(standardStats.checks, 88);
  const ids = qualityStandard.sections.flatMap((section) => section.checks.map((check) => check.id));
  assert.equal(new Set(ids).size, ids.length);
});

test("a benchmark hard gate blocks promotion before Vadim is interrupted", () => {
  const project = benchmarkSnapshot.projects.find((candidate) => candidate.id === "marbella-for-sale");
  assert.ok(project);
  const result = evaluateQualityGate(project);
  assert.equal(result.status, "failed");
  assert.equal(result.promotion, "blocked");
  assert.ok(result.blockers.some((check) => check.id === "benchmark-hard-gates"));
});

test("a clean project waits for evidence and then crosses the human boundary", () => {
  const base = benchmarkSnapshot.projects[0];
  const clean = { ...base, id: "clean", score: 96, gates: [], issues: [] };
  const waiting = evaluateQualityGate(clean);
  assert.equal(waiting.status, "needs_evidence");
  assert.equal(waiting.promotion, "preview");
  const passed = evaluateQualityGate(clean, { manualEvidenceComplete: true, polishPassed: true });
  assert.equal(passed.status, "passed");
  assert.equal(passed.promotion, "human_approval");
});

test("Needs Vadim suppresses ordinary retryable work", () => {
  assert.equal(needsVadim({ retryable: true, retryCount: 1, knownFix: true }), false);
  assert.equal(needsVadim({ type: "final_approval", qualityGatePassed: true }), true);
  assert.equal(needsVadim({ type: "brand_direction", requiresBusinessJudgement: true }), true);
});

test("bootstrap is real benchmark state, not invented portfolio data", () => {
  const dashboard = buildBootstrapDashboard();
  assert.equal(dashboard.projects.length, 6);
  assert.equal(dashboard.portfolio.score, benchmarkSnapshot.portfolio.score);
  assert.equal(dashboard.projects.find((project) => project.id === "la-bocana")?.score, 93.4);
  assert.equal(dashboard.needsVadim.length, 1);
});
