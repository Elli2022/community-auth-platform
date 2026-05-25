import { enrichPostsWithContext } from "../../db/enrich-posts";
import type { WallPostRecord } from "../../db/wall-repository";
import type makeSocialRepository from "../../db/social-repository";
import type makeUsersRepository from "../../db/users-repository";
import type makeWallRepository from "../../db/wall-repository";

type UsersRepository = ReturnType<typeof makeUsersRepository>;
type WallRepository = ReturnType<typeof makeWallRepository>;
type SocialRepository = ReturnType<typeof makeSocialRepository>;

export function createFeedGet({
  wallRepository,
  usersRepository,
  socialRepository,
  makeDataManipulation,
}: {
  wallRepository: WallRepository;
  usersRepository: UsersRepository;
  socialRepository: SocialRepository;
  makeDataManipulation: () => { transformDate: (ts: number) => string };
}) {
  const dataManipulation = makeDataManipulation();

  return Object.freeze({
    get: async (viewerUsername?: string) => {
      let posts: WallPostRecord[];
      if (viewerUsername) {
        const circle: string[] =
          await socialRepository.getFriendUsernames(viewerUsername);
        posts = await wallRepository.findByUsernames(circle);
        if (posts.length === 0) {
          posts = await wallRepository.findAll();
        }
      } else {
        posts = await wallRepository.findAll();
      }

      return enrichPostsWithContext({
        posts,
        wallRepository,
        usersRepository,
        socialRepository,
        viewerUsername,
        transformDate: dataManipulation.transformDate,
      });
    },
  });
}
