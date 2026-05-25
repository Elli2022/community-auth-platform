import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getSql } from "./client";

export async function ensureSchema(): Promise<void> {
  const sql = getSql();
  const schemaPath = join(__dirname, "../../../db/schema.sql");
  const schema = readFileSync(schemaPath, "utf8");
  const statements = schema
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await sql.query(statement);
  }
}
