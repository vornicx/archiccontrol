import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-panel" id="main">
      <div className="login-form">
        <p className="eyebrow">404</p>
        <h1 className="page-title">Esta sección de Archic Control no existe.</h1>
        <p>Vuelve al resumen operativo.</p>
        <Link className="button button-primary" href="/">Ir al resumen</Link>
      </div>
    </main>
  );
}
