export function Topbar({ eyebrow = "Archic Control", title, meta }: { eyebrow?: string; title: string; meta?: string }) {
  return (
    <header className="topbar">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="page-title">{title}</h1>
      </div>
      {meta ? <div className="topbar-meta"><strong>Última reconciliación</strong>{meta}</div> : null}
    </header>
  );
}
