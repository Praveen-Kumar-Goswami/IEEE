import type { Metadata } from "next";
import { AdminOverview } from "@/features/admin/AdminOverview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <AdminOverview />;
}
