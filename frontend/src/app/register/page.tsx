"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { departmentsApi } from "@/lib/endpoints";
import type { Department } from "@/lib/types";

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    departmentsApi.list().then((r) => setDepartments(r.departments)).catch((err) => setError(getErrorMessage(err)));
  }, []);

  useEffect(() => {
    if (status === "authenticated") router.replace("/search");
  }, [status, router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), password, departmentId: Number(departmentId) });
      router.replace("/search");
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) {
        setFieldErrors(Object.fromEntries(err.details.map((d) => [d.path.split(".")[0], d.message])));
      } else {
        setError(getErrorMessage(err));
      }
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md rounded-lg border border-line bg-surface p-6 shadow-sm">
      <h1 className="text-xl font-semibold">Create an account</h1>
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" htmlFor="name" error={fieldErrors.name}>
          <input id="name" required minLength={2} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Email" htmlFor="email" error={fieldErrors.email}>
          <input id="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Password" htmlFor="password" error={fieldErrors.password} hint="8 to 72 characters, with at least one letter and one digit">
          <input id="password" type="password" required minLength={8} maxLength={72} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
        </Field>
        <Field label="Department" htmlFor="department" error={fieldErrors.departmentId}>
          <select id="department" required value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={inputClass}>
            <option value="">Select a department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" loading={submitting} className="w-full">
          Register
        </Button>
      </form>
    </div>
  );
}