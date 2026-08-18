import assert from "node:assert/strict";
import test from "node:test";
import type { ProspectRecord } from "../src/prospecting/types";
import { estimateProspectOpportunity } from "../src/prospecting/value-estimator";

function prospect(overrides: Partial<ProspectRecord> = {}): ProspectRecord {
  return {
    id: "prospect-1",
    runDate: "2026-08-18",
    name: "Ejemplo",
    city: "Marbella",
    category: "Restaurante",
    websiteUrl: null,
    socialUrl: null,
    status: "verified",
    score: 80,
    verificationConfidence: "high",
    evidence: [
      { sourceName: "Web", url: "https://example.com", kind: "official_site", observedAt: null, detail: "Activa" },
      { sourceName: "Maps", url: "https://example.com/maps", kind: "map_listing", observedAt: null, detail: "Abierto" },
      { sourceName: "Instagram", url: "https://example.com/social", kind: "social_recent", observedAt: null, detail: "Reciente" },
    ],
    research: { websiteGap: "La web está desactualizada y no tiene reservas", services: ["reservas"] },
    price: {},
    outreach: {},
    repositoryFullName: null,
    deploymentUrl: null,
    error: null,
    createdAt: "2026-08-18T08:00:00.000Z",
    updatedAt: "2026-08-18T08:00:00.000Z",
    ...overrides,
  };
}

test("the automatic estimate is explainable and independent from the manual potential price", () => {
  const base = prospect();
  const withManualPrice = prospect({ price: { potential: 5000, potentialSetBy: "manual" } });
  const first = estimateProspectOpportunity(base);
  const second = estimateProspectOpportunity(withManualPrice);

  assert.equal(first.amount, second.amount);
  assert.equal(first.minimum, second.minimum);
  assert.equal(first.maximum, second.maximum);
  assert.match(first.rationale, /score 80\/100/);
  assert.ok(first.minimum < first.amount);
  assert.ok(first.maximum > first.amount);
});

test("higher-complexity categories and product requirements increase the estimate", () => {
  const local = estimateProspectOpportunity(prospect({ category: "Cafetería", research: { websiteGap: "Web básica" } }));
  const platform = estimateProspectOpportunity(prospect({
    category: "Inmobiliaria",
    research: { websiteGap: "Buscador roto", services: ["catálogo de propiedades", "CRM", "panel owner", "multidioma"] },
  }));

  assert.ok(platform.amount > local.amount);
  assert.ok(platform.factors.some((factor) => factor.includes("panel")));
  assert.ok(platform.factors.some((factor) => factor.includes("catálogo")));
});
