import type { Metadata } from "next";
import { SalesShell } from "@/components/sales/sales-shell";
import "./sales.css";
import "./sales-control.css";

export const metadata: Metadata = {
  title: "Ventas",
  description: "Espacio comercial interno de Archic.",
};

export const dynamic = "force-dynamic";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <SalesShell>{children}</SalesShell>;
}
