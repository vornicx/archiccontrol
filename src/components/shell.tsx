import Link from "next/link";
import { ArchicMark } from "@/components/icons";
import { Navigation } from "@/components/navigation";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="wordmark" aria-label="Archic Control — overview">
          <span className="wordmark-mark"><ArchicMark /></span>
          <span>Archic <small>Control</small></span>
        </Link>
        <Navigation />
        <div className="sidebar-foot">
          <div className="system-state">
            <strong><span className="live-dot" />Control plane online</strong>
            <span>Quality Standard v1.0</span>
          </div>
        </div>
      </aside>
      <main className="main" id="main">{children}</main>
    </div>
  );
}
