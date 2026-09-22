import { requireViewer } from "@/lib/auth/guard";
import { Workspace } from "@/features/dashboard/Workspace";

export default async function DoctorLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer("doctor");
  return <Workspace viewer={viewer}>{children}</Workspace>;
}
