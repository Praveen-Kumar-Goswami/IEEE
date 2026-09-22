import type { Metadata } from "next";
import { LoginView } from "@/features/auth/LoginView";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : null;
  return <LoginView next={next} />;
}
