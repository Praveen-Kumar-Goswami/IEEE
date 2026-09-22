import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ShieldAlert, Smartphone } from "lucide-react";
import { getAuthState } from "@/lib/auth/session";
import { ROLE_HOME } from "@/lib/auth/roles";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { buttonStyles } from "@/components/ui/button-styles";
import { SignOutButton } from "@/features/auth/SignOutButton";

export const metadata: Metadata = { title: "No access" };

export default async function UnauthorizedPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const auth = await getAuthState();
  const patient = params.reason === "patient" || auth.status === "patient";
  const staff = auth.status === "staff" ? auth.viewer : null;
  const from = typeof params.from === "string" ? params.from : null;

  return (
    <main id="main" className="relative grid min-h-dvh place-items-center overflow-hidden bg-graphite-950 px-(--margin)">
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 size-[46rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgb(242_122_98/0.07),transparent)]" />
      <div className="motion-safe:animate-page-in relative max-w-lg text-center">
        <div className="mx-auto mb-8 flex size-14 items-center justify-center rounded-full border border-(--line-strong) text-attention">
          {patient ? <Smartphone className="size-6" /> : <ShieldAlert className="size-6" />}
        </div>
        <p className="text-label text-graphite-400">403 · Access restricted</p>
        <h1 className="mt-4 text-h1 font-light text-bone">
          {patient ? (
            <>
              Patients use the <span className="text-editorial text-ivory">Android app.</span>
            </>
          ) : (
            <>
              This workspace is <span className="text-editorial text-ivory">not yours.</span>
            </>
          )}
        </h1>
        <p className="mx-auto mt-5 max-w-md text-body text-graphite-300">
          {patient
            ? "The web platform is for the care team. Your readings and indicators are in the Tend app on your phone."
            : staff
              ? `You are signed in as ${staff.fullName} (${ROLE_LABEL[staff.role]}). ${from ? `${from} belongs to another role.` : "That page belongs to another role."} Every access attempt is recorded in the audit log.`
              : "Sign in with a staff account to continue."}
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {staff ? (
            <Link href={ROLE_HOME[staff.role]} className={buttonStyles({ variant: "primary", size: "lg" })}>
              Go to my workspace <ArrowRight className="size-4" />
            </Link>
          ) : (
            <Link href="/login" className={buttonStyles({ variant: "primary", size: "lg" })}>
              Sign in <ArrowRight className="size-4" />
            </Link>
          )}
          {auth.status !== "signed_out" && <SignOutButton />}
        </div>
      </div>
    </main>
  );
}
