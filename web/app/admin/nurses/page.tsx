import type { Metadata } from "next";
import { StaffView } from "@/features/admin/StaffView";

export const metadata: Metadata = { title: "Nurses" };

export default function Page() {
  return <StaffView role="nurse" />;
}
