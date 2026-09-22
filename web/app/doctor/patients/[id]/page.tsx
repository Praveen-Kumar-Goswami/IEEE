import type { Metadata } from "next";
import { Suspense } from "react";
import { PatientRecord } from "@/features/patients/record/PatientRecord";

export const metadata: Metadata = { title: "Patient record" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <PatientRecord patientId={id} />
    </Suspense>
  );
}
