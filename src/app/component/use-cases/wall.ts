import sanitizeHtml from "sanitize-html";
import { parseDataUrl } from "../../libs/image";
import { enrichPostsWithContext } from "../../db/enrich-posts";
import type makeUsersRepository from "../../db/users-repository";
import type makeWallRepository from "../../db/wall-repository";
import type makeSocialRepository from "../../db/social-repository";
import type makeNotificationsRepository from "../../db/notifications-repository";

type UsersRepository = ReturnType<typeof makeUsersRepository>;
type WallRepository = ReturnType<typeof makeWallRepository>;
type SocialRepository = ReturnType<typeof makeSocialRepository>;
type NotificationsRepository = ReturnType<typeof makeNotificationsRepository>;

const sanitize = (text: string) =>
  sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} });

export function createWallGet({
  wallRepository,
  usersRepository,
  socialRepository,
  makeDataManipulation,
  logger,
}: {
  wallRepository: WallRepository;
  usersRepository: UsersRepository;
  socialRepository: SocialRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
  logger: { info: (message: string) => void };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    get: async (viewerUsername?: string) => {
      logger.info("[USE-CASE][WALL][GET] - START");
      const posts = await wallRepository.findAll();
      const result = await enrichPostsWithContext({
        posts,
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername,
        transformDate: dataManipulation.transformDate,
      });
      logger.info("[USE-CASE][WALL][GET] - DONE");
      return result;
    },
  });
}

export function createWallPost({
  wallRepository,
  usersRepository,
  socialRepository,
  makeDataManipulation,
  logger,
}: {
  wallRepository: WallRepository;
  usersRepository: UsersRepository;
  socialRepository: SocialRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
  logger: { info: (message: string) => void };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    post: async ({
      authUsername,
      params,
      errorMsgs,
    }: {
      authUsername: string;
      params: Record<string, unknown>;
      errorMsgs: Record<string, string>;
    }) => {
      const rawMessage =
        typeof params.message === "string" ? params.message.trim() : "";
      const imageRaw =
        typeof params.image_data === "string" ? params.image_data.trim() : "";

      if (!rawMessage && !imageRaw) {
        throw new Error(errorMsgs.WALL_MESSAGE_REQUIRED);
      }
      if (rawMessage.length > 500) {
        throw new Error("message must be 500 characters or less");
      }

      const user = await usersRepository.findByUsername(authUsername);
      if (!user) {
        throw new Error(errorMsgs.WALL_USER_NOT_FOUND);
      }

      let image_data: string | null = null;
      if (imageRaw) {
        parseDataUrl(imageRaw);
        image_data = imageRaw;
      }

      const message = rawMessage ? sanitize(rawMessage) : "";
      logger.info(`[USE-CASE][WALL][POST] @${authUsername} - START`);
      const row = await wallRepository.create({
        username: authUsername,
        message: message || " ",
        image_data,
      });
      logger.info(`[USE-CASE][WALL][POST] @${authUsername} - DONE`);

      const enriched = await enrichPostsWithContext({
        posts: [row],
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername: authUsername,
        transformDate: dataManipulation.transformDate,
      });
      return enriched[0];
    },
  });
}

export function createSharePost({
  wallRepository,
  usersRepository,
  socialRepository,
  notificationsRepository,
  makeDataManipulation,
}: {
  wallRepository: WallRepository;
  usersRepository: UsersRepository;
  socialRepository: SocialRepository;
  notificationsRepository: NotificationsRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    share: async ({
      postId,
      authUsername,
      params,
    }: {
      postId: number;
      authUsername: string;
      params: Record<string, unknown>;
    }) => {
      const original = await wallRepository.findById(postId);
      if (!original) throw new Error("Inlägget finns inte");

      const comment =
        typeof params.message === "string"
          ? sanitize(params.message.trim()).slice(0, 300)
          : "";

      const row = await wallRepository.create({
        username: authUsername,
        message: comment || " ",
        shared_post_id: postId,
      });

      await notificationsRepository.create({
        recipient: original.username,
        actor: authUsername,
        type: "share",
        ref_id: row.id,
        preview: comment || "delade ditt inlägg",
      });

      const users = await usersRepository.findByUsernames([
        authUsername,
        original.username,
      ]);
      const usersByName = new Map(users.map((u) => [u.username, u]));

      const enriched = await enrichPostsWithContext({
        posts: [row],
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername: authUsername,
        transformDate: dataManipulation.transformDate,
      });
      return enriched[0];
    },
  });
}
