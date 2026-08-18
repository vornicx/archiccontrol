import assert from "node:assert/strict";
import test from "node:test";
import {
  criterionIds,
  evaluateQualityRubric,
  qualityReviewInputSchema,
  qualityRubric,
  type CriterionId,
} from "../src/quality/rubric";

function criteria(value: number): Record<CriterionId, number> {
  return Object.fromEntries(criterionIds.map((id) => [id, value])) as Record<CriterionId, number>;
}

function review(overrides: Record<string, unknown> = {}) {
  return qualityReviewInputSchema.parse({
    projectId: "quality-fixture",
    reviewer: "test-suite",
    reviewedAt: "2026-08-18T12:00:00.000Z",
    pages: [{
      path: "/",
      label: "Inicio",
      mode: "Atmosphere",
      role: "home",
      criteria: criteria(8.6),
      sections: [
        { id: "hero", label: "Hero", kind: "hero", scores: { purpose: 4, specificity: 4, hierarchy: 4, composition: 4, handoff: 4 } },
        { id: "story", label: "Historia", kind: "standard", scores: { purpose: 4, specificity: 4, hierarchy: 4, composition: 4, handoff: 4 } },
      ],
      mobileScore: 90,
      mobileFindings: [],
      slopFindings: [],
    }],
    hardGates: qualityRubric.hard_gates.map((gate) => ({ id: gate.id, passed: true, evidence: "Verified in test fixture." })),
    topFixes: [],
    goldenReferenceAlignment: [{ reference: "Aman", principle: "deep architecture behind calm surface" }],
    ...overrides,
  });
}

test("rubric configuration keeps six page modes, fifty slop signals and ten hard gates", () => {
  assert.equal(Object.keys(qualityRubric.page_modes).length, 6);
  assert.equal(qualityRubric.ai_slop_detector.length, 50);
  assert.equal(qualityRubric.hard_gates.length, 10);
  for (const weights of Object.values(qualityRubric.page_modes)) {
    assert.equal(Object.values(weights).reduce((sum, weight) => sum + weight, 0), 100);
  }
});

test("an 8.6 review with clean gates is client-ready", () => {
  const result = evaluateQualityRubric(review());
  assert.equal(result.projectScore, 86);
  assert.equal(result.archicLevel, "8/10");
  assert.equal(result.status, "CLIENT_READY");
  assert.equal(result.hardGateFailures.length, 0);
  assert.equal(result.sectionFailures.length, 0);
});

test("a high AI slop signal blocks client-ready even when the numeric score remains above 80", () => {
  const input = review();
  input.pages[0].slopFindings = [{ signalId: "S41", evidence: "Quiet-luxury styling without useful information." }];
  const result = evaluateQualityRubric(input);
  assert.ok(result.projectScore >= 80);
  assert.equal(result.highSlopFindings, 1);
  assert.equal(result.status, "INTERNAL_ONLY");
});

test("a failed or missing rubric hard gate rejects the review", () => {
  const failed = review();
  failed.hardGates[0] = { ...failed.hardGates[0], passed: false, evidence: "Primary enquiry dead-ends." };
  assert.equal(evaluateQualityRubric(failed).status, "REJECT");

  const missing = review();
  missing.hardGates = missing.hardGates.slice(1);
  const missingResult = evaluateQualityRubric(missing);
  assert.equal(missingResult.status, "REJECT");
  assert.ok(missingResult.hardGateFailures.some((gate) => gate.id === "G01"));
});

test("a section below its threshold keeps an otherwise strong project internal", () => {
  const input = review();
  input.pages[0].sections[0].scores = { purpose: 4, specificity: 3, hierarchy: 3, composition: 3, handoff: 3 };
  const result = evaluateQualityRubric(input);
  assert.equal(result.sectionFailures[0]?.sectionId, "hero");
  assert.equal(result.status, "INTERNAL_ONLY");
});

test("flagship requires 90+ project score and every reviewed page at least 88", () => {
  const input = review();
  input.pages[0].criteria = criteria(9.2);
  const result = evaluateQualityRubric(input);
  assert.equal(result.projectScore, 92);
  assert.equal(result.archicLevel, "9/10");
  assert.equal(result.status, "FLAGSHIP_READY");
});
