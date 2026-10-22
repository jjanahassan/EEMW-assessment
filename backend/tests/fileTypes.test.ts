import { describe, expect, it } from "vitest";
import { ALLOWED_FILE_TYPES } from "../src/modules/documents/fileTypes";

describe("file signatures", () => {
  it("accepts a real PDF header and rejects text renamed to .pdf", () => {
    expect(ALLOWED_FILE_TYPES.pdf.matchesContent(Buffer.from("%PDF-1.7\n..."))).toBe(true);
    expect(ALLOWED_FILE_TYPES.pdf.matchesContent(Buffer.from("this is not a pdf"))).toBe(false);
  });
  it("accepts a ZIP header for docx and rejects a PDF renamed to .docx", () => {
    expect(ALLOWED_FILE_TYPES.docx.matchesContent(Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14]))).toBe(true);
    expect(ALLOWED_FILE_TYPES.docx.matchesContent(Buffer.from("%PDF-1.7"))).toBe(false);
  });
  it("accepts PNG and JPEG signatures", () => {
    expect(ALLOWED_FILE_TYPES.png.matchesContent(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
    expect(ALLOWED_FILE_TYPES.jpg.matchesContent(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
  });
  it("rejects binary data as txt", () => {
    expect(ALLOWED_FILE_TYPES.txt.matchesContent(Buffer.from([0x68, 0x00, 0x69]))).toBe(false);
    expect(ALLOWED_FILE_TYPES.txt.matchesContent(Buffer.from("hello"))).toBe(true);
  });
});