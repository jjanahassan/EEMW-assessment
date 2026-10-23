"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

export function PreviewModal({ url, mime, name, onClose }: { url: string; mime: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-label={`Preview of ${name}`} className="fixed inset-0 z-50 flex bg-black/60 p-4" onClick={onClose}>
      <div className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-surface" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <p className="truncate text-sm font-medium">{name}</p>
          <button onClick={onClose} aria-label="Close preview" className="rounded p-1 hover:bg-sunken">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 bg-sunken">
          {mime.startsWith("image/") ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={name} className="mx-auto h-full max-w-full object-contain p-4" />
          ) : (
            <iframe src={url} title={name} className="h-full w-full" />
          )}
        </div>
      </div>
    </div>
  );
}