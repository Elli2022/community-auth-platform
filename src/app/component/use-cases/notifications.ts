import { avatarUrlFor } from "../../db/map-user";
import type makeNotificationsRepository from "../../db/notifications-repository";
import type makeUsersRepository from "../../db/users-repository";

type NotificationsRepository = ReturnType<typeof makeNotificationsRepository>;
type UsersRepository = ReturnType<typeof makeUsersRepository>;

function formatDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("sv-SE");
}

const labels: Record<string, string> = {
  friend_request: "skickade en vänförfrågan",
  friend_accepted: "accepterade din vänförfrågan",
  like: "gillade ditt inlägg",
  comment: "kommenterade ditt inlägg",
  share: "delade ditt inlägg",
  message: "skickade ett meddelande",
};

export function createNotificationsUseCase({
  notificationsRepository,
  usersRepository,
}: {
  notificationsRepository: NotificationsRepository;
  usersRepository: UsersRepository;
}) {
  return Object.freeze({
    list: async (username: string) => {
      const rows = await notificationsRepository.listForUser(username);
      const actors = [...new Set(rows.map((r) => r.actor))];
      const users = await usersRepository.findByUsernames(actors);
      const byName = new Map(users.map((u) => [u.username, u]));

      return {
        unread_count: await notificationsRepository.countUnread(username),
        items: rows.map((n) => {
          const actor = byName.get(n.actor);
          return {
            id: n.id,
            type: n.type,
            ref_id: n.ref_id,
            preview: n.preview,
            read: Boolean(n.read_at),
            created: formatDate(n.created_at),
            text: actor
              ? `${actor.name || n.actor} ${labels[n.type] || n.type}`
              : `@${n.actor} ${labels[n.type] || n.type}`,
            actor: actor
              ? {
                  username: n.actor,
                  display_name: actor.name || n.actor,
                  avatar_url: avatarUrlFor(actor),
                }
              : { username: n.actor, display_name: n.actor, avatar_url: "/avatars/1.svg" },
          };
        }),
      };
    },

    markRead: async (username: string, id?: number) => {
      if (id) await notificationsRepository.markRead(id, username);
      else await notificationsRepository.markAllRead(username);
      return { ok: true };
    },
  });
}
