import type { Metadata } from "next";
import { AlertQueue } from "@/features/alerts/AlertQueue";

export const metadata: Metadata = { title: "Alerts" };

export default function Page() {
  return <AlertQueue />;
}
