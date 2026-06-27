"use client";

import { Shield, UserCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import {
  Suspense,
  useState,
  type FormEvent,
  type ReactElement,
} from "react";

const DEMO_ACCOUNTS = [
  {
    label: "Student",
    email: "student1@state.edu",
    password: "password123",
    hint: "Live lab + mentor",
  },
  {
    label: "Enterprise admin",
    email: "enterprise.admin@acme.com",
    password: "password123",
    hint: "Analytics + hiring",
  },
  {
    label: "Platform admin",
    email: "admin@sentinelforge.com",
    password: "password123",
    hint: "Org + scenario admin",
  },
] as const;

function LoginForm(): ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      setFormError("Invalid email or password.");
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="w-full max-w-md rounded-xl border border-border/60 bg-card/80 p-8 shadow-xl backdrop-blur">
      <div className="mb-8 flex flex-col items-center gap-2 text-center">
        <div className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
          <Shield className="h-8 w-8 text-accent" aria-hidden />
          <span>SentinelForge</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Sign in to continue your cybersecurity training.
        </p>
      </div>

      {(error || formError) && (
        <div
          className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          role="alert"
        >
          {formError ??
            (error === "CredentialsSignin"
              ? "Invalid email or password."
              : error ?? "An error occurred.")}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-emerald-300">
          <UserCircle className="h-3.5 w-3.5" aria-hidden />
          Demo accounts (after <code className="text-emerald-200">npm run db:seed</code>)
        </div>
        <ul className="space-y-2">
          {DEMO_ACCOUNTS.map((acct) => (
            <li key={acct.email} className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <p className="font-medium text-slate-200">{acct.label}</p>
                <p className="truncate text-slate-400">{acct.email}</p>
                <p className="text-[10px] text-slate-500">{acct.hint}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded border border-emerald-600/50 px-2 py-1 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/40"
                onClick={() => {
                  setEmail(acct.email);
                  setPassword(acct.password);
                }}
              >
                Use
              </button>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted"
          onClick={() => void signIn("google", { callbackUrl: "/dashboard" })}
        >
          <span className="text-[#4285F4]">G</span>
          Continue with Google
        </button>
        <button
          type="button"
          className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-95"
          style={{ backgroundColor: "#4A154B" }}
          onClick={() => void signIn("slack", { callbackUrl: "/dashboard" })}
        >
          Continue with Slack
        </button>
      </div>

      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        or email
        <span className="h-px flex-1 bg-border" />
      </div>

      <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(ev) => setPassword(ev.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent py-2.5 text-sm font-medium text-accent-foreground shadow hover:opacity-90 disabled:opacity-60"
        >
          {submitting ? "Signing in…" : "Sign In"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-accent hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage(): ReactElement {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 px-4 py-12">
      <Suspense
        fallback={
          <div className="h-40 w-full max-w-md animate-pulse rounded-xl bg-card/40" />
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
