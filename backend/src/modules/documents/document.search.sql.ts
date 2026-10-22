import { escapeLike } from "../../utils/sql";
import type { AuthUser } from "../auth/auth.types";
import { DETAIL_COLUMNS, DETAIL_JOINS } from "./document.repository";
import type { SearchParams } from "./document.schemas";
import { ALLOWED_FILE_TYPES } from "./fileTypes";

export function buildSearchQuery(user: AuthUser, params: SearchParams) {
  const values: unknown[] = [];
  // stores a value and returns its placeholder, e.g. "$3" or "$3::text"
  const p = (value: unknown, cast = "") => {
    values.push(value);
    return `$${values.length}${cast}`;
  };

  const where: string[] = ["d.deleted_at IS NULL"];

  // 1. Permission rule: the SQL twin of canAccessDocument() in document.policy.ts
  if (user.role !== "admin") {
    where.push(
      `(d.uploader_id = ${p(user.id)}
        OR d.visibility = 'public'
        OR EXISTS (SELECT 1 FROM document_permissions dp
                   WHERE dp.document_id = d.id AND dp.department_id = ${p(user.departmentId)}))`,
    );
  }

  // 2. Free-text query: full-text OR substring OR typo-tolerant OR tag match
  let rank = "0";
  let highlightCols = "NULL::text AS title_highlight, NULL::text AS snippet";
  if (params.q) {
    const q = p(params.q, "::text");
    const like = p(`%${escapeLike(params.q)}%`, "::text");
    const tsq = `websearch_to_tsquery('english', ${q})`;
    where.push(
      `(d.search_vector @@ ${tsq}
        OR d.title ILIKE ${like}
        OR ${q} <% d.title
        OR EXISTS (SELECT 1 FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                   WHERE dt.document_id = d.id AND (t.name ILIKE ${like} OR ${q} <% t.name)))`,
    );
    rank = `(ts_rank(d.search_vector, ${tsq}) * 2 + word_similarity(${q}, d.title))`;
    highlightCols = `
      ts_headline('english', d.title, ${tsq}, 'StartSel=[[, StopSel=]], HighlightAll=true') AS title_highlight,
      ts_headline('english', coalesce(d.description, ''), ${tsq},
                  'StartSel=[[, StopSel=]], MaxFragments=1, MinWords=8, MaxWords=25') AS snippet`;
  }

  // 3. Filters
  if (params.tags.length > 0) {
    const names = p(params.tags, "::text[]");
    const needed = p(params.tagMode === "all" ? params.tags.length : 1, "::int");
    where.push(
      `d.id IN (SELECT dt.document_id FROM document_tags dt JOIN tags t ON t.id = dt.tag_id
                WHERE lower(t.name) = ANY(${names})
                GROUP BY dt.document_id HAVING count(DISTINCT t.id) >= ${needed})`,
    );
  }
  if (params.uploader) {
    const like = p(`%${escapeLike(params.uploader)}%`, "::text");
    where.push(`(u.name ILIKE ${like} OR u.email ILIKE ${like})`);
  }
  if (params.fileType) {
    where.push(`v.mime_type = ${p(ALLOWED_FILE_TYPES[params.fileType].mime)}`);
  }
  if (params.from) where.push(`d.created_at >= ${p(params.from, "::timestamptz")}`);
  if (params.to) where.push(`d.created_at < ${p(params.to, "::timestamptz")} + interval '1 day'`);

  // 4. Sorting comes from a whitelist, never from user text
  const orders: Record<string, string> = {
    relevance: `${rank} DESC, d.created_at DESC, d.id`,
    newest: "d.created_at DESC, d.id",
    oldest: "d.created_at ASC, d.id",
    title: "lower(d.title) ASC, d.id",
    downloads: "d.download_count DESC, d.created_at DESC, d.id",
  };
  const requested = params.sort ?? (params.q ? "relevance" : "newest");
  const order = orders[requested === "relevance" && !params.q ? "newest" : requested];

  const whereSql = where.join(" AND ");
  const filterValueCount = values.length;
  const offset = (params.page - 1) * params.limit;

  // Page of ids first (with the total via a window function), then load details for those ids only
  const sql = `
    WITH page AS (
      SELECT d.id,
             count(*) OVER () AS total_count,
             row_number() OVER (ORDER BY ${order}) AS pos
      FROM documents d
      ${DETAIL_JOINS}
      WHERE ${whereSql}
      ORDER BY ${order}
      LIMIT ${p(params.limit)} OFFSET ${p(offset)}
    )
    SELECT ${DETAIL_COLUMNS}, pg.total_count, ${highlightCols}
    FROM page pg
    JOIN documents d ON d.id = pg.id
    ${DETAIL_JOINS}
    ORDER BY pg.pos`;

  // Only used when the requested page is past the end (no rows, so no total_count)
  const countSql = `SELECT count(*)::int AS n FROM documents d ${DETAIL_JOINS} WHERE ${whereSql}`;

  return { sql, values, countSql, countValues: values.slice(0, filterValueCount) };
}