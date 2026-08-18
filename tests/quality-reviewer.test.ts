import assert from "node:assert/strict";
import test from "node:test";
import { rubricPageEvidenceSchema } from "../src/quality/reviewer";

function pageEvidence(overrides: Record<string, unknown> = {}) {
  return {
    path: "/",
    title: "Fixture",
    bodyText: "Specific rendered content for the reviewed business.",
    headings: ["Fixture"],
    links: [{ text: "Contact", href: "https://example.com/contact" }],
    brokenImages: [],
    consoleErrors: [],
    overflowX: false,
    desktopImageBase64: "a".repeat(1_000),
    mobileImageBase64: "b".repeat(1_000),
    ...overrides,
  };
}

test("visual rubric evidence accepts paired desktop and mobile captures", () => {
  const parsed = rubricPageEvidenceSchema.parse(pageEvidence());
  assert.equal(parsed.path, "/");
  assert.equal(parsed.overflowX, false);
  assert.equal(parsed.desktopImageBase64.length, 1_000);
  assert.equal(parsed.mobileImageBase64.length, 1_000);
});

test("visual rubric evidence rejects oversized screenshots", () => {
  assert.throws(() => rubricPageEvidenceSchema.parse(pageEvidence({ desktopImageBase64: "a".repeat(420_001) })));
});

test("visual rubric evidence preserves DOM failures instead of hiding them", () => {
  const parsed = rubricPageEvidenceSchema.parse(pageEvidence({
    overflowX: true,
    brokenImages: ["https://example.com/broken.jpg"],
    consoleErrors: ["Unhandled error"],
  }));
  assert.equal(parsed.overflowX, true);
  assert.deepEqual(parsed.brokenImages, ["https://example.com/broken.jpg"]);
  assert.deepEqual(parsed.consoleErrors, ["Unhandled error"]);
});
