import type { Metadata } from "next";
import { WeekAgenda } from "@/features/doctor/WeekAgenda";

export const metadata: Metadata = { title: "Appointments" };

export default function Page() {
  return <WeekAgenda />;
}
