"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { AuthGuard } from "@/components/AuthGuard";
import { TagInput } from "@/components/TagInput";
import { Alert, Button, Field, inputClass } from "@/components/ui";
import { ApiError, getErrorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { ALLOWED_EXTENSIONS, MAX_FILE_SIZE_MB } from "@/lib/constants";
import { departmentsApi, documentsApi } from "@/lib/endpoints";
import type { Department, Visibility } from "@/lib/types";
import { formatBytes, validateFile } from "@/lib/utils";

const ACCEPT = ALLOWED_EXTENSIONS.map((e) => `.${e}`).join(",");
const fileInputClass =
  "block w-full text-sm text-muted file:mr-4 file:rounded-md file:border-0 file:bg-accent-soft file:px-4 file:py-2 file:text-sm file:font-medium file:text-accent hover:file:bg-highlight";

function UploadForm() {
  const { user } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<Visibility>("public");
  const [departmentIds, setDepartmentIds] = useState<number[]>([]);
  const [file, setFile] = useState<File | null>(null);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    departmentsApi.list().then((r) => setDepartments(r.departments)).catch(() => {});
  }, []);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!title.trim()) e.title = "Title is required";
    else if (title.trim().length > 200) e.title = "Title must be at most 200 characters";
    if (description.length > 2000) e.description = "Description must be at most 2000 characters";
    const fileProblem = validateFile(file);
    if (fileProblem) e.file = fileProblem;
    return e;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length > 0) return;

    const form = new FormData();
    form.append("title", title.trim());
    if (description.trim()) form.append("description", description.trim());
    if (tags.length > 0) form.append("tags", tags.join(","));
    form.append("visibility", visibility);
    if (visibility === "restricted" && departmentIds.length > 0) form.append("departmentIds", departmentIds.join(","));
    form.append("file", file as File);

    setSubmitting(true);
    try {
      const { document } = await documentsApi.upload(form);
      router.push(`/documents/${document.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.details.length > 0) {
        setErrors(Object.fromEntries(err.details.map((d) => [d.path.split(".")[0], d.message])));
      } else {
        setError(getErrorMessage(err)); // for example 415 (type or content mismatch) or 413 (too large)
      }
      setSubmitting(false);
    }
  }

  function toggleDepartment(id: number, checked: boolean) {
    setDepartmentIds((prev) => (checked ? [...prev, id] : prev.filter((d) => d !== id)));
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Upload a document</h1>
      <form onSubmit={onSubmit} noValidate className="mt-4 space-y-5 rounded-lg border border-line bg-surface p-6 shadow-sm">
        {error && <Alert>{error}</Alert>}

        <Field label="Title" htmlFor="title" error={errors.title}>
          <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className={inputClass} />
        </Field>

        <Field label="Description (optional)" htmlFor="description" error={errors.description}>
          <textarea id="description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={inputClass} />
        </Field>

        <Field label="Tags" htmlFor="tags" error={errors.tags} hint="Press Enter or comma to add. Up to 10 tags.">
          <TagInput id="tags" value={tags} onChange={setTags} placeholder="Finance, Legal, Policy" />
        </Field>

        <fieldset>
          <legend className="mb-1 text-sm font-medium text-fg">Who can see this document?</legend>
          <div className="space-y-2">
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="visibility" checked={visibility === "public"} onChange={() => setVisibility("public")} className="mt-1" />
              <span>
                <span className="font-medium">Everyone</span>
                <span className="block text-xs text-muted">Any logged-in employee can find and read it.</span>
              </span>
            </label>
            <label className="flex items-start gap-2 text-sm">
              <input type="radio" name="visibility" checked={visibility === "restricted"} onChange={() => setVisibility("restricted")} className="mt-1" />
              <span>
                <span className="font-medium">Selected departments only</span>
                <span className="block text-xs text-muted">Your own department always keeps access.</span>
              </span>
            </label>
          </div>

          {visibility === "restricted" && (
            <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-sunken p-3">
              {departments.map((d) => {
                const own = d.id === user?.departmentId;
                return (
                  <label key={d.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={own || departmentIds.includes(d.id)} disabled={own} onChange={(e) => toggleDepartment(d.id, e.target.checked)} />
                    {d.name}
                    {own && <span className="text-xs text-muted">(yours)</span>}
                  </label>
                );
              })}
            </div>
          )}
          {errors.departmentIds && <p className="mt-1 text-xs text-danger-fg">{errors.departmentIds}</p>}
        </fieldset>

        <Field label="File" htmlFor="file" error={errors.file} hint={`${ALLOWED_EXTENSIONS.join(", ")}. Up to ${MAX_FILE_SIZE_MB} MB.`}>
          <input id="file" type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className={fileInputClass} />
          {file && <p className="mt-1 text-xs text-muted">{file.name} ({formatBytes(file.size)})</p>}
        </Field>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            Upload
          </Button>
        </div>
      </form>
    </div>
  );
}

export default function UploadPage() {
  return (
    <AuthGuard>
      <UploadForm />
    </AuthGuard>
  );
}