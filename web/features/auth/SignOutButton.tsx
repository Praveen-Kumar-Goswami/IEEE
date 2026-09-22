"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { env } from "@/lib/env";
import { signOut } from "@/lib/auth/actions";
import { getBrowserSupabase } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

/** Clears the Supabase browser session (when configured) and the server cookies, then returns to /login. */
export function useSignOut() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = () =>
    start(async () => {
      if (!env.demoMode) await getBrowserSupabase().auth.signOut();
      await signOut();
      router.replace("/login");
      router.refresh();
    });
  return { pending, signOut: run };
}

export function SignOutButton() {
  const { pending, signOut: run } = useSignOut();
  return (
    <Button variant="outline" size="lg" loading={pending} iconLeft={<LogOut className="size-4" />} onClick={run}>
      Sign out
    </Button>
  );
}
