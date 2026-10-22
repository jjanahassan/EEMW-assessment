// Builds a Content-Disposition header that works with non-ASCII names (RFC 5987)
// and can't be used to inject extra headers.
export function contentDisposition(type: "attachment" | "inline", fileName: string): string {
  const fallback = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(fileName).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}