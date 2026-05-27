import type { SqlClient } from "./client";

export interface MessageRecord {
  id: number;
  sender: string;
  recipient: string;
  body: string;
  delivered_at: Date | string | null;
  read_at: Date | string | null;
  created_at: Date | string;
}

function asRows<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : [];
}

export default function makeMessagesRepository({ sql }: { sql: SqlClient }) {
  return Object.freeze({
    send,
    getThread,
    listConversations,
    countUnread,
    markAllDelivered,
    markThreadDelivered,
    markThreadRead,
  });

  async function send({
    sender,
    recipient,
    body,
  }: {
    sender: string;
    recipient: string;
    body: string;
  }): Promise<MessageRecord> {
    const rows = asRows<MessageRecord>(await sql`
      INSERT INTO direct_messages (sender, recipient, body)
      VALUES (${sender}, ${recipient}, ${body})
      RETURNING id, sender, recipient, body, delivered_at, read_at, created_at
    `);
    return rows[0];
  }

  async function getThread(
    userA: string,
    userB: string,
    limit = 80
  ): Promise<MessageRecord[]> {
    const rows = asRows<MessageRecord>(await sql`
      SELECT id, sender, recipient, body, delivered_at, read_at, created_at
      FROM direct_messages
      WHERE (sender = ${userA} AND recipient = ${userB})
         OR (sender = ${userB} AND recipient = ${userA})
      ORDER BY created_at ASC
      LIMIT ${limit}
    `);
    return rows;
  }

  async function listConversations(username: string) {
    const rows = asRows<{
      other_user: string;
      last_body: string;
      last_at: Date | string;
      unread: number;
    }>(await sql`
      WITH pairs AS (
        SELECT
          CASE WHEN sender = ${username} THEN recipient ELSE sender END AS other_user,
          body,
          created_at,
          read_at,
          sender
        FROM direct_messages
        WHERE sender = ${username} OR recipient = ${username}
      ),
      ranked AS (
        SELECT *,
          ROW_NUMBER() OVER (PARTITION BY other_user ORDER BY created_at DESC) AS rn
        FROM pairs
      )
      SELECT
        other_user,
        body AS last_body,
        created_at AS last_at,
        (
          SELECT COUNT(*)::int FROM direct_messages dm
          WHERE dm.recipient = ${username}
            AND dm.sender = ranked.other_user
            AND dm.read_at IS NULL
        ) AS unread
      FROM ranked
      WHERE rn = 1
      ORDER BY created_at DESC
      LIMIT 30
    `);
    return rows;
  }

  async function countUnread(username: string): Promise<number> {
    const rows = asRows<{ cnt: number }>(await sql`
      SELECT COUNT(*)::int AS cnt FROM direct_messages
      WHERE recipient = ${username} AND read_at IS NULL
    `);
    return rows[0]?.cnt ?? 0;
  }

  async function markThreadRead(viewer: string, other: string): Promise<void> {
    await sql`
      UPDATE direct_messages SET read_at = NOW()
      WHERE recipient = ${viewer} AND sender = ${other} AND read_at IS NULL
    `;
  }

  async function markAllDelivered(username: string): Promise<void> {
    await sql`
      UPDATE direct_messages
      SET delivered_at = NOW()
      WHERE recipient = ${username} AND delivered_at IS NULL
    `;
  }

  async function markThreadDelivered(viewer: string, other: string): Promise<void> {
    await sql`
      UPDATE direct_messages
      SET delivered_at = NOW()
      WHERE recipient = ${viewer}
        AND sender = ${other}
        AND delivered_at IS NULL
    `;
  }
}
