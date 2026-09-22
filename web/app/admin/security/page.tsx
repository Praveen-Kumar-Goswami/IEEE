import type { Metadata } from "next";
import { SecurityView } from "@/features/admin/SecurityView";

export const metadata: Metadata = { title: "Security" };

export default function Page() {
  return <SecurityView />;
}
