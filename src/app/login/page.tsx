import { redirect } from "next/navigation";
import { ArchicMark } from "@/components/icons";
import { LoginForm } from "@/components/login-form";
import { hasSession } from "@/lib/auth";

export default async function LoginPage() {
  if (await hasSession()) redirect("/");
  return (
    <main className="login-shell" id="main">
      <section className="login-brand">
        <div className="wordmark">
          <span className="wordmark-mark"><ArchicMark /></span>
          <span>Archic <small>Control</small></span>
        </div>
        <div>
          <h1>Direction, not busywork.</h1>
          <p>Control resolves the operational noise and brings forward only the decisions that cannot be delegated safely.</p>
        </div>
      </section>
      <section className="login-panel" aria-label="Sign in"><LoginForm /></section>
    </main>
  );
}

