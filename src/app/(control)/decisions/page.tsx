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
      <Topbar eyebrow="Límite humano" title="Cola de decisiones" meta={`${actionableDecisions.length} pendientes`} />
      <section className="section">
        {actionableDecisions.length
          ? actionableDecisions.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
          : <div className="empty-decision"><div><strong>Cola despejada.</strong> Ninguna decisión necesita ahora mismo a Vadim.</div></div>}
      </section>
    </>
  );
}
