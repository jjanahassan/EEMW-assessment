"use client";

import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { FullPageSpinner } from "./ui";

function Guard({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();
  const pathname = usePathname(); // runtime data, which is why Guard sits inside a Suspense boundary

  useEffect(() => {
    if (status === "anonymous") {
      const next = pathname + window.location.search;
      router.replace(`/login?next=${encodeURIComponent(next)}`);
    }
  }, [status, pathname, router]);

  if (status !== "authenticated") return <FullPageSpinner />;
  return <>{children}</>;
}

// Wrap every page that needs a logged-in user
export function AuthGuard({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Guard>{children}</Guard>
    </Suspense>
  );
}