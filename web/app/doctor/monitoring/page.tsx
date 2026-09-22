import type { Metadata } from "next";
import { MonitorWall } from "@/features/monitoring/MonitorWall";

export const metadata: Metadata = { title: "Live monitoring" };

export default function Page() {
  return <MonitorWall />;
}
