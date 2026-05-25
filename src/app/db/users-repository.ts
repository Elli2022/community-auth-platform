import type { SqlClient } from "./client";

export interface UserRecord {
  id: number;
  username: string;
  password_hash: string;
  email: string | null;
  name: string | null;
  surname: string | null;
  created_at: Date | string;
  modified_at: Date | string;
}

export interface CreateUserInput {
  username: string;
  password: string;
  email?: string;
  name?: string;
  surname?: string;
  created: string;
  modified: string;
}

type Logger = { info: (message: string) => void };

export default function makeUsersRepository({
  sql,
  logger,
}: {
  sql: SqlClient;
  logger: Logger;
}) {
  return Object.freeze({
    findAll,
    findByUsername,
    create,
    truncateAll,
  });

  async function findAll(): Promise<UserRecord[]> {
    logger.info("[DB][USERS] findAll - START");
    const rows = await sql`
      SELECT id, username, password_hash, email, name, surname, created_at, modified_at
      FROM users
      ORDER BY id ASC
    `;
    logger.info("[DB][USERS] findAll - DONE");
    return rows as UserRecord[];
  }

  async function findByUsername(username: string): Promise<UserRecord | null> {
    const rows = await sql`
      SELECT id, username, password_hash, email, name, surname, created_at, modified_at
      FROM users
      WHERE username = ${username}
      LIMIT 1
    `;
    return (rows[0] as UserRecord | undefined) ?? null;
  }

  async function create(user: CreateUserInput): Promise<UserRecord> {
    logger.info(`[DB][USERS] create ${user.username} - START`);
    const rows = await sql`
      INSERT INTO users (username, password_hash, email, name, surname, created_at, modified_at)
      VALUES (
        ${user.username},
        ${user.password},
        ${user.email ?? null},
        ${user.name ?? null},
        ${user.surname ?? null},
        ${user.created},
        ${user.modified}
      )
      RETURNING id, username, password_hash, email, name, surname, created_at, modified_at
    `;
    logger.info(`[DB][USERS] create ${user.username} - DONE`);
    return rows[0] as UserRecord;
  }

  async function truncateAll(): Promise<void> {
    await sql`TRUNCATE TABLE users RESTART IDENTITY`;
  }
}
