import fs from "fs";
import path from "path";
import { pool } from "../config/db";
import { redis } from "../config/redis";
import { documentService, userRepository } from "../container";
import { uploadDocumentSchema } from "../modules/documents/document.schemas";
import { logger } from "../utils/logger";

const SAMPLE = path.resolve("samples/report.pdf");

const demo = [
  { by: "finance.employee@company.com", title: "Annual Finance Report", description: "Audited figures for the year",
    tags: "Finance, Report", visibility: "restricted", departmentIds: "2" },
  { by: "hr.employee@company.com", title: "Employee Leave Policy", description: "Rules for annual leave and sick leave",
    tags: "HR, Policy", visibility: "public" },
  { by: "engineer@company.com", title: "API Technical Guide", description: "How to call the internal REST API",
    tags: "Technical", visibility: "public" },
  { by: "legal.manager@company.com", title: "Vendor Contract Template", description: "Standard terms for new vendors",
    tags: "Legal, Contract", visibility: "restricted", departmentIds: "1" },
];

async function main() {
  if (!fs.existsSync(SAMPLE)) throw new Error("samples/report.pdf not found");
  await redis.connect().catch(() => logger.warn("Redis unavailable; search cache not invalidated"));
  const size = fs.statSync(SAMPLE).size;

  for (const { by, ...fields } of demo) {
    const exists = await pool.query("SELECT 1 FROM documents WHERE title = $1", [fields.title]);
    if (exists.rowCount) {
      logger.info(`skipped (already exists): ${fields.title}`);
      continue;
    }
    const credentials = await userRepository.findCredentialsByEmail(by);
    if (!credentials) throw new Error(`User ${by} not found. Run "npm run seed" first.`);

    const input = uploadDocumentSchema.parse(fields); // same validation as the API
    const originalName = `${fields.title.toLowerCase().replace(/\s+/g, "-")}.pdf`;
    await documentService.upload(credentials.user, input, { path: SAMPLE, originalName, size });
    logger.info(`created: ${fields.title}`);
  }
}

main()
  .catch((err) => {
    logger.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    redis.disconnect();
    await pool.end();
  });