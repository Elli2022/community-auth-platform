import bcrypt from "bcrypt";
import sanitizeHtml from "sanitize-html";
import { parseDataUrl } from "../../libs/image";
import { mapUserToResponse } from "../../db/map-user";
import { enrichPostsWithContext } from "../../db/enrich-posts";
import type makeUsersRepository from "../../db/users-repository";
import type makeWallRepository from "../../db/wall-repository";
import type makeSocialRepository from "../../db/social-repository";

type UsersRepository = ReturnType<typeof makeUsersRepository>;
type WallRepository = ReturnType<typeof makeWallRepository>;
type SocialRepository = ReturnType<typeof makeSocialRepository>;

const sanitize = (text: string) =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

export function createProfileGet({
  usersRepository,
  wallRepository,
  socialRepository,
  makeDataManipulation,
}: {
  usersRepository: UsersRepository;
  wallRepository: WallRepository;
  socialRepository: SocialRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    get: async (username: string, viewerUsername?: string) => {
      const user = await usersRepository.findByUsername(username);
      if (!user) throw new Error("user not found");

      const posts = await wallRepository.findByUsername(username);
      const enrichedPosts = await enrichPostsWithContext({
        posts,
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername,
        transformDate: dataManipulation.transformDate,
      });

      const profile = mapUserToResponse(user, dataManipulation.transformDate);
      let friendStatus: string | null = null;
      if (viewerUsername && viewerUsername !== username) {
        const friends = await socialRepository.listFriends(viewerUsername);
        const incoming = await socialRepository.listPendingIncoming(viewerUsername);
        const outgoing = await socialRepository.listPendingOutgoing(viewerUsername);
        if (friends.includes(username)) friendStatus = "friends";
        else if (incoming.includes(username)) friendStatus = "pending_incoming";
        else if (outgoing.includes(username)) friendStatus = "pending_outgoing";
        else friendStatus = "none";
      }

      return {
        ...profile,
        posts: enrichedPosts,
        isOwner: viewerUsername === username,
        friend_status: friendStatus,
      };
    },
  });
}

export function createProfileUpdate({
  usersRepository,
  makeDataManipulation,
}: {
  usersRepository: UsersRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    update: async ({
      username,
      params,
    }: {
      username: string;
      params: Record<string, unknown>;
    }) => {
      const update: Parameters<UsersRepository["updateProfile"]>[1] = {
        modified: new Date().toISOString(),
      };

      if (params.use_preset_avatar === true) {
        update.avatar_type = "preset";
        update.avatar_image = null;
        const avatarRaw = params.avatar_id;
        if (avatarRaw !== undefined) {
          const avatar_id = Number(avatarRaw);
          if (!Number.isInteger(avatar_id) || avatar_id < 1 || avatar_id > 5) {
            throw new Error("avatar_id must be between 1 and 5");
          }
          update.avatar_id = avatar_id;
        }
      } else if (typeof params.avatar_image === "string" && params.avatar_image) {
        parseDataUrl(params.avatar_image);
        update.avatar_type = "custom";
        update.avatar_image = params.avatar_image;
      } else {
        const avatarRaw = params.avatar_id;
        if (avatarRaw !== undefined) {
          const avatar_id = Number(avatarRaw);
          if (!Number.isInteger(avatar_id) || avatar_id < 1 || avatar_id > 5) {
            throw new Error("avatar_id must be between 1 and 5");
          }
          update.avatar_id = avatar_id;
        }
      }

      if (typeof params.bio === "string") {
        update.bio = sanitize(params.bio).slice(0, 280);
      }
      if (typeof params.name === "string") update.name = sanitize(params.name);
      if (typeof params.surname === "string") {
        update.surname = sanitize(params.surname);
      }
      if (typeof params.cover_color === "string") {
        const c = params.cover_color.trim();
        if (/^#[0-9A-Fa-f]{6}$/.test(c)) update.cover_color = c;
      }

      const row = await usersRepository.updateProfile(username, update);
      return mapUserToResponse(row, dataManipulation.transformDate);
    },
  });
}

export function createProfileDelete({
  usersRepository,
}: {
  usersRepository: UsersRepository;
}) {
  return Object.freeze({
    delete: async ({
      username,
      params,
      errorMsgs,
    }: {
      username: string;
      params: Record<string, unknown>;
      errorMsgs: Record<string, string>;
    }) => {
      const password =
        typeof params.password === "string" ? params.password : "";
      if (!password) {
        throw new Error(errorMsgs.MISSING_PARAMETER + "password");
      }

      const user = await usersRepository.findByUsername(username);
      if (!user) throw new Error("user not found");

      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) throw new Error(errorMsgs.INVALID_CREDENTIALS);

      await usersRepository.deleteByUsername(username);
      return { deleted: true, username };
    },
  });
}
