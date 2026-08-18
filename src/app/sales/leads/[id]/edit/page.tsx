import { notFound } from "next/navigation";
import { updateLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { Topbar } from "@/components/topbar";
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
      <Topbar eyebrow="Comercial · Edición" title={lead.name} meta="Ficha completa" />
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
