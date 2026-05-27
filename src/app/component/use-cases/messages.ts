import sanitizeHtml from "sanitize-html";
import { avatarUrlFor } from "../../db/map-user";
import type makeMessagesRepository from "../../db/messages-repository";
import type makeNotificationsRepository from "../../db/notifications-repository";
import type makeSocialRepository from "../../db/social-repository";
import type makeUsersRepository from "../../db/users-repository";

const sanitize = (text: string) =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

type MessagesRepository = ReturnType<typeof makeMessagesRepository>;
type NotificationsRepository = ReturnType<typeof makeNotificationsRepository>;
type SocialRepository = ReturnType<typeof makeSocialRepository>;
type UsersRepository = ReturnType<typeof makeUsersRepository>;

function formatDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("sv-SE");
}

function formatTime(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime())
    ? String(value)
    : d.toLocaleTimeString("sv-SE", {
        hour: "2-digit",
        minute: "2-digit",
      });
}

export function createMessagesUseCase({
  messagesRepository,
  notificationsRepository,
  socialRepository,
  usersRepository,
}: {
  messagesRepository: MessagesRepository;
  notificationsRepository: NotificationsRepository;
  socialRepository: SocialRepository;
  usersRepository: UsersRepository;
}) {
  function mapThreadRows(rows: Awaited<ReturnType<MessagesRepository["getThread"]>>, viewer: string) {
    return rows.map((m) => ({
      id: m.id,
      sender: m.sender,
      recipient: m.recipient,
      body: m.body,
      mine: m.sender === viewer,
      delivered: Boolean(m.delivered_at),
      delivered_at: m.delivered_at ? formatTime(m.delivered_at) : null,
      read: Boolean(m.read_at),
      read_at: m.read_at ? formatTime(m.read_at) : null,
      created: formatDate(m.created_at),
    }));
  }

  return Object.freeze({
    listConversations: async (username: string) => {
      await messagesRepository.markAllDelivered(username);
      const rows = await messagesRepository.listConversations(username);
      const others = rows.map((r) => r.other_user);
      const users = await usersRepository.findByUsernames(others);
      const byName = new Map(users.map((u) => [u.username, u]));

      return {
        unread_count: await messagesRepository.countUnread(username),
        conversations: rows.map((r) => {
          const u = byName.get(r.other_user);
          return {
            username: r.other_user,
            display_name: u?.name || r.other_user,
            avatar_url: u ? avatarUrlFor(u) : "/avatars/1.svg",
            last_message: r.last_body,
            last_at: formatDate(r.last_at),
            unread: r.unread,
          };
        }),
      };
    },

    getThread: async (viewer: string, other: string) => {
      const friends = await socialRepository.listFriends(viewer);
      if (!friends.includes(other)) {
        throw new Error("Du kan bara chatta med accepterade vänner");
      }
      await messagesRepository.markThreadDelivered(viewer, other);
      await messagesRepository.markThreadRead(viewer, other);
      const rows = await messagesRepository.getThread(viewer, other);
      return mapThreadRows(rows, viewer);
    },

    peekThread: async (viewer: string, other: string) => {
      const friends = await socialRepository.listFriends(viewer);
      if (!friends.includes(other)) {
        throw new Error("Du kan bara chatta med accepterade vänner");
      }
      await messagesRepository.markThreadDelivered(viewer, other);
      const rows = await messagesRepository.getThread(viewer, other);
      return mapThreadRows(rows, viewer);
    },

    send: async (sender: string, recipient: string, body: string) => {
      const friends = await socialRepository.listFriends(sender);
      if (!friends.includes(recipient)) {
        throw new Error("Du kan bara skicka meddelanden till vänner");
      }
      const trimmed = sanitize(body.trim());
      if (!trimmed) throw new Error("Meddelande krävs");
      if (trimmed.length > 1000) throw new Error("Max 1000 tecken");

      const row = await messagesRepository.send({
        sender,
        recipient,
        body: trimmed,
      });

      await notificationsRepository.create({
        recipient,
        actor: sender,
        type: "message",
        ref_id: row.id,
        preview: trimmed.slice(0, 120),
      });

      return {
        id: row.id,
        sender: row.sender,
        recipient: row.recipient,
        body: row.body,
        mine: true,
        delivered: false,
        delivered_at: null,
        read: false,
        read_at: null,
        created: formatDate(row.created_at),
      };
    },
  });
}
