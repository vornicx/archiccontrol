import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-panel" id="main">
      <div className="login-form">
        <p className="eyebrow">404</p>
        <h1 className="page-title">This control surface does not exist.</h1>
        <p>Return to the operating overview.</p>
        <Link className="button button-primary" href="/">Overview</Link>
      </div>
    </main>
  );
}

