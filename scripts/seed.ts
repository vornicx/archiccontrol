import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);
const report = JSON.parse(await readFile(new URL("../src/data/benchmark-snapshot.json", import.meta.url), "utf8"));

for (const project of report.projects) {
  const gateStatus = project.gates.length ? "failed" : project.score >= 90 ? "needs_evidence" : "failed";
  await sql.query(
    `insert into projects(id,name,repository_full_name,production_url,benchmark_profile,phase,current_score,gate_status,last_benchmark_at)
     values($1,$2,$3,$4,$5,'quality',$6,$7,$8)
     on conflict(id) do update set current_score=excluded.current_score,last_benchmark_at=excluded.last_benchmark_at`,
    [project.id, project.name, project.repository, project.url, project.profile, project.score, gateStatus, report.generatedAt],
  );

  const proposedRunId = randomUUID();
  const runRows = await sql.query(
    `insert into quality_runs(id,project_id,source,status,raw_score,final_score,input,output,started_at,completed_at)
     values($1,$2,'archic-benchmark',$3,$4,$5,$6::jsonb,$7::jsonb,$8,$8)
     on conflict(project_id,source,started_at) do update set
       status=excluded.status, raw_score=excluded.raw_score, final_score=excluded.final_score, input=excluded.input
     returning id`,
    [proposedRunId, project.id, gateStatus, project.rawScore ?? project.score, project.score, JSON.stringify(project), JSON.stringify({ status: gateStatus, source: "seed" }), report.generatedAt],
  );
  const runId = String(runRows[0].id);

  for (const issue of project.issues) {
    const severity = ["critical", "high", "medium", "low"].includes(String(issue.severity).toLowerCase())
      ? String(issue.severity).toLowerCase()
      : "medium";
    await sql.query(
      `insert into findings(id,run_id,project_id,check_id,source,severity,status,title,detail,evidence,automation_action,owner_type)
       values($1,$2,$3,$4,'benchmark',$5,'open',$6,$7,$8::jsonb,$9,'agent')
       on conflict(id) do update set run_id=excluded.run_id,severity=excluded.severity,title=excluded.title,detail=excluded.detail,evidence=excluded.evidence`,
      [
        `${project.id}:benchmark:${issue.id}`,
        runId,
        project.id,
        issue.id,
        severity,
        issue.title,
        issue.detail ?? "",
        JSON.stringify({ raw: issue.evidence ?? null, priority: issue.priority ?? null, gate: issue.id.startsWith("gate-") }),
        issue.recommendation ?? null,
      ],
    );
  }

  await sql.query(
    `insert into workflow_runs(id,project_id,workflow,stage,status,summary,external_url,started_at,completed_at)
     values($1,$2,'Daily quality pipeline','benchmark',$3,$4,'https://archicbenchmark.vercel.app',$5,$5)
     on conflict(id) do nothing`,
    [
      `benchmark:${project.id}:${report.generatedAt}`,
      project.id,
      project.status === "ok" ? "succeeded" : "failed",
      `${project.score.toFixed(1)} / 100 · ${project.gates.length} active gate(s)`,
      report.generatedAt,
    ],
  );
}

await sql.query(
  `insert into decisions(id,type,title,context,recommendation,risk,status,blocking,requested_by)
   values(
     'ratify-quality-standard-v1',
     'irreversible_action',
     'Ratify Archic Quality Standard v1.0',
     'The standard unifies 87 delivery checks, the mandatory Polish pass, benchmark thresholds and the promotion policy used by Archic Control.',
     'Approve v1.0 as the required baseline for every production delivery. Amendments ship as explicit versions.',
     'Approval makes the gate binding. Projects that score well but lack evidence remain blocked.',
     'pending',
     true,
     'control'
   ) on conflict(id) do nothing`,
);

console.log(`Seeded ${report.projects.length} real benchmark projects.`);
