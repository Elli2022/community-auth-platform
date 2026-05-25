import type { UserRecord } from "./users-repository";

export function mapUserToResponse(
  row: UserRecord,
  transformDate: (ts: number) => string
) {
  const created =
    row.created_at instanceof Date
      ? row.created_at.getTime()
      : new Date(row.created_at).getTime();
  const modified =
    row.modified_at instanceof Date
      ? row.modified_at.getTime()
      : new Date(row.modified_at).getTime();

  const user: Record<string, unknown> = {
    username: row.username,
    created: transformDate(created),
    modified: transformDate(modified),
  };

  if (row.email) user.email = row.email;
  if (row.name) user.name = row.name;
  if (row.surname) user.surname = row.surname;

  return user;
}
