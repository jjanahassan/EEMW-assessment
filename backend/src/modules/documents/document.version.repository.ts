import { pool, Queryable } from "../../config/db";
import { NotFoundError } from "../../errors/AppError";
import type { VersionFile, VersionSummary } from "./document.types";

export class DocumentVersionRepository {
  constructor(private db: Queryable = pool) {}

  async listByDocument(documentId: string): Promise<VersionSummary[]> {
    const { rows } = await this.db.query(
      `SELECT v.id, v.version_number, v.file_name, v.mime_type, v.size_bytes, v.checksum_sha256,
              v.change_note, v.created_at, u.id AS uploader_id, u.name AS uploader_name,
              (v.id = d.current_version_id) AS is_current
       FROM document_versions v
       JOIN documents d ON d.id = v.document_id
       JOIN users u ON u.id = v.uploaded_by
       WHERE v.document_id = $1
       ORDER BY v.version_number DESC`,
      [documentId],
    );
    return rows.map((r) => ({
      id: r.id,
      versionNumber: r.version_number,
      fileName: r.file_name,
      mimeType: r.mime_type,
      sizeBytes: Number(r.size_bytes),
      checksumSha256: r.checksum_sha256,
      changeNote: r.change_note,
      uploadedBy: { id: r.uploader_id, name: r.uploader_name },
      createdAt: r.created_at,
      isCurrent: r.is_current,
    }));
  }

  // versionNumber undefined means "the current version"
  async findFile(documentId: string, versionNumber?: number): Promise<VersionFile | null> {
    const { rows } = await this.db.query(
      `SELECT v.id, v.version_number, v.file_name, v.storage_key, v.mime_type, v.size_bytes, v.checksum_sha256
       FROM documents d
       JOIN document_versions v ON v.document_id = d.id
       WHERE d.id = $1 AND d.deleted_at IS NULL
         AND CASE WHEN $2::int IS NULL THEN v.id = d.current_version_id
                  ELSE v.version_number = $2::int END`,
      [documentId, versionNumber ?? null],
    );
    const r = rows[0];
    return r
      ? {
          id: r.id,
          versionNumber: r.version_number,
          fileName: r.file_name,
          storageKey: r.storage_key,
          mimeType: r.mime_type,
          sizeBytes: Number(r.size_bytes),
          checksumSha256: r.checksum_sha256,
        }
      : null;
  }

  // Locks the document row so concurrent version uploads queue up, then returns the next number
  async lockAndGetNextNumber(db: Queryable, documentId: string): Promise<number> {
    const locked = await db.query(`SELECT 1 FROM documents WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [documentId]);
    if (locked.rowCount === 0) throw new NotFoundError("Document not found");
    const { rows } = await db.query(
      `SELECT COALESCE(MAX(version_number), 0) + 1 AS next FROM document_versions WHERE document_id = $1`,
      [documentId],
    );
    return rows[0].next;
  }
}