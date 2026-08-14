import { DecisionCard } from "@/components/decision-card";
import { Topbar } from "@/components/topbar";
import { getDashboard } from "@/lib/repository";

export default async function DecisionsPage() {
  const data = await getDashboard();
  return (
    <>
      <Topbar eyebrow="Human boundary" title="Decision queue" meta={`${data.needsVadim.length} pending`} />
      <section className="section">
        {data.needsVadim.length
          ? data.needsVadim.map((decision) => <DecisionCard decision={decision} key={decision.id} />)
          : <div className="empty-decision"><div><strong>Queue clear.</strong>No decision currently requires Vadim.</div></div>}
      </section>
    </>
  );
}

