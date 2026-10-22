import crypto from "crypto";
import fs from "fs";
import path from "path";

export async function readHead(filePath: string, bytes = 16): Promise<Buffer> {
  const handle = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(bytes);
    const { bytesRead } = await handle.read(buf, 0, bytes, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

export function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(filePath)
      .on("error", reject)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")));
  });
}

// Browsers send UTF-8 filenames, but multipart parsers often decode them as latin1,
// which turns Arabic or accented names into garbage. Re-decode only when that happened.
export function fixFilenameEncoding(name: string): string {
  if ([...name].some((ch) => ch.charCodeAt(0) > 255)) return name; // already proper Unicode
  const decoded = Buffer.from(name, "latin1").toString("utf8");
  return decoded.includes("\uFFFD") ? name : decoded;
}

// Removes any directory part and control characters; keeps the end so the extension survives
export function sanitizeFileName(name: string): string {
  const base = path.basename(name.replace(/\\/g, "/"));
  const cleaned = base.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "file").slice(-255);
}