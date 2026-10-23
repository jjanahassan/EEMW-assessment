import { useSyncExternalStore } from "react";
import { THEME_KEY } from "./constants";

export type ThemePreference = "light" | "dark" | "system";

const listeners = new Set<() => void>();

function readPreference(): ThemePreference {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system"; // storage unavailable (private mode)
  }
}

function applyTheme(preference: ThemePreference) {
  const dark =
    preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const onExternalChange = () => {
    applyTheme(readPreference());
    onChange();
  };
  listeners.add(onChange);
  media.addEventListener("change", onExternalChange); // the operating system theme changed
  window.addEventListener("storage", onExternalChange); // another tab changed the preference
  return () => {
    listeners.delete(onChange);
    media.removeEventListener("change", onExternalChange);
    window.removeEventListener("storage", onExternalChange);
  };
}

export function setThemePreference(preference: ThemePreference) {
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, preference);
  } catch {
    /* storage unavailable: the theme still applies for this session */
  }
  applyTheme(preference);
  listeners.forEach((listener) => listener());
}

const serverSnapshot = (): ThemePreference => "system";

// The preference lives outside React (localStorage), so it is read with useSyncExternalStore
export function useThemePreference(): [ThemePreference, typeof setThemePreference] {
  return [useSyncExternalStore(subscribe, readPreference, serverSnapshot), setThemePreference];
}