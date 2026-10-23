import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn("inline-block h-5 w-5 animate-spin rounded-full border-2 border-line-strong border-t-accent", className)}
    />
  );
}

export function FullPageSpinner() {
  return (
    <div className="flex justify-center py-24">
      <Spinner className="h-8 w-8" />
    </div>
  );
}

type Variant = "primary" | "secondary" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-fg hover:bg-sunken",
  danger: "bg-danger-solid text-on-danger hover:opacity-90",
};

export function Button({
  variant = "primary",
  loading,
  className,
  children,
  disabled,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        className,
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4 border-current border-t-transparent" />}
      {children}
    </button>
  );
}

export const inputClass =
  "block w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-sm text-fg shadow-sm placeholder:text-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-fg">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p className="mt-1 text-xs text-danger-fg">{error}</p>}
    </div>
  );
}

export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-danger-line bg-danger-soft text-danger-fg",
    success: "border-success-line bg-success-soft text-success-fg",
    info: "border-line bg-accent-soft text-accent-soft-fg",
  };
  return (
    <div role={kind === "error" ? "alert" : "status"} className={cn("rounded-md border px-3 py-2 text-sm", styles[kind])}>
      {children}
    </div>
  );
}

type Tone = "slate" | "green" | "amber" | "indigo";
const tones: Record<Tone, string> = {
  slate: "bg-sunken text-muted",
  green: "bg-accent-soft text-accent-soft-fg", // public
  amber: "bg-warm-soft text-warm-fg", // restricted
  indigo: "bg-highlight text-fg", // tags
};

export function Badge({ tone = "slate", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}