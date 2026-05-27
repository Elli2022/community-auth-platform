import { getSql } from "./client";

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(24) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  email VARCHAR(255),
  name VARCHAR(255),
  surname VARCHAR(255),
  avatar_id INTEGER NOT NULL DEFAULT 1,
  bio TEXT NOT NULL DEFAULT '',
  avatar_type VARCHAR(16) NOT NULL DEFAULT 'preset',
  avatar_image TEXT,
  cover_color VARCHAR(32) NOT NULL DEFAULT '#1877f2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_type VARCHAR(16) NOT NULL DEFAULT 'preset';
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_image TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_color VARCHAR(32) NOT NULL DEFAULT '#1877f2';

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_unique ON users (LOWER(email)) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS wall_posts (
  id SERIAL PRIMARY KEY,
  username VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  message TEXT NOT NULL,
  image_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wall_posts ADD COLUMN IF NOT EXISTS image_data TEXT;

CREATE INDEX IF NOT EXISTS idx_wall_posts_created ON wall_posts (created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
  username VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, username)
);

CREATE TABLE IF NOT EXISTS post_comments (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES wall_posts(id) ON DELETE CASCADE,
  username VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_post_comments_post ON post_comments (post_id, created_at ASC);

CREATE TABLE IF NOT EXISTS friendships (
  id SERIAL PRIMARY KEY,
  user_a VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  user_b VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  requested_by VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friendships_pair_unique UNIQUE (user_a, user_b)
);

CREATE INDEX IF NOT EXISTS idx_friendships_users ON friendships (user_a, user_b);

ALTER TABLE wall_posts ADD COLUMN IF NOT EXISTS shared_post_id INTEGER REFERENCES wall_posts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  recipient VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  actor VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  type VARCHAR(24) NOT NULL,
  ref_id INTEGER,
  preview TEXT NOT NULL DEFAULT '',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications (recipient, created_at DESC);

CREATE TABLE IF NOT EXISTS direct_messages (
  id SERIAL PRIMARY KEY,
  sender VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  recipient VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  body TEXT NOT NULL,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE direct_messages ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_thread ON direct_messages (sender, recipient, created_at ASC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  username VARCHAR(24) NOT NULL REFERENCES users(username) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens (token);
`;

const MIGRATION_LOCK_ID = 8815227;

export async function ensureSchema(): Promise<void> {
  const sql = getSql();
  await sql`SELECT pg_advisory_lock(${MIGRATION_LOCK_ID})`;
  try {
    const statements = SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const statement of statements) {
      try {
        await sql.query(statement);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("already exists") || msg.includes("duplicate")) {
          continue;
        }
        throw err;
      }
    }
  } finally {
    await sql`SELECT pg_advisory_unlock(${MIGRATION_LOCK_ID})`;
  }
}
