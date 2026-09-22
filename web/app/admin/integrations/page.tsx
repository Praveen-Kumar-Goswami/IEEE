import type { Metadata } from "next";
import { IntegrationsView } from "@/features/admin/IntegrationsView";

export const metadata: Metadata = { title: "Integrations" };

export default function Page() {
  return <IntegrationsView />;
}
