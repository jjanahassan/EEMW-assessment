const startsWith =
  (...bytes: number[]) =>
  (head: Buffer) =>
    head.length >= bytes.length && bytes.every((b, i) => head[i] === b);

const isZip = startsWith(0x50, 0x4b, 0x03, 0x04); // docx, xlsx, pptx are ZIP containers
const isText = (head: Buffer) => head.length > 0 && !head.includes(0); // text has no NUL bytes

export interface AllowedFileType {
  mime: string;
  matchesContent: (head: Buffer) => boolean;
}

export const ALLOWED_FILE_TYPES: Record<string, AllowedFileType> = {
  pdf: { mime: "application/pdf", matchesContent: startsWith(0x25, 0x50, 0x44, 0x46, 0x2d) }, // %PDF-
  docx: { mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", matchesContent: isZip },
  xlsx: { mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", matchesContent: isZip },
  pptx: { mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", matchesContent: isZip },
  txt: { mime: "text/plain", matchesContent: isText },
  png: { mime: "image/png", matchesContent: startsWith(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a) },
  jpg: { mime: "image/jpeg", matchesContent: startsWith(0xff, 0xd8, 0xff) },
  jpeg: { mime: "image/jpeg", matchesContent: startsWith(0xff, 0xd8, 0xff) },
};

export const ALLOWED_EXTENSIONS = Object.keys(ALLOWED_FILE_TYPES);

// Safe to display inline in a browser (none of these can execute script)
export const PREVIEWABLE_MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "text/plain"]);