import { avatarUrlFor, mapUserToResponse } from "./map-user";
import type { UserRecord } from "./users-repository";
import type { WallPostRecord } from "./wall-repository";
import type makeSocialRepository from "./social-repository";

type SocialRepository = ReturnType<typeof makeSocialRepository>;

function formatDate(value: Date | string) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("sv-SE");
}

function displayName(user: UserRecord) {
  if (user.name && user.surname) return `${user.name} ${user.surname}`;
  if (user.name) return user.name;
  return user.username;
}

function mapAuthor(
  author: UserRecord | undefined,
  post: WallPostRecord,
  transformDate: (ts: number) => string
) {
  return author
    ? { ...mapUserToResponse(author, transformDate), display_name: displayName(author) }
    : {
        username: post.username,
        display_name: post.username,
        avatar_url: `/avatars/1.svg`,
      };
}

function mapPostCore(
  post: WallPostRecord,
  author: UserRecord | undefined,
  likeCounts: Map<number, number>,
  liked: Set<number>,
  commentsMap: Map<number, { id: number; username: string; message: string; created_at: Date | string }[]>,
  usersByName: Map<string, UserRecord>,
  transformDate: (ts: number) => string
) {
  const comments = (commentsMap.get(post.id) ?? []).map((c) => {
    const cu = usersByName.get(c.username);
    return {
      id: c.id,
      username: c.username,
      message: c.message,
      created: formatDate(c.created_at),
      author: cu
        ? { username: cu.username, display_name: displayName(cu), avatar_url: avatarUrlFor(cu) }
        : { username: c.username, display_name: c.username, avatar_url: "/avatars/1.svg" },
    };
  });

  return {
    id: post.id,
    username: post.username,
    message: post.message,
    created: formatDate(post.created_at),
    shared_post_id: post.shared_post_id,
    has_image: Boolean(post.image_data),
    image_url: post.image_data ? `/api/v1/posts/${post.id}/image` : null,
    likes_count: likeCounts.get(post.id) ?? 0,
    liked_by_me: liked.has(post.id),
    comments_count: comments.length,
    comments,
    author: mapAuthor(author, post, transformDate),
  };
}

export async function enrichPosts({
  posts,
  usersByName,
  socialRepository,
  viewerUsername,
  transformDate,
  sharedPostsById,
}: {
  posts: WallPostRecord[];
  usersByName: Map<string, UserRecord>;
  socialRepository: SocialRepository;
  viewerUsername?: string;
  transformDate: (ts: number) => string;
  sharedPostsById?: Map<number, WallPostRecord>;
}) {
  const ids = posts.map((p) => p.id);
  const likeCounts = await socialRepository.getLikeCounts(ids);
  const liked = await socialRepository.getLikedByViewer(ids, viewerUsername);
  const commentsMap = await socialRepository.getCommentsForPosts(ids);

  const sharedIds = posts
    .map((p) => p.shared_post_id)
    .filter((id): id is number => id != null);
  const sharedLikeIds = sharedPostsById
    ? [...sharedPostsById.values()].map((p) => p.id)
    : [];
  const allLikeIds = [...new Set([...ids, ...sharedLikeIds])];
  const sharedLikeCounts =
    sharedLikeIds.length > 0
      ? await socialRepository.getLikeCounts(allLikeIds)
      : likeCounts;

  return posts.map((post) => {
    const author = usersByName.get(post.username);
    const base = mapPostCore(
      post,
      author,
      likeCounts,
      liked,
      commentsMap,
      usersByName,
      transformDate
    );

    if (post.shared_post_id && sharedPostsById) {
      const orig = sharedPostsById.get(post.shared_post_id);
      if (orig) {
        const origAuthor = usersByName.get(orig.username);
        return {
          ...base,
          shared_post: {
            ...mapPostCore(
              orig,
              origAuthor,
              sharedLikeCounts,
              liked,
              new Map(),
              usersByName,
              transformDate
            ),
          },
        };
      }
    }

    return { ...base, shared_post: null };
  });
}

export async function loadSharedPostsMap(
  posts: WallPostRecord[],
  findByIds: (ids: number[]) => Promise<WallPostRecord[]>
): Promise<Map<number, WallPostRecord>> {
  const ids = [...new Set(posts.map((p) => p.shared_post_id).filter((id): id is number => id != null))];
  const shared = await findByIds(ids);
  return new Map(shared.map((p) => [p.id, p]));
}

export async function enrichPostsWithContext({
  posts,
  wallRepository,
  usersRepository,
  socialRepository,
  viewerUsername,
  transformDate,
}: {
  posts: WallPostRecord[];
  wallRepository: { findByIds: (ids: number[]) => Promise<WallPostRecord[]> };
  usersRepository: { findByUsernames: (names: string[]) => Promise<UserRecord[]> };
  socialRepository: SocialRepository;
  viewerUsername?: string;
  transformDate: (ts: number) => string;
}) {
  const sharedMap = await loadSharedPostsMap(posts, wallRepository.findByIds);
  const names = new Set(posts.map((p) => p.username));
  for (const s of sharedMap.values()) names.add(s.username);
  const users = await usersRepository.findByUsernames([...names]);
  const usersByName = new Map(users.map((u) => [u.username, u]));
  return enrichPosts({
    posts,
    usersByName,
    socialRepository,
    viewerUsername,
    transformDate,
    sharedPostsById: sharedMap,
  });
}
