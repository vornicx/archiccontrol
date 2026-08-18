import { createLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { Topbar } from "@/components/topbar";
import { getSalesData, getSalesPipelineStages } from "@/sales/repository";

export default async function NewSalesLeadPage() {
  const [{ persistenceConfigured }, stages] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
  ]);

  return (
    <>
      <Topbar eyebrow="Comercial" title="Nuevo prospecto" meta="Alta manual" />
      {!persistenceConfigured ? (
        <div className="sales-alert"><strong>Falta persistencia.</strong> Aplica las migraciones de Ventas y configura DATABASE_URL para poder crear oportunidades.</div>
      ) : null}
      <LeadForm
        action={createLeadAction}
        stages={stages}
        submitLabel="Crear prospecto"
        includeInitialContact
        persistenceConfigured={persistenceConfigured}
      />
    </>
  );
}
