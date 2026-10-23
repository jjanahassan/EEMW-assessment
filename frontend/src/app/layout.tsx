import type { Metadata } from "next";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { AuthProvider } from "@/lib/auth";
import { themeInitScript } from "@/lib/theme-script";
import { Suspense, type ReactNode } from "react";

export const metadata: Metadata = {
  title: "Document Repository",
  description: "Upload, search and manage corporate documents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning: the theme script adds the "dark" class before React loads
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-screen bg-page font-sans text-fg antialiased">
        <AuthProvider>
          <Suspense fallback={<div className="h-14 border-b border-line bg-surface" aria-hidden="true" />}>
            <Navbar />
          </Suspense>
          <main className="mx-auto w-full max-w-6xl px-4 py-8">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}