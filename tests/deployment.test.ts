import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("Vercel cron configuration remains compatible with the Hobby control-plane account", async () => {
  const config = JSON.parse(await readFile(new URL("../vercel.json", import.meta.url), "utf8")) as { crons?: Array<{ path: string; schedule: string }> };
  const crons = config.crons ?? [];
  assert.ok(crons.length <= 2, "Hobby permits at most two cron jobs");
  for (const cron of crons) {
    const [minute, hour] = cron.schedule.trim().split(/\s+/);
    assert.match(minute, /^\d+$/, `${cron.path} must run no more than once per day on Hobby`);
    assert.match(hour, /^\d+$/, `${cron.path} must run no more than once per day on Hobby`);
    assert.match(cron.path, /^\/api\/cron\//);
  }
});

