import type { Metadata } from "next";
import { DevicesView } from "@/features/admin/DevicesView";

export const metadata: Metadata = { title: "Devices" };

export default function Page() {
  return <DevicesView />;
}
