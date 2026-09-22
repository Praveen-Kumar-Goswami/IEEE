import type { Metadata } from "next";
import { NurseOverview } from "@/features/nurse/NurseOverview";

export const metadata: Metadata = { title: "Overview" };

export default function Page() {
  return <NurseOverview />;
}
