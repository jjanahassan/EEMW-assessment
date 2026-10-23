import { Globe, Lock } from "lucide-react";
import Link from "next/link";
import { extOf, formatBytes, formatDate } from "@/lib/utils";
import type { SearchItem } from "@/lib/types";
import { Highlight } from "./Highlight";
import { Badge } from "./ui";

export function DocumentCard({ item, onTagClick }: { item: SearchItem; onTagClick?: (tag: string) => void }) {
  const version = item.currentVersion;
  const snippet = item.highlight?.snippet;

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <Link href={`/documents/${item.id}`} className="text-base font-semibold text-indigo-700 hover:underline">
          {item.highlight ? <Highlight text={item.highlight.title} /> : item.title}
        </Link>
        <Badge tone={item.visibility === "restricted" ? "amber" : "green"}>
          {item.visibility === "restricted" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
          {item.visibility}
        </Badge>
      </div>

      {(snippet || item.description) && (
        <p className="mt-1 line-clamp-2 text-sm text-slate-600">{snippet ? <Highlight text={snippet} /> : item.description}</p>
      )}

      {item.tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <button key={tag} type="button" onClick={() => onTagClick?.(tag)} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700 hover:bg-indigo-100 hover:text-indigo-800">
              {tag}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        <span>
          {item.uploader.name} · {formatDate(item.createdAt)}
        </span>
        {version && (
          <span>
            v{version.versionNumber} · {extOf(version.fileName).toUpperCase()} · {formatBytes(version.sizeBytes)}
          </span>
        )}
        <span>{item.downloadCount} downloads</span>
      </p>
    </article>
  );
}