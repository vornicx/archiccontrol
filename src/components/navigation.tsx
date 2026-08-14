"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navigation = [
  { href: "/", label: "Overview" },
  { href: "/projects", label: "Projects" },
  { href: "/quality", label: "Quality Standard" },
  { href: "/runs", label: "Runs" },
  { href: "/decisions", label: "Decisions" },
  { href: "/settings", label: "Integrations" },
];

export function Navigation() {
  const pathname = usePathname();
  return (
    <nav className="nav-group" aria-label="Primary">
      <p className="nav-label">Operating system</p>
      {navigation.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return <Link key={item.href} className="nav-link" data-active={active} href={item.href}>{item.label}</Link>;
      })}
    </nav>
  );
}

