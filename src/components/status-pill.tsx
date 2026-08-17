const statusLabels: Record<string, string> = {
  passed: "superado",
  failed: "fallido",
  needs_evidence: "falta evidencia",
  pending: "pendiente",
  approved: "aprobado",
  rejected: "rechazado",
  queued: "en cola",
  leased: "asignado",
  dispatched: "enviado",
  running: "en ejecución",
  succeeded: "completado",
  blocked: "bloqueado",
  ready: "listo",
  unknown: "desconocido",
  preview: "preview",
  production: "producción",
  critical: "crítico",
  high: "alto",
  medium: "medio",
  low: "bajo",
  fixing: "corrigiendo",
  resolved: "resuelto",
};

export function StatusPill({ status, label }: { status: string; label?: string }) {
  return <span className={`pill pill-${status}`}>{label ?? statusLabels[status] ?? status.replaceAll("_", " ")}</span>;
}
