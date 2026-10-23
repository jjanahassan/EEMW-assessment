import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB } from "./constants";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

// Only allow in-app paths after login (prevents open redirects)
export function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/search";
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
export const formatDate = (iso: string) => dateFormat.format(new Date(iso));

export function extOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
}

// Fast client-side feedback; the API repeats these checks (and the content check)
export function validateFile(file: File | null): string | null {
  if (!file) return "Choose a file to upload";
  const ext = extOf(file.name);
  if (!(ALLOWED_EXTENSIONS as readonly string[]).includes(ext)) {
    return `Files of type ".${ext || "unknown"}" are not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`;
  }
  if (file.size === 0) return "The file is empty";
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) return `The file is larger than ${MAX_FILE_SIZE_MB} MB`;
  return null;
}

// Saves a Blob through a temporary link (the token can't travel on a plain <a href>)
export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}