import type { Metadata } from "next";
import { DoctorOverview } from "@/features/doctor/DoctorOverview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <DoctorOverview />;
}
