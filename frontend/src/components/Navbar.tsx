"use client";

import { FileText, LogOut, Search, Upload } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Badge } from "./ui";

export function Navbar() {
  const { user, status, logout } = useAuth();
  const pathname = usePathname();

  const navLink = (href: string, label: string, icon: React.ReactNode) => (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        pathname.startsWith(href) ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      {icon}
      {label}
    </Link>
  );

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/search" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <FileText className="h-5 w-5 text-indigo-600" />
            Document Repository
          </Link>
          {status === "authenticated" && (
            <nav className="flex gap-1">
              {navLink("/search", "Search", <Search className="h-4 w-4" />)}
              {navLink("/upload", "Upload", <Upload className="h-4 w-4" />)}
            </nav>
          )}
        </div>

        {status === "authenticated" && user && (
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-sm sm:block">
              <p className="font-medium text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-500">{user.departmentName}</p>
            </div>
            <Badge tone="indigo">{user.role}</Badge>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4" />
              Log out
            </button>
          </div>
        )}
        {status === "anonymous" && (
          <div className="flex gap-2 text-sm">
            <Link href="/login" className="rounded-md px-3 py-2 text-slate-600 hover:bg-slate-100">
              Log in
            </Link>
            <Link href="/register" className="rounded-md bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-700">
              Register
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}