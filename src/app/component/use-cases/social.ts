import sanitizeHtml from "sanitize-html";
import type makeSocialRepository from "../../db/social-repository";
import type makeWallRepository from "../../db/wall-repository";
import type makeUsersRepository from "../../db/users-repository";
import type makeNotificationsRepository from "../../db/notifications-repository";
import { avatarUrlFor } from "../../db/map-user";
import { enrichPostsWithContext } from "../../db/enrich-posts";
import makeDataManipulation from "../entities/data-manipulation";

const sanitize = (text: string) =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

type SocialRepository = ReturnType<typeof makeSocialRepository>;
type WallRepository = ReturnType<typeof makeWallRepository>;
type UsersRepository = ReturnType<typeof makeUsersRepository>;
type NotificationsRepository = ReturnType<typeof makeNotificationsRepository>;

export function createSocialActions({
  socialRepository,
  wallRepository,
  usersRepository,
  notificationsRepository,
}: {
  socialRepository: SocialRepository;
  wallRepository: WallRepository;
  usersRepository: UsersRepository;
  notificationsRepository: NotificationsRepository;
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    toggleLike: async (postId: number, username: string) => {
      const post = await wallRepository.findById(postId);
      if (!post) throw new Error("Inlägget finns inte");
      const liked = await socialRepository.toggleLike(postId, username);
      if (liked) {
        await notificationsRepository.create({
          recipient: post.username,
          actor: username,
          type: "like",
          ref_id: postId,
          preview: "gillade ditt inlägg",
        });
      }
      const counts = await socialRepository.getLikeCounts([postId]);
      return { liked, likes_count: counts.get(postId) ?? 0 };
    },

    addComment: async ({
      postId,
      username,
      message,
    }: {
      postId: number;
      username: string;
      message: string;
    }) => {
      const post = await wallRepository.findById(postId);
      if (!post) throw new Error("Inlägget finns inte");
      const trimmed = sanitize(message.trim());
      if (!trimmed) throw new Error("Kommentar krävs");
      if (trimmed.length > 300) throw new Error("Max 300 tecken");

      await socialRepository.addComment({ postId, username, message: trimmed });

      await notificationsRepository.create({
        recipient: post.username,
        actor: username,
        type: "comment",
        ref_id: postId,
        preview: trimmed.slice(0, 120),
      });

      const users = await usersRepository.findByUsernames([username, post.username]);
      const usersByName = new Map(users.map((u) => [u.username, u]));
      const enriched = await enrichPostsWithContext({
        posts: [post],
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername: username,
        transformDate: dataManipulation.transformDate,
      });

      return {
        comment: enriched[0].comments[enriched[0].comments.length - 1],
        comments_count: enriched[0].comments.length,
      };
    },

    listFriends: async (username: string) => {
      const friends = await socialRepository.listFriends(username);
      const incoming = await socialRepository.listPendingIncoming(username);
      const outgoing = await socialRepository.listPendingOutgoing(username);
      const allNames = [...new Set([...friends, ...incoming, ...outgoing])];
      const users = await usersRepository.findByUsernames(allNames);
      const byName = new Map(users.map((u) => [u.username, u]));

      const mapUser = (name: string) => {
        const u = byName.get(name);
        return u
          ? {
              username: name,
              display_name: u.name && u.surname ? `${u.name} ${u.surname}` : u.name || name,
              avatar_url: avatarUrlFor(u),
            }
          : { username: name, display_name: name, avatar_url: "/avatars/1.svg" };
      };

      return {
        friends: friends.map(mapUser),
        pending_incoming: incoming.map(mapUser),
        pending_outgoing: outgoing.map(mapUser),
      };
    },

    sendFriendRequest: async (from: string, to: string) => {
      const target = await usersRepository.findByUsername(to);
      if (!target) throw new Error("Användaren finns inte");
      await socialRepository.sendFriendRequest(from, to);
      await notificationsRepository.create({
        recipient: to,
        actor: from,
        type: "friend_request",
        preview: "vill bli vän",
      });
      return { ok: true, to };
    },

    acceptFriendRequest: async (accepter: string, from: string) => {
      await socialRepository.acceptFriendRequest(accepter, from);
      await notificationsRepository.create({
        recipient: from,
        actor: accepter,
        type: "friend_accepted",
        preview: "accepterade din vänförfrågan",
      });
      return { ok: true, from };
    },

    removeFriend: async (a: string, b: string) => {
      await socialRepository.removeFriendship(a, b);
      return { ok: true };
    },
  });
}
