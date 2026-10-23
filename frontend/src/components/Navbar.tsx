"use client";

import { FileText, LogOut, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui";

export function Navbar() {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();

  const navLink = (href: string, label: string, icon: ReactNode) => (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition",
        pathname.startsWith(href) ? "bg-accent-soft text-accent-soft-fg" : "text-muted hover:bg-sunken hover:text-fg",
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/search" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent">
              <FileText className="h-4 w-4" />
            </span>
            <span className="font-serif text-lg font-semibold tracking-tight text-fg">Document Repository</span>
          </Link>
          {status === "authenticated" && (
            <nav className="flex gap-1">
              {navLink("/search", "Search", <Search className="h-4 w-4" />)}
              {navLink("/upload", "Upload", <Upload className="h-4 w-4" />)}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          {status === "authenticated" && user && (
            <>
              <div className="hidden text-right text-sm sm:block">
                <p className="font-medium text-fg">{user.name}</p>
                <p className="text-xs text-muted">{user.departmentName}</p>
              </div>
              <Badge tone="green">{user.role}</Badge>
              <button
                onClick={logout}
                className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-muted transition hover:bg-sunken hover:text-fg"
              >
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </>
          )}
          {status === "anonymous" && (
            <div className="flex gap-2 text-sm">
              <Link href="/login" className="rounded-md px-3 py-2 text-muted hover:bg-sunken hover:text-fg">
                Log in
              </Link>
              <Link href="/register" className="rounded-md bg-accent px-3 py-2 text-on-accent hover:bg-accent-hover">
                Register
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}