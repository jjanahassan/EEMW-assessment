export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export const TOKEN_KEY = "docrepo.token";

// Keep in sync with the backend (modules/documents/fileTypes.ts and MAX_FILE_SIZE_MB)
export const ALLOWED_EXTENSIONS = ["pdf", "docx", "xlsx", "pptx", "txt", "png", "jpg", "jpeg"] as const;
export const MAX_FILE_SIZE_MB = 25;
export const MAX_TAGS = 10;
export const PREVIEWABLE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain"];