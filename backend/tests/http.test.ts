import { describe, expect, it } from "vitest";
import { contentDisposition } from "../src/utils/http";

describe("contentDisposition", () => {
  it("handles a plain ASCII name", () => {
    expect(contentDisposition("attachment", "report.pdf")).toBe(
      `attachment; filename="report.pdf"; filename*=UTF-8''report.pdf`,
    );
  });
  it("keeps Arabic names intact in the UTF-8 part and ASCII-only everywhere else", () => {
    const header = contentDisposition("inline", "تقرير.pdf");
    expect(header).toMatch(/^[\x20-\x7e]+$/);
    expect(header).toContain("filename*=UTF-8''%D8%AA");
    expect(header).toContain(".pdf");
  });
  it("cannot be used to inject headers or break out of the quotes", () => {
    const header = contentDisposition("attachment", 'a"b\r\nSet-Cookie: x=1.pdf');
    expect(header).not.toMatch(/[\r\n]/);
    expect(header).not.toContain('a"b');
  });
});