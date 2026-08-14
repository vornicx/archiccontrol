import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseJourneyManifest } from "../src/automation/journey-schema";

const directory = new URL("../config/journeys/", import.meta.url);
const files = (await readdir(directory)).filter((file) => file.endsWith(".json")).sort();
if (files.length === 0) throw new Error("No journey manifests found");

for (const file of files) {
  const manifest = parseJourneyManifest(JSON.parse(await readFile(new URL(file, directory), "utf8")));
  if (`${manifest.projectId}.json` !== file) throw new Error(`${file}: filename must match projectId`);
  console.log(`✓ ${manifest.projectId}: ${manifest.journeys.length} critical journey contract(s)`);
}

console.log(`Validated ${files.length} project journey manifests in ${join("config", "journeys")}.`);

