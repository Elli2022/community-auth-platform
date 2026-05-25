import type { SqlClient } from "./client";

export interface WallPostRecord {
  id: number;
  username: string;
  message: string;
  image_data: string | null;
  shared_post_id: number | null;
  created_at: Date | string;
}

type Logger = { info: (message: string) => void };

export default function makeWallRepository({
  sql,
  logger,
}: {
  sql: SqlClient;
  logger: Logger;
}) {
  return Object.freeze({
    findAll,
    findByUsernames,
    findByUsername,
    findById,
    findByIds,
    getPostImage,
    create,
  });

  async function findAll(): Promise<WallPostRecord[]> {
    logger.info("[DB][WALL] findAll - START");
    const rows = await sql`
      SELECT id, username, message, image_data, shared_post_id, created_at
      FROM wall_posts
      ORDER BY created_at DESC
      LIMIT 100
    `;
    logger.info("[DB][WALL] findAll - DONE");
    return rows as WallPostRecord[];
  }

  async function findByUsernames(usernames: string[]): Promise<WallPostRecord[]> {
    if (usernames.length === 0) return [];
    const rows = await sql`
      SELECT id, username, message, image_data, shared_post_id, created_at
      FROM wall_posts
      WHERE username = ANY(${usernames})
      ORDER BY created_at DESC
      LIMIT 100
    `;
    return rows as WallPostRecord[];
  }

  async function findByUsername(username: string): Promise<WallPostRecord[]> {
    const rows = await sql`
      SELECT id, username, message, image_data, shared_post_id, created_at
      FROM wall_posts
      WHERE username = ${username}
      ORDER BY created_at DESC
      LIMIT 50
    `;
    return rows as WallPostRecord[];
  }

  async function findById(id: number): Promise<WallPostRecord | null> {
    const rows = await sql`
      SELECT id, username, message, image_data, shared_post_id, created_at
      FROM wall_posts WHERE id = ${id} LIMIT 1
    `;
    return (rows[0] as WallPostRecord | undefined) ?? null;
  }

  async function findByIds(ids: number[]): Promise<WallPostRecord[]> {
    if (ids.length === 0) return [];
    const rows = await sql`
      SELECT id, username, message, image_data, shared_post_id, created_at
      FROM wall_posts WHERE id = ANY(${ids})
    `;
    return rows as WallPostRecord[];
  }

  async function getPostImage(id: number): Promise<string | null> {
    const rows = await sql`
      SELECT image_data FROM wall_posts
      WHERE id = ${id} AND image_data IS NOT NULL
      LIMIT 1
    `;
    return (rows[0] as { image_data: string } | undefined)?.image_data ?? null;
  }

  async function create({
    username,
    message,
    image_data,
    shared_post_id,
  }: {
    username: string;
    message: string;
    image_data?: string | null;
    shared_post_id?: number | null;
  }): Promise<WallPostRecord> {
    logger.info(`[DB][WALL] create @${username} - START`);
    const rows = await sql`
      INSERT INTO wall_posts (username, message, image_data, shared_post_id)
      VALUES (${username}, ${message}, ${image_data ?? null}, ${shared_post_id ?? null})
      RETURNING id, username, message, image_data, shared_post_id, created_at
    `;
    logger.info(`[DB][WALL] create @${username} - DONE`);
    return rows[0] as WallPostRecord;
  }
}
