import { neon } from "@neondatabase/serverless";

export type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      "DATABASE_URL saknas. Sätt den i .env (lokalt) eller i Netlify Environment variables."
    );
  }
  return url;
}

export function getSql(): SqlClient {
  if (!sqlClient) {
    sqlClient = neon(getDatabaseUrl());
  }
  return sqlClient;
}

export function resetSqlClient(): void {
  sqlClient = null;
}
