import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckInFlow } from "@/features/checkin/CheckInFlow";

export const metadata: Metadata = { title: "Measurements" };

export default function Page() {
  return (
    <Suspense>
      <CheckInFlow />
    </Suspense>
  );
}
