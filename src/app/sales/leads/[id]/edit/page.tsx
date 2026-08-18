import Link from "next/link";
import { notFound } from "next/navigation";
import { updateLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { salesOperationsConfigured } from "@/sales/operations-readiness";
import { getSalesLead, getSalesPipelineStages } from "@/sales/repository";

export default async function EditSalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead }, stages, operationsConfigured] = await Promise.all([
    getSalesLead(id),
    getSalesPipelineStages(),
    salesOperationsConfigured(),
  ]);
  if (!lead) notFound();

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Editar oportunidad</p>
          <h1 className="sales-title">{lead.name}</h1>
          <p className="sales-subtitle">Actualiza la información comercial sin perder de vista el siguiente movimiento.</p>
        </div>
        <div className="sales-actions"><Link href={`/sales/leads/${lead.id}`} className="sales-button secondary">Volver a la ficha</Link></div>
      </header>
      {!operationsConfigured ? (
        <div className="sales-alert"><strong>CRM pendiente de migración.</strong> La ficha se puede revisar, pero guardar precios y datos ampliados requiere la migración 006.</div>
      ) : null}
      <LeadForm
        action={updateLeadAction}
        lead={lead}
        stages={stages}
        submitLabel="Guardar cambios"
        persistenceConfigured={operationsConfigured}
      />
    </>
  );
}
