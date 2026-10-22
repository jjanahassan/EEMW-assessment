import { pool, Queryable } from "../../config/db";
import type { AuthUser } from "../auth/auth.types";
import { toDetail } from "./document.repository";
import type { SearchParams } from "./document.schemas";
import { buildSearchQuery } from "./document.search.sql";
import type { SearchItem, SearchResult } from "./document.types";

function toItem(r: any): SearchItem {
  return {
    ...toDetail(r),
    highlight: r.title_highlight ? { title: r.title_highlight, snippet: r.snippet || null } : null,
  };
}

export class DocumentSearchRepository {
  constructor(private db: Queryable = pool) {}

  async search(user: AuthUser, params: SearchParams): Promise<SearchResult> {
    const query = buildSearchQuery(user, params);
    const { rows } = await this.db.query(query.sql, query.values);

    let total = rows.length > 0 ? Number(rows[0].total_count) : 0;
    if (rows.length === 0 && params.page > 1) {
      const { rows: counted } = await this.db.query(query.countSql, query.countValues);
      total = counted[0].n;
    }

    return {
      items: rows.map(toItem),
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
    };
  }
}