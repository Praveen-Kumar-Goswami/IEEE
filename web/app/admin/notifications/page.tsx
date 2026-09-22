import type { Metadata } from "next";
import { NotificationsView } from "@/features/notifications/NotificationsView";

export const metadata: Metadata = { title: "Notifications" };

export default function Page() {
  return <NotificationsView />;
}
