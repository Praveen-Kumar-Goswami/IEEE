import type { Metadata } from "next";
import { AnalyticsView } from "@/features/admin/AnalyticsView";

export const metadata: Metadata = { title: "Analytics" };

export default function Page() {
  return <AnalyticsView />;
}
