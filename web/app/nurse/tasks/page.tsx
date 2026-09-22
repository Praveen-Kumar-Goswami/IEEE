import type { Metadata } from "next";
import { TaskBoard } from "@/features/tasks/TaskBoard";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return <TaskBoard />;
}
