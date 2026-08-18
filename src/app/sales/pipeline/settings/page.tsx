import { updatePipelineStageAction } from "@/app/sales/actions";
import { Topbar } from "@/components/topbar";
import { getSalesData, getSalesPipelineStages } from "@/sales/repository";
import styles from "./pipeline-settings.module.css";

export default async function SalesPipelineSettingsPage() {
  const [{ persistenceConfigured }, stages] = await Promise.all([
    getSalesData(),
    getSalesPipelineStages(),
  ]);

  return (
    <>
      <Topbar eyebrow="Comercial · Configuración" title="Pipeline" meta={`${stages.length} etapas`} />
      <p className={styles.note}>Puedes renombrar etapas, cambiar su orden, ocultarlas del pipeline y ajustar la probabilidad comercial. Las claves internas se mantienen estables para no romper automatizaciones ni historial.</p>
      {!persistenceConfigured ? <div className="sales-alert"><strong>Modo de prueba.</strong> La configuración se puede revisar, pero guardar requiere persistencia.</div> : null}
      <div className={styles.list}>
        {stages.map((stage) => (
          <form action={updatePipelineStageAction} className={styles.stage} key={stage.key}>
            <input type="hidden" name="key" value={stage.key} />
            <div className={styles.field}>
              <label htmlFor={`label-${stage.key}`}>Nombre visible</label>
              <input id={`label-${stage.key}`} name="label" defaultValue={stage.label} disabled={!persistenceConfigured} />
              <span className={styles.key}>{stage.key}{stage.terminal ? " · etapa terminal" : ""}</span>
            </div>
            <div className={styles.field}>
              <label htmlFor={`position-${stage.key}`}>Orden</label>
              <input id={`position-${stage.key}`} name="position" type="number" min="0" step="1" defaultValue={stage.position} disabled={!persistenceConfigured} />
            </div>
            <div className={styles.field}>
              <label htmlFor={`probability-${stage.key}`}>Probabilidad %</label>
              <input id={`probability-${stage.key}`} name="probability" type="number" min="0" max="100" step="1" defaultValue={stage.probability} disabled={!persistenceConfigured} />
            </div>
            <label className={styles.checkbox}>
              <input type="checkbox" name="active" defaultChecked={stage.active} disabled={!persistenceConfigured} />
              <span>Visible</span>
            </label>
            <button className={styles.save} type="submit" disabled={!persistenceConfigured}>Guardar etapa</button>
          </form>
        ))}
      </div>
    </>
  );
}
