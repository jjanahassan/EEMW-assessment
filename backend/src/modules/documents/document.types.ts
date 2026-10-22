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