"use client";

import { useState, type FormEvent } from "react";
import { getErrorMessage } from "@/lib/api";
import { documentsApi } from "@/lib/endpoints";
import { validateFile } from "@/lib/utils";
import { Alert, Button, Field, inputClass } from "./ui";

export function NewVersionForm({ documentId, onDone }: { documentId: string; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const problem = validateFile(file);
    if (problem) return setError(problem);

    const form = new FormData();
    if (note.trim()) form.append("changeNote", note.trim());
    form.append("file", file as File);

    setSubmitting(true);
    setError(null);
    try {
      await documentsApi.addVersion(documentId, form);
      setFile(null);
      setNote("");
      onDone();
    } catch (err) {
      setError(getErrorMessage(err)); // for example 409 when the file is identical to the current version
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <h3 className="font-medium">Upload a new version</h3>
      {error && <Alert>{error}</Alert>}
      <Field label="File" htmlFor="version-file">
        <input
          id="version-file"
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-highlight"
        />
      </Field>
      <Field label="What changed? (optional)" htmlFor="version-note">
        <input id="version-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={inputClass} />
      </Field>
      <Button type="submit" loading={submitting}>
        Upload version
      </Button>
    </form>
  );
}