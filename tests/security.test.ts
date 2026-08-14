import assert from "node:assert/strict";
import test from "node:test";
import { hmacHex, secureEqual } from "../src/lib/security";

test("constant-time comparison rejects different values and lengths", () => {
  assert.equal(secureEqual("same", "same"), true);
  assert.equal(secureEqual("same", "different"), false);
  assert.equal(secureEqual("short", "longer"), false);
});

test("HMAC output is deterministic and secret-bound", () => {
  assert.equal(hmacHex("one", "payload"), hmacHex("one", "payload"));
  assert.notEqual(hmacHex("one", "payload"), hmacHex("two", "payload"));
});
