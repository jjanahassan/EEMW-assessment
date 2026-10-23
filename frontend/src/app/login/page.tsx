"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { safeNext } from "@/lib/utils";

// Seeded accounts, shown to make the demo easy. Remove for a real deployment.
const DEMO_ACCOUNTS = [
  { label: "Admin", email: "admin@company.com" },
  { label: "Finance employee", email: "finance.employee@company.com" },
  { label: "Finance manager", email: "finance.manager@company.com" },
  { label: "Legal manager", email: "legal.manager@company.com" },
  { label: "HR employee", email: "hr.employee@company.com" },
  { label: "Engineer", email: "engineer@company.com" },
];

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get("next"));

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      router.replace(next);
    } catch (err) {
      setError(getErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-lg border border-line bg-surface p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Log in</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          {error && <Alert>{error}</Alert>}
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Password" htmlFor="password">
            <input id="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </Field>
          <Button type="submit" loading={submitting} className="w-full">
            Log in
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          No account yet?{" "}
          <a href="/register" className="font-medium text-accent hover:underline">
            Register
          </a>
        </p>
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-line-strong p-4 text-sm text-muted">
        <p className="font-medium text-fg">Demo accounts (password: Password123!)</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {DEMO_ACCOUNTS.map((a) => (
            <button
              key={a.email}
              type="button"
              onClick={() => {
                setEmail(a.email);
                setPassword("Password123!");
              }}
              className="rounded-full border border-line-strong bg-surface px-3 py-1 text-xs hover:bg-sunken"
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}