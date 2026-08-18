"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./navigation.module.css";

const sections = [
  {
    label: "Mando",
    items: [
      { href: "/", label: "Hoy" },
      { href: "/decisions", label: "Decisiones" },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/sales", label: "CRM" },
      { href: "/prospects", label: "Prospectos" },
    ],
  },
  {
    label: "Producción",
    items: [
      { href: "/projects", label: "Proyectos" },
      { href: "/quality", label: "Calidad" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/automation", label: "Automatización" },
      { href: "/deployments", label: "Despliegues" },
      { href: "/runs", label: "Ejecuciones" },
      { href: "/settings", label: "Integraciones" },
    ],
  },
] as const;

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className={styles.navigation} aria-label="Navegación principal">
      {sections.map((section) => (
        <div className={styles.section} key={section.label}>
          <p className={styles.label}>{section.label}</p>
          {section.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                className={styles.link}
                data-active={active}
                aria-current={active ? "page" : undefined}
                href={item.href}
              >
                <span>{item.label}</span>
                <span className={styles.marker} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
