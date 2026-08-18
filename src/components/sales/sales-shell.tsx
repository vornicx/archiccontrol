"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./sales-shell.module.css";

const items = [
  { href: "/sales", label: "Resumen" },
  { href: "/sales/opportunities", label: "Oportunidades" },
  { href: "/sales/pipeline", label: "Pipeline" },
  { href: "/sales/follow-ups", label: "Agenda" },
  { href: "/sales/performance", label: "Rendimiento" },
  { href: "/sales/pipeline/settings", label: "Configurar" },
] as const;

export function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className={`sales-workspace ${styles.workspace}`}>
      <div className={styles.contextBar}>
        <div className={styles.identity}>
          <span>Comercial</span>
          <strong>CRM</strong>
        </div>
        <nav className={styles.subnav} aria-label="Área comercial">
          {items.map((item) => {
            const active = item.href === "/sales"
              ? pathname === "/sales"
              : item.href === "/sales/pipeline"
                ? pathname === "/sales/pipeline"
                : pathname.startsWith(item.href);
            return (
              <Link
                href={item.href}
                key={item.href}
                data-active={active}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {children}
    </div>
  );
}
