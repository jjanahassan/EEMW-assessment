export type Visibility = "public" | "restricted";

export interface UploadedFile {
  path: string;
  originalName: string;
  size: number;
}

export interface DocumentDetail {
  id: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  tags: string[];
  uploader: { id: string; name: string; departmentId: number };
  allowedDepartmentIds: number[];
  currentVersion: {
    id: string;
    versionNumber: number;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    checksumSha256: string;
    createdAt: Date;
  } | null;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SearchItem extends DocumentDetail {
  // [[ and ]] mark the matched words; the frontend renders them as <mark>
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
  createdAt: Date;
  isCurrent: boolean;
}

// what the service needs in order to stream a file
export interface VersionFile {
  id: string;
  versionNumber: number;
  fileName: string;
  storageKey: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256: string;
}