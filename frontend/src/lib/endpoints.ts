import { api, apiFetch } from "./api";
import type { Department, DocumentDetail, SearchResult, User, VersionSummary } from "./types";

export const authApi = {
  login: (email: string, password: string) =>
    api<{ user: User; token: string }>("/api/auth/login", { method: "POST", json: { email, password } }),
  register: (input: { name: string; email: string; password: string; departmentId: number }) =>
    api<{ user: User; token: string }>("/api/auth/register", { method: "POST", json: input }),
  me: () => api<{ user: User }>("/api/auth/me"),
};

export const departmentsApi = {
  list: () => api<{ departments: Department[] }>("/api/departments"),
};

export const tagsApi = {
  suggest: (q: string, signal?: AbortSignal) =>
    api<{ tags: string[] }>(`/api/tags?q=${encodeURIComponent(q)}`, { signal }),
};

export const documentsApi = {
  search: (queryString: string, signal?: AbortSignal) => api<SearchResult>(`/api/documents?${queryString}`, { signal }),
  get: (id: string) => api<{ document: DocumentDetail }>(`/api/documents/${id}`),
  versions: (id: string) => api<{ versions: VersionSummary[] }>(`/api/documents/${id}/versions`),
  upload: (form: FormData) => api<{ document: DocumentDetail }>("/api/documents", { method: "POST", body: form }),
  addVersion: (id: string, form: FormData) =>
    api<{ document: DocumentDetail }>(`/api/documents/${id}/versions`, { method: "POST", body: form }),
  restore: (id: string, versionNumber: number) =>
    api<{ document: DocumentDetail }>(`/api/documents/${id}/versions/${versionNumber}/restore`, { method: "POST" }),
  fetchFile: async (id: string, mode: "download" | "view", versionNumber?: number): Promise<Blob> => {
    const query = versionNumber ? `?version=${versionNumber}` : "";
    return (await apiFetch(`/api/documents/${id}/${mode}${query}`)).blob();
  },
};