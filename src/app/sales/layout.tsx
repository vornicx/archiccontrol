import type { Metadata } from "next";
import { SalesShell } from "@/components/sales/sales-shell";
import { Shell } from "@/components/shell";
import "./sales.css";

export const metadata: Metadata = {
  title: "CRM",
  description: "CRM comercial interno de Archic.",
};

export const dynamic = "force-dynamic";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <Shell>
      <SalesShell>{children}</SalesShell>
    </Shell>
  );
}
