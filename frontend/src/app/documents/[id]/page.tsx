"use client";

import { Download, Eye, Globe, Lock } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { NewVersionForm } from "@/components/NewVersionForm";
import { PreviewModal } from "@/components/PreviewModal";
import { VersionTable } from "@/components/VersionTable";
import { Alert, Badge, Button, FullPageSpinner } from "@/components/ui";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PREVIEWABLE_MIME_TYPES } from "@/lib/constants";
import { documentsApi } from "@/lib/endpoints";
import { canModifyDocument } from "@/lib/permissions";
import type { DocumentDetail, VersionSummary } from "@/lib/types";
import { extOf, formatBytes, formatDate, saveBlob } from "@/lib/utils";

interface Preview {
  url: string;
  mime: string;
  name: string;
}

function DocumentView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [doc, setDoc] = useState<DocumentDetail | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<{ status: number; message: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

    const [reloadKey, setReloadKey] = useState(0);
    const reload = useCallback(() => setReloadKey((k) => k + 1), []); // call after any change to refetch

    useEffect(() => {
        let cancelled = false;
        Promise.all([documentsApi.get(id), documentsApi.versions(id)])
        .then(([d, v]) => {
            if (cancelled) return;
            setDoc(d.document);
            setVersions(v.versions);
            setLoadError(null);
            setLoading(false);
        })
        .catch((err) => {
            if (cancelled) return;
            setLoadError({ status: err instanceof ApiError ? err.status : 0, message: getErrorMessage(err) });
            setLoading(false);
        });
        return () => {
        cancelled = true;
        };
    }, [id, reloadKey]);

  // Revoke the blob URL whenever the preview closes
  function closePreview() {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  }

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    setActionError(null);
    try {
      await action();
    } catch (err) {
      setActionError(getErrorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const download = (v: VersionSummary) =>
    run(`download-${v.versionNumber}`, async () => {
      saveBlob(await documentsApi.fetchFile(id, "download", v.versionNumber), v.fileName);
      reload(); // the download counter changed
    });

  const openPreview = (v: VersionSummary) =>
    run(`preview-${v.versionNumber}`, async () => {
      const blob = await documentsApi.fetchFile(id, "view", v.versionNumber);
      setPreview({ url: URL.createObjectURL(blob), mime: v.mimeType, name: v.fileName });
    });

  const restore = (v: VersionSummary) => {
    if (!window.confirm(`Restore version ${v.versionNumber}? This creates a new version with the same file. History is kept.`)) return;
    return run(`restore-${v.versionNumber}`, async () => {
      await documentsApi.restore(id, v.versionNumber);
      await reload();
    });
  };

  if (loading) return <FullPageSpinner />;

  if (loadError || !doc) {
    const status = loadError?.status;
    return (
      <div className="mx-auto max-w-lg rounded-lg border border-line bg-surface p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold">
          {status === 403 ? "You do not have access to this document" : status === 404 ? "Document not found" : "Could not load the document"}
        </h1>
        {status !== 403 && status !== 404 && <p className="mt-2 text-sm text-muted">{loadError?.message}</p>}
        <Link href="/search" className="mt-4 inline-block text-sm font-medium text-accent hover:underline">
          Back to search
        </Link>
      </div>
    );
  }

  const current = doc.currentVersion;
  const canModify = canModifyDocument(user, doc);
  const currentSummary = versions.find((v) => v.isCurrent);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/search" className="text-sm text-accent hover:underline">
          Back to search
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{doc.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge tone={doc.visibility === "restricted" ? "amber" : "green"}>
                {doc.visibility === "restricted" ? <Lock className="h-3 w-3" /> : <Globe className="h-3 w-3" />}
                {doc.visibility}
              </Badge>
              {doc.tags.map((tag) => (
                <Link key={tag} href={`/search?tags=${encodeURIComponent(tag.toLowerCase())}`}>
                  <Badge tone="indigo">{tag}</Badge>
                </Link>
              ))}
            </div>
          </div>
          {currentSummary && (
            <div className="flex gap-2">
              {PREVIEWABLE_MIME_TYPES.includes(currentSummary.mimeType) && (
                <Button variant="secondary" loading={busy === `preview-${currentSummary.versionNumber}`} onClick={() => openPreview(currentSummary)}>
                  <Eye className="h-4 w-4" /> Preview
                </Button>
              )}
              <Button loading={busy === `download-${currentSummary.versionNumber}`} onClick={() => download(currentSummary)}>
                <Download className="h-4 w-4" /> Download
              </Button>
            </div>
          )}
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        {doc.description && <p className="mb-4 whitespace-pre-line text-sm text-fg">{doc.description}</p>}
        <dl className="grid gap-x-6 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <Meta label="Uploaded by" value={doc.uploader.name} />
          <Meta label="Created" value={formatDate(doc.createdAt)} />
          <Meta label="Last updated" value={formatDate(doc.updatedAt)} />
          {current && (
            <>
              <Meta label="Current version" value={`v${current.versionNumber}`} />
              <Meta label="File" value={`${current.fileName} (${extOf(current.fileName).toUpperCase()}, ${formatBytes(current.sizeBytes)})`} />
              <Meta label="SHA-256" value={`${current.checksumSha256.slice(0, 16)}...`} title={current.checksumSha256} />
            </>
          )}
          <Meta label="Downloads" value={String(doc.downloadCount)} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Version history</h2>
        <VersionTable versions={versions} canModify={canModify} busy={busy} onDownload={download} onPreview={openPreview} onRestore={restore} />
      </section>

      {canModify && <NewVersionForm documentId={id} onDone={reload} />}

      {preview && <PreviewModal {...preview} onClose={closePreview} />}
    </div>
  );
}

function Meta({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 break-words text-fg" title={title}>
        {value}
      </dd>
    </div>
  );
}

export default function DocumentPage() {
  return (
    <AuthGuard>
      <DocumentView />
    </AuthGuard>
  );
}