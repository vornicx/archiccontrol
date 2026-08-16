import { DecisionCard } from "@/components/decision-card";
import { Topbar } from "@/components/topbar";
import { getBenchmarkHealth } from "@/lib/benchmark-health";
import { getDashboard } from "@/lib/repository";

export default async function DecisionsPage() {
  const [data, benchmarkHealth] = await Promise.all([getDashboard(), getBenchmarkHealth()]);
  const actionableDecisions = benchmarkHealth.fresh
    ? data.needsVadim
    : data.needsVadim.filter((decision) => decision.type !== "final_approval");

  return (
    <>
      <Topbar eyebrow="Human boundary" title="Decision queue" meta={`${actionableDecisions.length} pending`} />
      <section className="section">
        {actionableDecisions.length
          ? actionableDecisions.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
          : <div className="empty-decision"><div><strong>Queue clear.</strong>No decision currently requires Vadim.</div></div>}
      </section>
    </>
  );
}
