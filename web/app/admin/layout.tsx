import { requireViewer } from "@/lib/auth/guard";
import { Workspace } from "@/features/dashboard/Workspace";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("admin");
  return <Workspace viewer={viewer}>{children}</Workspace>;
}
