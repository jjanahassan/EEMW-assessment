export type UserRole = "admin" | "manager" | "employee";
export type Visibility = "public" | "restricted";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: number;
  departmentName: string;
}

export interface Department {
  id: number;
  name: string;
}

export interface CurrentVersion {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  createdAt: string;
}

export interface DocumentDetail {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  tags: string[];
  uploader: { id: string; name: string; departmentId: number };
  allowedDepartmentIds: number[];
  currentVersion: CurrentVersion | null;
  downloadCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface SearchItem extends DocumentDetail {
  // [[ and ]] wrap the matched words
  highlight: { title: string; snippet: string | null } | null;
}

export interface SearchResult {
  items: SearchItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface VersionSummary {
  id: string;
  versionNumber: number;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
  changeNote: string | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
  isCurrent: boolean;
}

export interface FieldError {
  path: string;
  message: string;
}