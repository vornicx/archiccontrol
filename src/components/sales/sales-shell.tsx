"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const items = [
  { href: "/sales", label: "Today", short: "Hoy" },
  { href: "/sales/pipeline", label: "Pipeline", short: "Pipeline" },
  { href: "/sales/follow-ups", label: "Follow-ups", short: "Seguimientos" },
  { href: "/sales/performance", label: "Performance", short: "Rendimiento" },
];

export function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="sales-shell">
      <aside className="sales-rail">
        <div>
          <Link href="/sales" className="sales-brand"><span>ARCHIC</span><small>Sales</small></Link>
          <nav className="sales-nav" aria-label="Sales">
            {items.map((item) => {
              const active = item.href === "/sales" ? pathname === "/sales" : pathname.startsWith(item.href);
              return <Link href={item.href} key={item.href} data-active={active}>{item.label}</Link>;
            })}
          </nav>
        </div>
        <div className="sales-profile">
          <span className="sales-avatar">A</span>
          <div><strong>Antero</strong><small>Sales · Archic</small></div>
          <Link href="/" aria-label="Volver a Archic Control">Control ↗</Link>
        </div>
      </aside>
      <main className="sales-main" id="main">{children}</main>
      <nav className="sales-mobile-nav" aria-label="Sales mobile">
        {items.map((item) => {
          const active = item.href === "/sales" ? pathname === "/sales" : pathname.startsWith(item.href);
          return <Link href={item.href} key={item.href} data-active={active}>{item.short}</Link>;
        })}
      </nav>
    </div>
  );
}
