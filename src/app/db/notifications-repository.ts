import type { SqlClient } from "./client";

export type NotificationType =
  | "friend_request"
  | "friend_accepted"
  | "like"
  | "comment"
  | "share"
  | "message";

export interface NotificationRecord {
  id: number;
  recipient: string;
  actor: string;
  type: NotificationType;
  ref_id: number | null;
  preview: string;
  read_at: Date | string | null;
  created_at: Date | string;
}

function asRows<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : [];
}

export default function makeNotificationsRepository({ sql }: { sql: SqlClient }) {
  return Object.freeze({
    create,
    listForUser,
    countUnread,
    markRead,
    markAllRead,
  });

  async function create({
    recipient,
    actor,
    type,
    ref_id,
    preview,
  }: {
    recipient: string;
    actor: string;
    type: NotificationType;
    ref_id?: number | null;
    preview?: string;
  }): Promise<void> {
    if (recipient === actor) return;
    await sql`
      INSERT INTO notifications (recipient, actor, type, ref_id, preview)
      VALUES (${recipient}, ${actor}, ${type}, ${ref_id ?? null}, ${(preview ?? "").slice(0, 200)})
    `;
  }

  async function listForUser(
    username: string,
    limit = 40
  ): Promise<NotificationRecord[]> {
    const rows = asRows<NotificationRecord>(await sql`
      SELECT id, recipient, actor, type, ref_id, preview, read_at, created_at
      FROM notifications
      WHERE recipient = ${username}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);
    return rows;
  }

  async function countUnread(username: string): Promise<number> {
    const rows = asRows<{ cnt: number }>(await sql`
      SELECT COUNT(*)::int AS cnt FROM notifications
      WHERE recipient = ${username} AND read_at IS NULL
    `);
    return rows[0]?.cnt ?? 0;
  }

  async function markRead(id: number, username: string): Promise<void> {
    await sql`
      UPDATE notifications SET read_at = NOW()
      WHERE id = ${id} AND recipient = ${username}
    `;
  }

  async function markAllRead(username: string): Promise<void> {
    await sql`
      UPDATE notifications SET read_at = NOW()
      WHERE recipient = ${username} AND read_at IS NULL
    `;
  }
}
