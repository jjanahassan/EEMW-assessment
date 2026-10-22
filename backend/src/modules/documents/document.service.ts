import { randomUUID } from "crypto";
import path from "path";
import { withTransaction } from "../../config/db";
import { ForbiddenError, NotFoundError, UnsupportedMediaTypeError, ValidationError } from "../../errors/AppError";
import type { StorageProvider } from "../../storage/StorageProvider";
import { fixFilenameEncoding, readHead, sanitizeFileName, sha256File } from "../../utils/files";
import type { AuthUser } from "../auth/auth.types";
import type { DepartmentRepository } from "../departments/department.repository";
import { canAccessDocument } from "./document.policy";
import type { DocumentRepository } from "./document.repository";
import type { UploadDocumentInput } from "./document.schemas";
import type { DocumentDetail, UploadedFile } from "./document.types";
import { ALLOWED_FILE_TYPES } from "./fileTypes";
import type { EventBus } from "../../events/eventBus";

export class DocumentService {
  constructor(
    private documents: DocumentRepository,
    private departments: DepartmentRepository,
    private storage: StorageProvider,
    private events: EventBus,
  ) {}

  async upload(user: AuthUser, input: UploadDocumentInput, file: UploadedFile): Promise<DocumentDetail> {
    if (file.size === 0) throw new ValidationError("File is empty", [{ path: "file", message: "File is empty" }]);

    // 1. Validate the real file, not what the client claims
    const fileName = sanitizeFileName(fixFilenameEncoding(file.originalName));
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const type = ALLOWED_FILE_TYPES[ext];
    if (!type) throw new UnsupportedMediaTypeError(`File type ".${ext}" is not allowed`);

    const head = await readHead(file.path, 4096);
    if (!type.matchesContent(head)) {
      throw new UnsupportedMediaTypeError("File content does not match its extension");
    }
    const checksum = await sha256File(file.path);

    // 2. Work out who may see it (restricted always includes the uploader's own department)
    let departmentIds: number[] = [];
    if (input.visibility === "restricted") {
      departmentIds = [...new Set([...input.departmentIds, user.departmentId])];
      if ((await this.departments.countExisting(departmentIds)) !== departmentIds.length) {
        throw new ValidationError("Invalid input", [{ path: "departmentIds", message: "One or more departments do not exist" }]);
      }
    }

    // 3. Store the file first, then write all rows atomically; undo the file if the DB fails
    const documentId = randomUUID();
    const versionId = randomUUID();
    const storageKey = `documents/${documentId}/v1-${versionId}.${ext}`;

    await this.storage.save(file.path, storageKey);
    try {
      await withTransaction(async (db) => {
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
          fileName,
          storageKey,
          mimeType: type.mime,
          sizeBytes: file.size,
          checksum,
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
    const doc = await this.documents.findById(id);
    if (!doc) throw new NotFoundError("Document not found");
    if (!canAccessDocument(user, doc)) throw new ForbiddenError("You do not have access to this document");
    return doc;
  }
}