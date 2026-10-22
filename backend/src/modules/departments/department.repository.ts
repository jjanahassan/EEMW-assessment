import { Pool } from "pg";
import { pool } from "../../config/db";

export interface Department {
  id: number;
  name: string;
}

export class DepartmentRepository {
  constructor(private db: Pool = pool) {}

  async list(): Promise<Department[]> {
    const { rows } = await this.db.query(`SELECT id, name FROM departments ORDER BY name`);
    return rows;
  }

  async exists(id: number): Promise<boolean> {
    const { rowCount } = await this.db.query(`SELECT 1 FROM departments WHERE id = $1`, [id]);
    return (rowCount ?? 0) > 0;
  }

    async countExisting(ids: number[]): Promise<number> {
    if (ids.length === 0) return 0;
    const { rows } = await this.db.query(`SELECT count(*)::int AS n FROM departments WHERE id = ANY($1::int[])`, [ids]);
    return rows[0].n;
  }
}