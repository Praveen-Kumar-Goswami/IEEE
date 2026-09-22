import type { Metadata } from "next";
import { AdminSettings } from "@/features/admin/AdminSettings";

export const metadata: Metadata = { title: "Settings" };

export default function Page() {
  return <AdminSettings />;
}
