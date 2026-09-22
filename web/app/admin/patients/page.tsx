import type { Metadata } from "next";
import { PatientsView } from "@/features/patients/PatientsView";

export const metadata: Metadata = { title: "Patients" };

export default function Page() {
  return <PatientsView />;
}
