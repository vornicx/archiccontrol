import { notFound } from "next/navigation";
import { updateLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { Topbar } from "@/components/topbar";
import { getSalesLead, getSalesPipelineStages } from "@/sales/repository";

export default async function EditSalesLeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ lead, persistenceConfigured }, stages] = await Promise.all([
    getSalesLead(id),
    getSalesPipelineStages(),
  ]);
  if (!lead) notFound();

  return (
    <>
      <Topbar eyebrow="Comercial · Edición" title={lead.name} meta="Ficha completa" />
      {!persistenceConfigured ? (
        <div className="sales-alert"><strong>Modo de prueba.</strong> La ficha se puede revisar, pero los cambios requieren persistencia.</div>
      ) : null}
      <LeadForm
        action={updateLeadAction}
        lead={lead}
        stages={stages}
        submitLabel="Guardar cambios"
        persistenceConfigured={persistenceConfigured}
      />
    </>
  );
}
