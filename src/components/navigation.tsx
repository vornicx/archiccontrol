"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Resumen" },
  { href: "/sales", label: "Ventas" },
  { href: "/prospects", label: "Prospección" },
  { href: "/projects", label: "Proyectos" },
  { href: "/automation", label: "Agentes" },
  { href: "/deployments", label: "Despliegues" },
  { href: "/quality", label: "Estándar de calidad" },
  { href: "/runs", label: "Ejecuciones" },
  { href: "/decisions", label: "Decisiones" },
  { href: "/settings", label: "Integraciones" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="nav-group" aria-label="Navegación principal">
      <p className="nav-label">Sistema operativo</p>
      {navigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} className="nav-link" data-active={active} href={item.href}>{item.label}</Link>;
      })}
    </nav>
  );
}
