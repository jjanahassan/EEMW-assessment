import bcrypt from "bcryptjs";
import { pool } from "../config/db";
import { logger } from "../utils/logger";

const DEMO_PASSWORD = "Password123!";

const departments = ["Finance", "Legal", "Human Resources", "Engineering"];

const tags = ["Finance", "Legal", "HR", "Policy", "Report", "Technical", "Contract", "Onboarding"];

const users = [
  { name: "Admin User", email: "admin@company.com", department: "Engineering", role: "admin" },
  { name: "Farida Finance", email: "finance.manager@company.com", department: "Finance", role: "manager" },
  { name: "Omar Finance", email: "finance.employee@company.com", department: "Finance", role: "employee" },
  { name: "Laila Legal", email: "legal.manager@company.com", department: "Legal", role: "manager" },
  { name: "Hana HR", email: "hr.employee@company.com", department: "Human Resources", role: "employee" },
  { name: "Ziad Engineer", email: "engineer@company.com", department: "Engineering", role: "employee" },
];

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  for (const name of departments) {
    await pool.query(`INSERT INTO departments (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`, [name]);
  }

  for (const name of tags) {
    await pool.query(`INSERT INTO tags (name) VALUES ($1) ON CONFLICT ((lower(name))) DO NOTHING`, [name]);
  }

  for (const u of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, department_id, role)
       VALUES ($1, $2, $3, (SELECT id FROM departments WHERE name = $4), $5)
       ON CONFLICT ((lower(email))) DO NOTHING`,
      [u.name, u.email, passwordHash, u.department, u.role],
    );
  }

  logger.info(`Seed complete. Demo password for all users: ${DEMO_PASSWORD}`);
}

seed()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());