import Link from "next/link";
import { createLeadAction } from "@/app/sales/actions";
import { LeadForm } from "@/components/sales/lead-form";
import { salesOperationsConfigured } from "@/sales/operations-readiness";
import { getSalesPipelineStages } from "@/sales/repository";

export default async function NewSalesLeadPage() {
  const [operationsConfigured, stages] = await Promise.all([
    salesOperationsConfigured(),
    getSalesPipelineStages(),
  ]);

  return (
    <>
      <header className="sales-header">
        <div>
          <p className="sales-eyebrow">CRM · Alta manual</p>
          <h1 className="sales-title">Nuevo prospecto</h1>
          <p className="sales-subtitle">Guarda solo lo que sirve para vender: quién es, cuánto puede valer y cuál es el siguiente movimiento.</p>
        </div>
        <div className="sales-actions"><Link href="/sales/opportunities" className="sales-button secondary">Cancelar</Link></div>
      </header>
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
