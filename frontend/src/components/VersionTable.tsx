import { PREVIEWABLE_MIME_TYPES } from "@/lib/constants";
import type { VersionSummary } from "@/lib/types";
import { formatBytes, formatDate } from "@/lib/utils";
import { Badge, Button } from "./ui";

interface Props {
  versions: VersionSummary[];
  canModify: boolean;
  busy: string | null; // for example "download-2"
  onDownload: (v: VersionSummary) => void;
  onPreview: (v: VersionSummary) => void;
  onRestore: (v: VersionSummary) => void;
}

export function VersionTable({ versions, canModify, busy, onDownload, onPreview, onRestore }: Props) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Version</th>
            <th className="px-4 py-3">File</th>
            <th className="px-4 py-3">Uploaded</th>
            <th className="px-4 py-3">Note</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {versions.map((v) => (
            <tr key={v.id}>
              <td className="whitespace-nowrap px-4 py-3 font-medium">
                v{v.versionNumber} {v.isCurrent && <Badge tone="green">Current</Badge>}
              </td>
              <td className="px-4 py-3">
                <p className="max-w-xs truncate">{v.fileName}</p>
                <p className="text-xs text-slate-500">{formatBytes(v.sizeBytes)}</p>
              </td>
              <td className="px-4 py-3 text-slate-600">
                <p>{v.uploadedBy.name}</p>
                <p className="text-xs text-slate-500">{formatDate(v.createdAt)}</p>
              </td>
              <td className="max-w-xs px-4 py-3 text-slate-600">{v.changeNote ?? "-"}</td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  {PREVIEWABLE_MIME_TYPES.includes(v.mimeType) && (
                    <Button variant="secondary" loading={busy === `preview-${v.versionNumber}`} onClick={() => onPreview(v)}>
                      Preview
                    </Button>
                  )}
                  <Button variant="secondary" loading={busy === `download-${v.versionNumber}`} onClick={() => onDownload(v)}>
                    Download
                  </Button>
                  {canModify && !v.isCurrent && (
                    <Button variant="secondary" loading={busy === `restore-${v.versionNumber}`} onClick={() => onRestore(v)}>
                      Restore
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}