import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { DocumentService } from "../src/modules/documents/document.service";

const owner = { id: "u-owner", name: "Owner", email: "o@x.com", role: "employee" as const, departmentId: 1, departmentName: "Finance" };
const otherDeptManager = { ...owner, id: "u-m1", role: "manager" as const, departmentId: 2 };
const sameDeptManager = { ...owner, id: "u-m2", role: "manager" as const };

const content = "%PDF-1.7 version two";
const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

let dir: string;
let filePath: string;
beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "docrepo-"));
  filePath = path.join(dir, "v2.pdf");
  fs.writeFileSync(filePath, content);
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const uploaded = () => ({ path: filePath, originalName: "v2.pdf", size: Buffer.byteLength(content) });

const doc = (currentChecksum = "different") => ({
  id: "d-1",
  uploader: { id: owner.id, name: "Owner", departmentId: 1 },
  visibility: "restricted",
  allowedDepartmentIds: [1, 2],
  currentVersion: { id: "ver-1", versionNumber: 1, checksumSha256: currentChecksum },
});

function setup(options: { doc?: unknown; versionFile?: unknown; txError?: Error } = {}) {
  const documents = {
    findById: vi.fn().mockResolvedValue(options.doc ?? doc()),
    insertVersion: vi.fn(),
    setCurrentVersion: vi.fn(),
  };
  const versions = {
    lockAndGetNextNumber: vi.fn().mockResolvedValue(2),
    findFile: vi.fn().mockResolvedValue(options.versionFile ?? null),
  };
  const storage = {
    save: vi.fn().mockResolvedValue(undefined),
    copy: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    getStream: vi.fn(),
  };
  
  const events = { publish: vi.fn() };
  const runInTransaction = vi.fn(async (fn: (db: unknown) => unknown) => {
    if (options.txError) throw options.txError;
    return fn({});
  });
  const service = new DocumentService(
    documents as never, versions as never, {} as never, storage as never, events as never, runInTransaction as never,
  );
  return { service, documents, storage, events };
}

describe("addVersion", () => {
  it("stores the file, inserts the next version number and publishes an event", async () => {
    const { service, documents, storage, events } = setup();
    await service.addVersion(owner, "d-1", uploaded(), "Fixed typos");

    expect(storage.save).toHaveBeenCalledTimes(1);
    expect(documents.insertVersion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ versionNumber: 2, changeNote: "Fixed typos", checksum: sha(content), uploadedBy: owner.id }),
    );
    expect(documents.setCurrentVersion).toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith(expect.objectContaining({ type: "document.versionAdded" }));
  });

  it("rejects a file identical to the current version (409) without storing anything", async () => {
    const { service, storage } = setup({ doc: doc(sha(content)) });
    await expect(service.addVersion(owner, "d-1", uploaded())).rejects.toMatchObject({ statusCode: 409 });
    expect(storage.save).not.toHaveBeenCalled();
  });

  it("forbids a manager from another department (403)", async () => {
    const { service } = setup();
    await expect(service.addVersion(otherDeptManager, "d-1", uploaded())).rejects.toMatchObject({ statusCode: 403 });
  });

  it("allows a manager of the uploader's department", async () => {
    const { service } = setup();
    await expect(service.addVersion(sameDeptManager, "d-1", uploaded())).resolves.toBeDefined();
  });

  it("deletes the stored file and publishes nothing when the transaction fails", async () => {
    const { service, storage, events } = setup({ txError: new Error("db down") });
    await expect(service.addVersion(owner, "d-1", uploaded())).rejects.toThrow("db down");
    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(events.publish).not.toHaveBeenCalled();
  });
});

describe("restoreVersion", () => {
  const oldVersion = {
    id: "ver-0", versionNumber: 1, fileName: "report.pdf", storageKey: "documents/d-1/old.pdf",
    mimeType: "application/pdf", sizeBytes: 10, checksumSha256: "abc",
  };

  it("copies the old file into a new version and keeps the history", async () => {
    const { service, documents, storage } = setup({ versionFile: oldVersion });
    await service.restoreVersion(owner, "d-1", 1);

    expect(storage.copy).toHaveBeenCalledWith("documents/d-1/old.pdf", expect.stringMatching(/^documents\/d-1\/.+\.pdf$/));
    expect(documents.insertVersion).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ versionNumber: 2, changeNote: "Restored from version 1", checksum: "abc" }),
    );
  });

  it("returns 409 when that version is already current", async () => {
    const { service } = setup({ versionFile: { ...oldVersion, id: "ver-1" } });
    await expect(service.restoreVersion(owner, "d-1", 1)).rejects.toMatchObject({ statusCode: 409 });
  });

  it("returns 404 for an unknown version", async () => {
    const { service } = setup({ versionFile: null });
    await expect(service.restoreVersion(owner, "d-1", 99)).rejects.toMatchObject({ statusCode: 404 });
  });
});