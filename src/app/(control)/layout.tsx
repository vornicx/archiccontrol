import { Shell } from "@/components/shell";
import { requireSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ControlLayout({ children }: { children: React.ReactNode }) {
  await requireSession();
  return <Shell>{children}</Shell>;
}

