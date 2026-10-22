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
}