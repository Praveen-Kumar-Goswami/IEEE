import { requireViewer } from "@/lib/auth/guard";
import { Workspace } from "@/features/dashboard/Workspace";

export default async function NurseLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("nurse");
  return <Workspace viewer={viewer}>{children}</Workspace>;
}
