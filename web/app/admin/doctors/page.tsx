import type { Metadata } from "next";
import { StaffView } from "@/features/admin/StaffView";

export const metadata: Metadata = { title: "Doctors" };

export default function Page() {
  return <StaffView role="doctor" />;
}
