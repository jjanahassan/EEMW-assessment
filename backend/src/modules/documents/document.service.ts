import { randomUUID } from "crypto";
import path from "path";
import type { Readable } from "stream";
import { withTransaction } from "../../config/db";
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnsupportedMediaTypeError,
  ValidationError,
} from "../../errors/AppError";
import type { EventBus } from "../../events/eventBus";
import type { StorageProvider } from "../../storage/StorageProvider";
import { fixFilenameEncoding, readHead, sanitizeFileName, sha256File } from "../../utils/files";
import { logger } from "../../utils/logger";
import type { AuthUser } from "../auth/auth.types";
import type { DepartmentRepository } from "../departments/department.repository";
import { canAccessDocument, canModifyDocument } from "./document.policy";
import type { DocumentRepository } from "./document.repository";
import type { UploadDocumentInput } from "./document.schemas";
import type { DocumentVersionRepository } from "./document.version.repository";
import type { DocumentDetail, UploadedFile, VersionFile, VersionSummary } from "./document.types";
import { ALLOWED_FILE_TYPES } from "./fileTypes";

export class DocumentService {
  constructor(
    private documents: DocumentRepository,
    private versions: DocumentVersionRepository,
    private departments: DepartmentRepository,
    private storage: StorageProvider,
    private events: EventBus,
    private runInTransaction: typeof withTransaction = withTransaction,
  ) {}

  // ---------- shared helpers ----------

  private async requireAccess(user: AuthUser, id: string): Promise<DocumentDetail> {
    const doc = await this.documents.findById(id);
    if (!doc) throw new NotFoundError("Document not found");
    if (!canAccessDocument(user, doc)) throw new ForbiddenError("You do not have access to this document");
    return doc;
  }

  private async requireModify(user: AuthUser, id: string): Promise<DocumentDetail> {
    const doc = await this.requireAccess(user, id);
    if (!canModifyDocument(user, doc)) {
      throw new ForbiddenError("Only the uploader, a manager of their department, or an admin can change this document");
    }
    return doc;
  }

  // Validates the real file (not what the client claims) and hashes it
  private async inspectFile(file: UploadedFile) {
    if (file.size === 0) throw new ValidationError("File is empty", [{ path: "file", message: "File is empty" }]);

    const fileName = sanitizeFileName(fixFilenameEncoding(file.originalName));
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const type = ALLOWED_FILE_TYPES[ext];
    if (!type) throw new UnsupportedMediaTypeError(`File type ".${ext}" is not allowed`);

    const head = await readHead(file.path, 4096);
    if (!type.matchesContent(head)) throw new UnsupportedMediaTypeError("File content does not match its extension");

    return { fileName, ext, mimeType: type.mime, checksum: await sha256File(file.path) };
  }

  private storageKey(documentId: string, versionId: string, ext: string) {
    return `documents/${documentId}/${versionId}.${ext}`;
  }

  // ---------- upload ----------

  async upload(user: AuthUser, input: UploadDocumentInput, file: UploadedFile): Promise<DocumentDetail> {
    const inspected = await this.inspectFile(file);

    let departmentIds: number[] = [];
    if (input.visibility === "restricted") {
      departmentIds = [...new Set([...input.departmentIds, user.departmentId])];
      if ((await this.departments.countExisting(departmentIds)) !== departmentIds.length) {
        throw new ValidationError("Invalid input", [{ path: "departmentIds", message: "One or more departments do not exist" }]);
      }
    }

    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = this.storageKey(documentId, versionId, inspected.ext);

    await this.storage.save(file.path, storageKey);
    try {
      await this.runInTransaction(async (db) => {
        await this.documents.insertDocument(db, {
          id: documentId,
          title: input.title,
          description: input.description,
          uploaderId: user.id,
          visibility: input.visibility,
        });
        await this.documents.insertVersion(db, {
          id: versionId,
          documentId,
          versionNumber: 1,
          fileName: inspected.fileName,
          storageKey,
          mimeType: inspected.mimeType,
          sizeBytes: file.size,
          checksum: inspected.checksum,
          uploadedBy: user.id,
          changeNote: "Initial upload",
        });
        await this.documents.setCurrentVersion(db, documentId, versionId);
        const tagIds = await this.documents.upsertTags(db, input.tags);
        await this.documents.attachTags(db, documentId, tagIds);
        await this.documents.setPermissions(db, documentId, departmentIds);
      });
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => {});
      throw err;
    }

    await this.events.publish({ type: "document.uploaded", documentId, userId: user.id });
    return (await this.documents.findById(documentId))!;
  }

  async getById(user: AuthUser, id: string): Promise<DocumentDetail> {
    return this.requireAccess(user, id);
  }

  // ---------- versions ----------

  async listVersions(user: AuthUser, id: string): Promise<VersionSummary[]> {
    await this.requireAccess(user, id);
    return this.versions.listByDocument(id);
  }

  async addVersion(user: AuthUser, documentId: string, file: UploadedFile, changeNote?: string): Promise<DocumentDetail> {
    const doc = await this.requireModify(user, documentId);
    const inspected = await this.inspectFile(file);

    if (doc.currentVersion?.checksumSha256 === inspected.checksum) {
      throw new ConflictError("This file is identical to the current version");
    }

    const versionId = randomUUID();
    const storageKey = this.storageKey(documentId, versionId, inspected.ext);

    await this.storage.save(file.path, storageKey);
    try {
      await this.runInTransaction(async (db) => {
        const versionNumber = await this.versions.lockAndGetNextNumber(db, documentId);
        await this.documents.insertVersion(db, {
          id: versionId,
          documentId,
          versionNumber,
          fileName: inspected.fileName,
          storageKey,
          mimeType: inspected.mimeType,
          sizeBytes: file.size,
          checksum: inspected.checksum,
          uploadedBy: user.id,
          changeNote,
        });
        await this.documents.setCurrentVersion(db, documentId, versionId);
      });
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => {});
      throw err;
    }

    await this.events.publish({ type: "document.versionAdded", documentId, userId: user.id });
    return (await this.documents.findById(documentId))!;
  }

  // Restoring never rewrites history: it copies the old file into a NEW version
  async restoreVersion(user: AuthUser, documentId: string, versionNumber: number): Promise<DocumentDetail> {
    const doc = await this.requireModify(user, documentId);

    const source = await this.versions.findFile(documentId, versionNumber);
    if (!source) throw new NotFoundError(`Version ${versionNumber} not found`);
    if (doc.currentVersion?.id === source.id) {
      throw new ConflictError(`Version ${versionNumber} is already the current version`);
    }

    const versionId = randomUUID();
    const ext = path.extname(source.storageKey).slice(1);
    const storageKey = this.storageKey(documentId, versionId, ext);

    await this.storage.copy(source.storageKey, storageKey);
    try {
      await this.runInTransaction(async (db) => {
        const newNumber = await this.versions.lockAndGetNextNumber(db, documentId);
        await this.documents.insertVersion(db, {
          id: versionId,
          documentId,
          versionNumber: newNumber,
          fileName: source.fileName,
          storageKey,
          mimeType: source.mimeType,
          sizeBytes: source.sizeBytes,
          checksum: source.checksumSha256,
          uploadedBy: user.id,
          changeNote: `Restored from version ${versionNumber}`,
        });
        await this.documents.setCurrentVersion(db, documentId, versionId);
      });
    } catch (err) {
      await this.storage.delete(storageKey).catch(() => {});
      throw err;
    }

    await this.events.publish({ type: "document.versionRestored", documentId, userId: user.id });
    return (await this.documents.findById(documentId))!;
  }

  // ---------- download / view ----------

  async getFile(user: AuthUser, documentId: string, versionNumber?: number): Promise<VersionFile> {
    await this.requireAccess(user, documentId);
    const file = await this.versions.findFile(documentId, versionNumber);
    if (!file) throw new NotFoundError(versionNumber ? `Version ${versionNumber} not found` : "Document has no file");
    return file;
  }

  async openFile(file: VersionFile): Promise<Readable> {
    try {
      return await this.storage.getStream(file.storageKey);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === "ENOENT") {
        logger.error({ storageKey: file.storageKey }, "Stored file is missing");
        throw new AppError(404, "The file is missing from storage", "FILE_MISSING");
      }
      throw err;
    }
  }

  // Best effort: a failed counter update must never fail a download that already succeeded
  async recordDownload(documentId: string): Promise<void> {
    try {
      await this.documents.incrementDownloadCount(documentId);
    } catch (err) {
      logger.warn({ err: String(err), documentId }, "Could not record download");
    }
  }
}