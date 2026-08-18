"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import styles from "./sales-shell.module.css";

const items = [
  { href: "/sales", label: "Resumen" },
  { href: "/sales/opportunities", label: "Oportunidades" },
  { href: "/sales/follow-ups", label: "Agenda" },
  { href: "/sales/pipeline", label: "Pipeline" },
  { href: "/sales/performance", label: "Rendimiento" },
] as const;

export function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const settingsActive = pathname.startsWith("/sales/pipeline/settings");

  return (
    <div className={`sales-workspace ${styles.workspace}`}>
      <div className={styles.contextBar}>
        <div className={styles.identity}>
          <span className={styles.mark}>A</span>
          <div>
            <span>Área comercial</span>
            <strong>CRM</strong>
          </div>
        </div>
        <div className={styles.navigation}>
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
          <Link className={styles.settings} data-active={settingsActive} href="/sales/pipeline/settings" aria-label="Configurar CRM">
            Configurar
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
