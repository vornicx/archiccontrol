import type { Metadata } from "next";
import { SalesShell } from "@/components/sales/sales-shell";
import "./sales.css";

export const metadata: Metadata = {
  title: "Sales",
  description: "Archic commercial workspace.",
};

export const dynamic = "force-dynamic";

export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return <SalesShell>{children}</SalesShell>;
}
