import assert from "node:assert/strict";
import test from "node:test";
import { validateGitHubOidcClaims } from "../src/lib/github-oidc";

const now = 1_800_000_000;
const base = {
  iss: "https://token.actions.githubusercontent.com",
  aud: "archic-control",
  exp: now + 300,
  nbf: now - 30,
  iat: now - 30,
  repository: "vornicx/marbellaforsale",
  ref: "refs/heads/main",
  workflow_ref: "vornicx/marbellaforsale/.github/workflows/archic-control.yml@refs/heads/main",
  event_name: "schedule",
  actor: "vornicx",
  run_id: "123",
};

test("GitHub OIDC accepts the exact Control adapter on main", () => {
  const identity = validateGitHubOidcClaims(base, now);
  assert.equal(identity.repository, "vornicx/marbellaforsale");
  assert.equal(identity.eventName, "schedule");
});

test("GitHub OIDC rejects a different audience", () => {
  assert.throws(() => validateGitHubOidcClaims({ ...base, aud: "other-service" }, now), /audience/);
});

test("GitHub OIDC rejects a different workflow in the same repository", () => {
  assert.throws(
    () => validateGitHubOidcClaims({ ...base, workflow_ref: "vornicx/marbellaforsale/.github/workflows/quality.yml@refs/heads/main" }, now),
    /workflow identity/,
  );
});

test("GitHub OIDC rejects non-main refs and pull request events", () => {
  assert.throws(() => validateGitHubOidcClaims({ ...base, ref: "refs/heads/feature" }, now), /refs\/heads\/main/);
  assert.throws(() => validateGitHubOidcClaims({ ...base, event_name: "pull_request" }, now), /event/);
});

test("GitHub OIDC rejects expired and old tokens", () => {
  assert.throws(() => validateGitHubOidcClaims({ ...base, exp: now - 120 }, now), /expired/);
  assert.throws(() => validateGitHubOidcClaims({ ...base, iat: now - 901 }, now), /issue time/);
});
