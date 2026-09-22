"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { signInStaff } from "@/lib/auth/actions";
import { STAFF_ACCOUNTS, type StaffAccount } from "@/lib/auth/staff-accounts";
import { ROLE_LABEL } from "@/lib/domain/labels";
import { BEZIER, DURATION } from "@/lib/motion/tokens";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { LogoMark } from "@/components/brand/Logo";
import { SignalPanel } from "./SignalPanel";

export function LoginView({ next }: { next: string | null }) {
  const reduced = useReducedMotion();
  const enter = (delay: number) =>
    reduced ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: DURATION.standardSlow, ease: BEZIER.outExpo, delay } };

  return (
    <div className="relative grid min-h-dvh bg-graphite-950 lg:grid-cols-12">
      <SignalPanel className="hidden lg:col-span-7 lg:flex" />
      <main id="main" className="relative flex flex-col px-(--margin) py-8 lg:col-span-5 lg:px-14 xl:px-20">
        <div className="flex items-center justify-between">
          <Link href="/" className="group flex items-center gap-2 text-small text-graphite-300 transition-colors hover:text-bone">
            <ArrowLeft className="size-4 transition-transform duration-(--dur-micro) group-hover:-translate-x-0.5" />
            Back to site
          </Link>
          <span className="flex items-center gap-2 text-small font-medium text-bone lg:hidden">
            <LogoMark className="size-6" /> {BRAND.name}
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center py-12">
          <motion.p {...enter(0.05)} className="text-label text-graphite-400">
            Staff sign in
          </motion.p>
          <motion.h1 {...enter(0.1)} className="mt-4 text-h1 font-light text-bone">
            Welcome <span className="text-editorial text-ivory">back.</span>
          </motion.h1>
          <motion.p {...enter(0.16)} className="mt-4 text-body text-graphite-300">
            Choose a staff entry. Each one signs in through the Lambda API and opens that workspace.
          </motion.p>
          <motion.div {...enter(0.22)} className="mt-10">
            <PasswordForm next={next} />
          </motion.div>
        </div>

        <p className="mx-auto w-full max-w-[26rem] text-[12px] leading-relaxed text-graphite-400">{BRAND.disclaimer}</p>
      </main>
    </div>
  );
}

function PasswordForm({ next }: { next: string | null }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async (accountEmail: string, accountPassword: string) => {
    setError(null);
    setPending(true);
    try {
      const result = await signInStaff(accountEmail.trim(), accountPassword, next);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(result.redirectTo, { transitionTypes: ["nav-enter"] });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check the connection and try again.");
    } finally {
      setPending(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void signIn(email, password);
  };

  const useAccount = (account: StaffAccount) => {
    setEmail(account.email);
    setPassword(account.password);
    void signIn(account.email, account.password);
  };

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <div className="space-y-2">
        {STAFF_ACCOUNTS.map((account) => (
          <button
            key={account.role}
            type="button"
            disabled={pending}
            onClick={() => useAccount(account)}
            className="flex w-full items-center justify-between gap-3 rounded-2xl border border-(--line) bg-white/[0.02] px-4 py-3 text-left transition-colors hover:border-(--line-strong) hover:bg-white/[0.04] disabled:opacity-50"
          >
            <span>
              <span className="block text-small font-medium text-bone">{ROLE_LABEL[account.role]}</span>
              <span className="mt-0.5 block text-[12px] text-graphite-400">{account.fullName}</span>
            </span>
            <span className="min-w-0 text-right">
              <span className="block truncate text-[12px] text-graphite-200">{account.email}</span>
              <span className="mt-0.5 block font-mono text-[12px] text-graphite-400">{account.password}</span>
            </span>
          </button>
        ))}
      </div>
      <Field label="Work email">
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            leading={<Mail />}
            placeholder="name@hospital.org"
          />
        )}
      </Field>
      <Field label="Password" error={error}>
        {({ id, describedBy, invalid }) => (
          <Input
            id={id}
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-describedby={describedBy}
            aria-invalid={invalid || undefined}
            leading={<Lock />}
            trailing={
              <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} className="rounded-full p-2 text-graphite-400 transition-colors hover:text-bone">
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
        )}
      </Field>
      <Button type="submit" variant="primary" size="lg" loading={pending} disabled={!email || !password} className="w-full" iconRight={<ArrowRight className="size-4" />}>
        Sign in
      </Button>
      <p className="text-center text-[12px] text-graphite-400">Checked by the AWS Lambda API. A doctor opens the doctor workspace, a nurse the nurse workspace, and an admin the admin workspace.</p>
    </form>
  );
}
