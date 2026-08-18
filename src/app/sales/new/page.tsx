import { createLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { Topbar } from "@/components/topbar";
import { salesOperationsConfigured } from "@/sales/operations-readiness";
import { getSalesPipelineStages } from "@/sales/repository";

export default async function NewSalesLeadPage() {
  const [operationsConfigured, stages] = await Promise.all([
    salesOperationsConfigured(),
    getSalesPipelineStages(),
  ]);

  return (
    <>
      <Topbar eyebrow="Comercial" title="Nuevo prospecto" meta="Alta manual" />
      {!operationsConfigured ? (
        <div className="sales-alert"><strong>CRM pendiente de migración.</strong> Aplica la migración 006 de Ventas para activar altas manuales, precios, contactos y configuración del pipeline.</div>
      ) : null}
      <LeadForm
        action={createLeadAction}
        stages={stages}
        submitLabel="Crear prospecto"
        includeInitialContact
        persistenceConfigured={operationsConfigured}
      />
    </>
  );
}
