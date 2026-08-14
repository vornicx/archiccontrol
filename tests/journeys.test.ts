import test from "node:test";
import assert from "node:assert/strict";
import { journeyManifests } from "../src/automation/manifests";
import { journeyManifestSchema } from "../src/automation/journey-schema";

test("all audited projects have valid desktop and mobile critical journeys", () => {
  assert.equal(journeyManifests.size, 6);
  for (const [projectId, manifest] of journeyManifests) {
    assert.equal(journeyManifestSchema.safeParse(manifest).success, true, projectId);
    assert.ok(manifest.journeys.some((journey) => journey.critical && journey.viewports.includes("desktop")), `${projectId} desktop`);
    assert.ok(manifest.journeys.some((journey) => journey.critical && journey.viewports.includes("mobile")), `${projectId} mobile`);
  }
});

test("journey DSL rejects insecure base URLs", () => {
  const result = journeyManifestSchema.safeParse({
    schemaVersion: "1.0", projectId: "unsafe", baseUrl: "http://example.com", timeoutMs: 30_000,
    journeys: [{ id: "home", name: "Home", critical: true, viewports: ["desktop"], steps: [{ action: "goto", path: "/" }, { action: "assertVisible", selector: "body" }] }],
  });
  assert.equal(result.success, false);
});

