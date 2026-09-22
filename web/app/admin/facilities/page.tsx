import type { Metadata } from "next";
import { FacilitiesView } from "@/features/admin/FacilitiesView";

export const metadata: Metadata = { title: "Facilities" };

export default function Page() {
  return <FacilitiesView />;
}
