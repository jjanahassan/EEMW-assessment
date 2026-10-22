import { Pool, PoolClient } from "pg";
import { env } from "./env";
import type { QueryResult } from "pg";

export const pool = new Pool({ connectionString: env.DATABASE_URL, max: 10 });

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// Anything that can run a query: the pool, or a client inside a transaction
export interface Queryable {
  query(text: string, values?: unknown[]): Promise<QueryResult<any>>;
}