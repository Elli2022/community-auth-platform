import { getConnectionString } from "@netlify/database";
import { neon } from "@neondatabase/serverless";
import pg from "pg";

export type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let pgPool: pg.Pool | null = null;

function readNetlifyDatabaseUrl(): string | null {
  if (!process.env.NETLIFY && !process.env.SITE_ID) {
    return null;
  }

  try {
    return getConnectionString();
  } catch {
    return (
      process.env.NETLIFY_DB_URL?.trim() ||
      process.env.NETLIFY_DATABASE_URL?.trim() ||
      null
    );
  }
}

export function getDatabaseUrl(): string {
  const url =
    process.env.DATABASE_URL?.trim() ||
    readNetlifyDatabaseUrl() ||
    process.env.NETLIFY_DB_URL?.trim() ||
    process.env.NETLIFY_DATABASE_URL?.trim();

  if (!url) {
    throw new Error(
      "DATABASE_URL saknas. Sätt den i .env (lokalt) eller aktivera Netlify Database / miljövariabler i produktion."
    );
  }
  return url;
}

function isLocalDatabaseUrl(url: string): boolean {
  try {
    const normalized = url.replace(/^postgresql:/i, "postgres:");
    const { hostname } = new URL(normalized);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "postgres"
    );
  } catch {
    return false;
  }
}

function createPgSql(connectionString: string): SqlClient {
  pgPool = new pg.Pool({ connectionString });

  const tag = async (
    strings: TemplateStringsArray,
    ...values: unknown[]
  ) => {
    let text = strings[0] ?? "";
    for (let i = 0; i < values.length; i++) {
      text += `$${i + 1}${strings[i + 1] ?? ""}`;
    }
    const result = await pgPool!.query(text, values);
    return result.rows;
  };

  const sql = Object.assign(tag, {
    query: async (statement: string, params?: unknown[]) => {
      const result = await pgPool!.query(statement, params);
      return result.rows;
    },
  });

  return sql as unknown as SqlClient;
}

export function getSql(): SqlClient {
  if (!sqlClient) {
    const url = getDatabaseUrl();
    sqlClient = isLocalDatabaseUrl(url) ? createPgSql(url) : neon(url);
  }
  return sqlClient;
}

export function resetSqlClient(): void {
  void pgPool?.end();
  pgPool = null;
  sqlClient = null;
}
