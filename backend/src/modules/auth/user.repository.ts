import { Pool } from "pg";
import { pool } from "../../config/db";
import { AuthUser, UserRole } from "./auth.types";

const SELECT_USER = `
  SELECT u.id, u.name, u.email, u.role, u.password_hash,
         u.department_id, d.name AS department_name
  FROM users u
  JOIN departments d ON d.id = u.department_id`;

function toAuthUser(row: any): AuthUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    departmentId: row.department_id,
    departmentName: row.department_name,
  };
}

export class UserRepository {
  constructor(private db: Pool = pool) {}

  async findById(id: string): Promise<AuthUser | null> {
    const { rows } = await this.db.query(`${SELECT_USER} WHERE u.id = $1`, [id]);
    return rows[0] ? toAuthUser(rows[0]) : null;
  }

  async findCredentialsByEmail(email: string): Promise<{ user: AuthUser; passwordHash: string } | null> {
    const { rows } = await this.db.query(`${SELECT_USER} WHERE lower(u.email) = lower($1)`, [email]);
    return rows[0] ? { user: toAuthUser(rows[0]), passwordHash: rows[0].password_hash } : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const { rowCount } = await this.db.query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [email]);
    return (rowCount ?? 0) > 0;
  }

  async create(input: { name: string; email: string; passwordHash: string; departmentId: number }): Promise<AuthUser> {
    const { rows } = await this.db.query(
      `INSERT INTO users (name, email, password_hash, department_id, role)
       VALUES ($1, $2, $3, $4, 'employee') RETURNING id`,
      [input.name, input.email, input.passwordHash, input.departmentId],
    );
    return (await this.findById(rows[0].id))!;
  }
}