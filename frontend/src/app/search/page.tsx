"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { DebouncedInput } from "@/components/DebouncedInput";
import { DocumentCard } from "@/components/DocumentCard";
import { Pagination } from "@/components/Pagination";
import { TagInput } from "@/components/TagInput";
import { Alert, Button, inputClass } from "@/components/ui";
import { getErrorMessage, isAbort } from "@/lib/api";
import { ALLOWED_EXTENSIONS } from "@/lib/constants";
import { documentsApi } from "@/lib/endpoints";
import type { SearchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Result {
  query: string | null; // the query string these results belong to
  data: SearchResult | null;
  error: string | null;
}

const SORTS = [
  ["relevance", "Best match"],
  ["newest", "Newest"],
  ["oldest", "Oldest"],
  ["title", "Title A to Z"],
  ["downloads", "Most downloaded"],
] as const;

const FILE_TYPES = ALLOWED_EXTENSIONS.filter((e) => e !== "jpeg"); // jpg and jpeg are the same filter

function SearchView() {
  const router = useRouter();
  const sp = useSearchParams();

  // The URL is the single source of truth for the search state
  const q = sp.get("q") ?? "";
  const uploader = sp.get("uploader") ?? "";
  const fileType = sp.get("fileType") ?? "";
  const sort = sp.get("sort") ?? "";
  const tagMode = sp.get("tagMode") === "any" ? "any" : "all";
  const tags = useMemo(() => (sp.get("tags") ?? "").split(",").filter(Boolean), [sp]);
  const hasFilters = Boolean(q || uploader || fileType || sort || tags.length);

  function update(patch: Record<string, string | undefined>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (!("page" in patch)) next.delete("page"); // any filter change returns to page 1
    const qs = next.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }

    const queryString = sp.toString();
    const [result, setResult] = useState<Result>({ query: null, data: null, error: null });
    // "loading" is derived: the results on screen belong to an older query
    const loading = result.query !== queryString;

    useEffect(() => {
        const controller = new AbortController(); // cancels the previous request when the query changes
        documentsApi
        .search(queryString, controller.signal)
        .then((data) => setResult({ query: queryString, data, error: null }))
        .catch((err) => {
            if (isAbort(err)) return;
            setResult((prev) => ({ query: queryString, data: prev.data, error: getErrorMessage(err) }));
        });
        return () => controller.abort();
    }, [queryString]);

    const { data, error } = result;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Search documents</h1>

      <div className="mt-4 rounded-lg border border-line bg-surface p-4 shadow-sm">
        <DebouncedInput
          value={q}
          onCommit={(v) => update({ q: v.trim() || undefined })}
          placeholder="Search by title, description or tag"
          aria-label="Search"
          className={inputClass}
        />
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="md:col-span-2">
            <label htmlFor="filter-tags" className="mb-1 block text-sm font-medium text-fg">
              Tags
            </label>
            <TagInput id="filter-tags" value={tags} onChange={(next) => update({ tags: next.join(",") || undefined })} placeholder="Filter by tag" />
            {tags.length > 1 && (
              <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                <input type="checkbox" checked={tagMode === "any"} onChange={(e) => update({ tagMode: e.target.checked ? "any" : undefined, tags: tags.join(",") })} />
                Match any tag (instead of all)
              </label>
            )}
          </div>
          <div>
            <label htmlFor="filter-uploader" className="mb-1 block text-sm font-medium text-fg">
              Uploaded by
            </label>
            <DebouncedInput id="filter-uploader" value={uploader} onCommit={(v) => update({ uploader: v.trim() || undefined })} placeholder="Name or email" className={inputClass} />
          </div>
          <div>
            <label htmlFor="filter-type" className="mb-1 block text-sm font-medium text-fg">
              File type
            </label>
            <select id="filter-type" value={fileType} onChange={(e) => update({ fileType: e.target.value || undefined })} className={inputClass}>
              <option value="">All types</option>
              {FILE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite">
          {data ? `${data.total} document${data.total === 1 ? "" : "s"}` : "\u00a0"}
        </p>
        <div className="flex items-center gap-3">
          {hasFilters && (
            <Button variant="secondary" onClick={() => router.replace("/search", { scroll: false })}>
              Clear filters
            </Button>
          )}
          <select
            aria-label="Sort"
            value={sort || (q ? "relevance" : "newest")}
            onChange={(e) => update({ sort: e.target.value })}
            className={cn(inputClass, "w-auto")}
          >
            {SORTS.filter(([value]) => value !== "relevance" || q).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {!data && loading && (
        <ul className="mt-4 space-y-3">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-28 animate-pulse rounded-lg bg-line" />
          ))}
        </ul>
      )}

      {data && data.items.length === 0 && !loading && (
        <div className="mt-8 rounded-lg border border-dashed border-line-strong bg-surface p-10 text-center">
          <p className="font-medium text-fg">No documents found</p>
          <p className="mt-1 text-sm text-muted">Try different words, fewer filters, or check the spelling.</p>
        </div>
      )}

      {data && data.items.length > 0 && (
        <>
          <ul className={cn("mt-4 space-y-3 transition-opacity", loading && "opacity-60")}>
            {data.items.map((item) => (
              <li key={item.id}>
                <DocumentCard item={item} onTagClick={(tag) => !tags.includes(tag.toLowerCase()) && update({ tags: [...tags, tag.toLowerCase()].join(",") })} />
              </li>
            ))}
          </ul>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={(p) => update({ page: p > 1 ? String(p) : undefined })} />
        </>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <SearchView />
      </Suspense>
    </AuthGuard>
  );
}