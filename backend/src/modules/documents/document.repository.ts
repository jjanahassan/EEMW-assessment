import { pool, Queryable } from "../../config/db";
import { DocumentDetail, Visibility } from "./document.types";

export const DETAIL_COLUMNS = `
  d.id, d.title, d.description, d.visibility, d.download_count, d.created_at, d.updated_at,
  u.id AS uploader_id, u.name AS uploader_name, u.department_id AS uploader_department_id,
  v.id AS version_id, v.version_number, v.file_name, v.mime_type, v.size_bytes,
  v.checksum_sha256, v.created_at AS version_created_at,
  COALESCE((SELECT array_agg(t.name ORDER BY t.name)
            FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
            WHERE dt.document_id = d.id), '{}'::text[]) AS tags,
  COALESCE((SELECT array_agg(dp.department_id ORDER BY dp.department_id)
            FROM document_permissions dp
            WHERE dp.document_id = d.id), '{}'::int[]) AS allowed_department_ids`;

export const DETAIL_JOINS = `
  JOIN users u ON u.id = d.uploader_id
  LEFT JOIN document_versions v ON v.id = d.current_version_id`;

const DETAIL_SELECT = `SELECT ${DETAIL_COLUMNS} FROM documents d ${DETAIL_JOINS}`;

export function toDetail(r: any): DocumentDetail {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    visibility: r.visibility,
    tags: r.tags,
    uploader: { id: r.uploader_id, name: r.uploader_name, departmentId: r.uploader_department_id },
    allowedDepartmentIds: r.allowed_department_ids,
    currentVersion: r.version_id
      ? {
          id: r.version_id,
          versionNumber: r.version_number,
          fileName: r.file_name,
          mimeType: r.mime_type,
          sizeBytes: Number(r.size_bytes), // BIGINT arrives as a string
          checksumSha256: r.checksum_sha256,
          createdAt: r.version_created_at,
        }
      : null,
    downloadCount: r.download_count,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export class DocumentRepository {
  constructor(private db: Queryable = pool) {}

  async findById(id: string): Promise<DocumentDetail | null> {
    const { rows } = await this.db.query(`${DETAIL_SELECT} WHERE d.id = $1 AND d.deleted_at IS NULL`, [id]);
    return rows[0] ? toDetail(rows[0]) : null;
  }

  // ---- write methods take the executor so the service can run them in one transaction ----

  async insertDocument(
    db: Queryable,
    input: { id: string; title: string; description?: string; uploaderId: string; visibility: Visibility },
  ) {
    await db.query(
      `INSERT INTO documents (id, title, description, uploader_id, visibility) VALUES ($1, $2, $3, $4, $5)`,
      [input.id, input.title, input.description ?? null, input.uploaderId, input.visibility],
    );
  }

  async insertVersion(
    db: Queryable,
    input: {
      id: string;
      documentId: string;
      versionNumber: number;
      fileName: string;
      storageKey: string;
      mimeType: string;
      sizeBytes: number;
      checksum: string;
      uploadedBy: string;
      changeNote?: string;
    },
  ) {
    await db.query(
      `INSERT INTO document_versions
         (id, document_id, version_number, file_name, storage_key, mime_type, size_bytes, checksum_sha256, uploaded_by, change_note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        input.id, input.documentId, input.versionNumber, input.fileName, input.storageKey,
        input.mimeType, input.sizeBytes, input.checksum, input.uploadedBy, input.changeNote ?? null,
      ],
    );
  }

  async setCurrentVersion(db: Queryable, documentId: string, versionId: string) {
    await db.query(`UPDATE documents SET current_version_id = $2 WHERE id = $1`, [documentId, versionId]);
  }

  // Sorted before inserting: two concurrent uploads inserting the same tags in different
  // orders could otherwise deadlock each other.
  async upsertTags(db: Queryable, names: string[]): Promise<number[]> {
    const sorted = [...names].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
    const ids: number[] = [];
    for (const name of sorted) {
      const { rows } = await db.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT ((lower(name))) DO UPDATE SET name = tags.name
         RETURNING id`,
        [name],
      );
      ids.push(rows[0].id);
    }
    return ids;
  }

  async attachTags(db: Queryable, documentId: string, tagIds: number[]) {
    if (tagIds.length === 0) return;
    await db.query(
      `INSERT INTO document_tags (document_id, tag_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
      [documentId, tagIds],
    );
  }

  async setPermissions(db: Queryable, documentId: string, departmentIds: number[]) {
    if (departmentIds.length === 0) return;
    await db.query(
      `INSERT INTO document_permissions (document_id, department_id) SELECT $1, unnest($2::int[])`,
      [documentId, departmentIds],
    );
  }
}