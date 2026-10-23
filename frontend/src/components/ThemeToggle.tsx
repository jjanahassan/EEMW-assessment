"use client";

import { Moon, Sun } from "lucide-react";
import { setThemePreference, useResolvedTheme } from "@/lib/theme";

export function ThemeToggle() {
  const theme = useResolvedTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => setThemePreference(next)}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="rounded-lg border border-line bg-sunken p-2 text-muted transition hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      {/* Both icons are rendered and CSS picks one from the "dark" class on <html>,
          so the right icon shows from the first paint, with no flicker */}
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}