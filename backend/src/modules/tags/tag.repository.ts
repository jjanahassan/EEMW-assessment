import { pool, Queryable } from "../../config/db";
import { escapeLike } from "../../utils/sql";

export class TagRepository {
  constructor(private db: Queryable = pool) {}

  // Prefix match for autocomplete: "fi" suggests "Finance"
  async suggest(prefix = "", limit = 10): Promise<string[]> {
    const { rows } = await this.db.query(`SELECT name FROM tags WHERE name ILIKE $1 ORDER BY name LIMIT $2`, [
      `${escapeLike(prefix)}%`,
      limit,
    ]);
    return rows.map((r) => r.name);
  }
}