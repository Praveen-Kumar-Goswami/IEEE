import type { Metadata } from "next";
import { ApprovalsView } from "@/features/admin/ApprovalsView";

export const metadata: Metadata = { title: "Approvals" };

export default function Page() {
  return <ApprovalsView />;
}
