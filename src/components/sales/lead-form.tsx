import Link from "next/link";
import type { SalesLead, SalesPipelineStage } from "@/sales/types";
import styles from "./lead-form.module.css";

function madridInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}`;
}

export function LeadForm({
  action,
  lead,
  stages,
  submitLabel,
  includeInitialContact = false,
  persistenceConfigured = true,
}: {
  action: (formData: FormData) => Promise<void>;
  lead?: SalesLead;
  stages: SalesPipelineStage[];
  submitLabel: string;
  includeInitialContact?: boolean;
  persistenceConfigured?: boolean;
}) {
  const activeStages = stages.filter((stage) => stage.active || stage.key === lead?.stage);
  return (
    <form action={action} className={styles.form}>
      {lead ? <input type="hidden" name="leadId" value={lead.id} /> : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>Esencial</span><h2>Negocio</h2></div>
          <p>Identifica el negocio y de dónde viene.</p>
        </div>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="name">Nombre del negocio</label>
            <input id="name" name="name" defaultValue={lead?.name ?? ""} placeholder="Ej. Cafetería Rosario" required />
          </div>
          <div className={styles.field}>
            <label htmlFor="city">Ciudad / zona</label>
            <input id="city" name="city" defaultValue={lead?.city ?? ""} placeholder="Écija, Marbella…" />
          </div>
          <div className={styles.field}>
            <label htmlFor="category">Tipo de negocio</label>
            <input id="category" name="category" defaultValue={lead?.category ?? ""} placeholder="Restaurante, inmobiliaria, renting…" />
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="source">Cómo llegó al CRM</label>
            <input id="source" name="source" defaultValue={lead?.source ?? ""} placeholder="Prospección, recomendación, inbound…" />
          </div>
        </div>
      </section>

      {includeInitialContact ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div><span className={styles.eyebrow}>Persona</span><h2>Contacto inicial</h2></div>
            <p>Con uno basta para empezar; podrás añadir más después.</p>
          </div>
          <div className={styles.grid}>
            <div className={styles.field}>
              <label htmlFor="contactName">Nombre / por quién preguntar</label>
              <input id="contactName" name="contactName" placeholder="Encargado, María…" />
            </div>
            <div className={styles.field}>
              <label htmlFor="contactRole">Cargo</label>
              <input id="contactRole" name="contactRole" placeholder="Dueño, gerente, marketing…" />
            </div>
            <div className={styles.field}>
              <label htmlFor="phone">Teléfono</label>
              <input id="phone" name="phone" inputMode="tel" />
            </div>
            <div className={styles.field}>
              <label htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" name="whatsapp" inputMode="tel" />
            </div>
            <div className={`${styles.field} ${styles.full}`}>
              <label htmlFor="email">Correo</label>
              <input id="email" name="email" type="email" />
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>Negocio</span><h2>Comercial</h2></div>
          <p>Etapa, responsable y dinero en la misma zona.</p>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="stage">Etapa</label>
            <select id="stage" name="stage" defaultValue={lead?.stage ?? "researched"}>
              {activeStages.map((stage) => <option value={stage.key} key={stage.key}>{stage.label}</option>)}
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="owner">Responsable del lead</label>
            <select id="owner" name="owner" defaultValue={lead?.owner ?? "antero"}>
              <option value="antero">Antero</option>
              <option value="vadim">Vadim</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="score">Puntuación comercial</label>
            <input id="score" name="score" type="number" min="0" max="100" step="1" defaultValue={lead?.score ?? ""} placeholder="0–100" />
          </div>
          <div className={styles.field}>
            <label htmlFor="estimatedValue">Potencial estimado</label>
            <input id="estimatedValue" name="estimatedValue" type="number" min="0" step="1" defaultValue={lead?.estimatedValue ?? ""} placeholder="700" />
            <span className={styles.hint}>Antes de presupuestar.</span>
          </div>
          <div className={styles.field}>
            <label htmlFor="quotedPrice">Presupuesto enviado</label>
            <input id="quotedPrice" name="quotedPrice" type="number" min="0" step="1" defaultValue={lead?.quotedPrice ?? ""} placeholder="650" />
            <span className={styles.hint}>La cifra ofrecida al cliente.</span>
          </div>
          <div className={styles.field}>
            <label htmlFor="maintenanceMonthly">Mantenimiento mensual</label>
            <input id="maintenanceMonthly" name="maintenanceMonthly" type="number" min="0" step="1" defaultValue={lead?.maintenanceMonthly ?? ""} placeholder="69" />
            <span className={styles.hint}>Ingreso recurrente asociado.</span>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.nextSection}`}>
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>Acción</span><h2>Siguiente paso</h2></div>
          <p>Si el lead está activo, debe quedar claro qué pasa después.</p>
        </div>
        <div className={styles.grid}>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="nextAction">Qué hay que hacer</label>
            <input id="nextAction" name="nextAction" defaultValue={lead?.nextAction ?? ""} placeholder="Llamar y enseñar el prototipo" />
          </div>
          <div className={styles.field}>
            <label htmlFor="nextActionOwner">Quién lo hace</label>
            <select id="nextActionOwner" name="nextActionOwner" defaultValue={lead?.nextActionOwner ?? "antero"}>
              <option value="antero">Antero</option>
              <option value="vadim">Vadim</option>
            </select>
          </div>
          <div className={styles.field}>
            <label htmlFor="nextActionAt">Cuándo</label>
            <input id="nextActionAt" name="nextActionAt" type="datetime-local" data-archic-native-date-ok defaultValue={madridInputValue(lead?.nextActionAt)} />
            <span className={styles.hint}>Hora de Madrid.</span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <div><span className={styles.eyebrow}>Contexto</span><h2>Recursos y notas</h2></div>
          <p>Lo necesario para retomar la conversación sin investigar otra vez.</p>
        </div>
        <div className={styles.grid}>
          <div className={styles.field}>
            <label htmlFor="websiteUrl">Web</label>
            <input id="websiteUrl" name="websiteUrl" type="url" defaultValue={lead?.websiteUrl ?? ""} placeholder="https://…" />
          </div>
          <div className={styles.field}>
            <label htmlFor="socialUrl">Red social principal</label>
            <input id="socialUrl" name="socialUrl" type="url" defaultValue={lead?.socialUrl ?? ""} placeholder="https://instagram.com/…" />
          </div>
          <div className={styles.field}>
            <label htmlFor="prototypeUrl">Prototipo</label>
            <input id="prototypeUrl" name="prototypeUrl" type="url" defaultValue={lead?.prototypeUrl ?? ""} placeholder="https://…" />
          </div>
          <div className={styles.field}>
            <label htmlFor="repositoryFullName">Repositorio</label>
            <input id="repositoryFullName" name="repositoryFullName" defaultValue={lead?.repositoryFullName ?? ""} placeholder="vornicx/proyecto" />
          </div>
          <div className={`${styles.field} ${styles.full}`}>
            <label htmlFor="notes">Notas internas</label>
            <textarea id="notes" name="notes" defaultValue={lead?.notes ?? ""} placeholder="Qué sabemos, qué le importa, objeciones, contexto…" />
          </div>
        </div>
      </section>

      <div className={styles.actions}>
        <Link className={styles.cancel} href={lead ? `/sales/leads/${lead.id}` : "/sales"}>Cancelar</Link>
        <button className={styles.submit} type="submit" disabled={!persistenceConfigured}>{submitLabel}</button>
      </div>
    </form>
  );
}
