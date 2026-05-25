import type { Response } from "express";
import { mimeFromDataUrl } from "../../libs/image";
import { logger } from "../../libs/logger";
import { usersRepository } from "../data-access";
import { wallRepository } from "../data-access/wall";
import {
  post,
  get,
  getFeed,
  getWall,
  postWall,
  login,
  getProfile,
  updateProfile,
  deleteProfile,
  social,
  notifications,
  messages,
  sharePost,
} from "../use-cases";
import {
  requireAuth,
  requireSelf,
  type AuthedRequest,
} from "../../middleware/require-auth";
import { optionalAuth } from "../../middleware/optional-auth";

const baseUrl = "/api/v1";

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "Ett oväntat fel inträffade";
}

function stripPassword<T extends Record<string, unknown>>(user: T): Omit<T, "password"> {
  const { password: _removed, ...safe } = user;
  return safe;
}

function stripPasswords(users: unknown): unknown[] {
  if (!Array.isArray(users)) return [];
  return users.map((u) =>
    typeof u === "object" && u !== null
      ? stripPassword(u as Record<string, unknown>)
      : u
  );
}

function routeUsername(req: AuthedRequest): string {
  const u = req.params.username;
  return Array.isArray(u) ? u[0] : u;
}

function routePostId(req: AuthedRequest): number {
  const raw = req.params.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw);
  if (!Number.isInteger(id) || id < 1) throw new Error("Ogiltigt inläggs-id");
  return id;
}

function sendImageFromDataUrl(res: Response, dataUrl: string) {
  const mime = mimeFromDataUrl(dataUrl);
  const base64 = dataUrl.split(",")[1] ?? "";
  const buf = Buffer.from(base64, "base64");
  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(buf);
}

const getEP = async (_req: AuthedRequest, res: Response) => {
  try {
    const results = await get();
    res.json({ err: 0, data: stripPasswords(results) });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const postEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await post({ params: req.body });
    res.status(201).json({
      err: 0,
      data: stripPassword(results as Record<string, unknown>),
    });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const loginEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await login({ params: req.body });
    res.json({ err: 0, data: results });
  } catch (err) {
    const msg = errorMessage(err);
    const invalid =
      msg === "Invalid credentials" || msg.includes("Invalid credentials");
    res.status(invalid ? 401 : 400).json({
      err: 1,
      message: invalid ? "Fel användarnamn eller lösenord" : msg,
    });
  }
};

const getFeedEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await getFeed(req.authUsername);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getWallEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await getWall(req.authUsername);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const postWallEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await postWall({
      authUsername: req.authUsername!,
      params: req.body,
    });
    res.status(201).json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getProfileEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await getProfile(routeUsername(req), req.authUsername);
    res.json({ err: 0, data: results });
  } catch (err) {
    const msg = errorMessage(err);
    res.status(msg.includes("not found") ? 404 : 400).json({
      err: 1,
      message: msg.includes("not found") ? "Användaren finns inte" : msg,
    });
  }
};

const patchProfileEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await updateProfile(routeUsername(req), req.body);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const deleteProfileEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await deleteProfile(routeUsername(req), req.body);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getAvatarEP = async (req: AuthedRequest, res: Response) => {
  try {
    const dataUrl = await usersRepository.getAvatarImage(routeUsername(req));
    if (!dataUrl) {
      res.status(404).json({ err: 1, message: "Ingen profilbild" });
      return;
    }
    sendImageFromDataUrl(res, dataUrl);
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getPostImageEP = async (req: AuthedRequest, res: Response) => {
  try {
    const dataUrl = await wallRepository.getPostImage(routePostId(req));
    if (!dataUrl) {
      res.status(404).json({ err: 1, message: "Ingen bild" });
      return;
    }
    sendImageFromDataUrl(res, dataUrl);
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const likePostEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await social.toggleLike(
      routePostId(req),
      req.authUsername!
    );
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const commentPostEP = async (req: AuthedRequest, res: Response) => {
  try {
    const message =
      typeof req.body.message === "string" ? req.body.message : "";
    const results = await social.addComment({
      postId: routePostId(req),
      username: req.authUsername!,
      message,
    });
    res.status(201).json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getFriendsEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await social.listFriends(req.authUsername!);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const friendRequestEP = async (req: AuthedRequest, res: Response) => {
  try {
    const to =
      typeof req.body.username === "string" ? req.body.username.trim() : "";
    if (!to) throw new Error("Användarnamn krävs");
    const results = await social.sendFriendRequest(req.authUsername!, to);
    res.status(201).json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const friendAcceptEP = async (req: AuthedRequest, res: Response) => {
  try {
    const from =
      typeof req.body.username === "string" ? req.body.username.trim() : "";
    if (!from) throw new Error("Användarnamn krävs");
    const results = await social.acceptFriendRequest(req.authUsername!, from);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const sharePostEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await sharePost({
      postId: routePostId(req),
      authUsername: req.authUsername!,
      params: req.body,
    });
    res.status(201).json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getNotificationsEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await notifications.list(req.authUsername!);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const markNotificationsEP = async (req: AuthedRequest, res: Response) => {
  try {
    const id = req.body?.id != null ? Number(req.body.id) : undefined;
    const results = await notifications.markRead(req.authUsername!, id);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getConversationsEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await messages.listConversations(req.authUsername!);
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const getMessagesEP = async (req: AuthedRequest, res: Response) => {
  try {
    const results = await messages.getThread(
      req.authUsername!,
      routeUsername(req)
    );
    res.json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const postMessageEP = async (req: AuthedRequest, res: Response) => {
  try {
    const body =
      typeof req.body.body === "string" ? req.body.body : "";
    const results = await messages.send(
      req.authUsername!,
      routeUsername(req),
      body
    );
    res.status(201).json({ err: 0, data: results });
  } catch (err) {
    res.status(400).json({ err: 1, message: errorMessage(err) });
  }
};

const routes = [
  { path: `${baseUrl}/auth/login`, method: "post" as const, component: loginEP },
  { path: `${baseUrl}/feed`, method: "get" as const, component: [optionalAuth, getFeedEP] },
  { path: `${baseUrl}/friends`, method: "get" as const, component: [requireAuth, getFriendsEP] },
  {
    path: `${baseUrl}/friends/request`,
    method: "post" as const,
    component: [requireAuth, friendRequestEP],
  },
  {
    path: `${baseUrl}/friends/accept`,
    method: "post" as const,
    component: [requireAuth, friendAcceptEP],
  },
  {
    path: `${baseUrl}/users/:username/avatar`,
    method: "get" as const,
    component: getAvatarEP,
  },
  {
    path: `${baseUrl}/users/:username`,
    method: "get" as const,
    component: [optionalAuth, getProfileEP],
  },
  {
    path: `${baseUrl}/users/:username`,
    method: "patch" as const,
    component: [requireAuth, requireSelf, patchProfileEP],
  },
  {
    path: `${baseUrl}/users/:username`,
    method: "delete" as const,
    component: [requireAuth, requireSelf, deleteProfileEP],
  },
  {
    path: `${baseUrl}/posts/:id/image`,
    method: "get" as const,
    component: getPostImageEP,
  },
  {
    path: `${baseUrl}/posts/:id/like`,
    method: "post" as const,
    component: [requireAuth, likePostEP],
  },
  {
    path: `${baseUrl}/posts/:id/comments`,
    method: "post" as const,
    component: [requireAuth, commentPostEP],
  },
  {
    path: `${baseUrl}/posts/:id/share`,
    method: "post" as const,
    component: [requireAuth, sharePostEP],
  },
  {
    path: `${baseUrl}/notifications`,
    method: "get" as const,
    component: [requireAuth, getNotificationsEP],
  },
  {
    path: `${baseUrl}/notifications/read`,
    method: "patch" as const,
    component: [requireAuth, markNotificationsEP],
  },
  {
    path: `${baseUrl}/messages`,
    method: "get" as const,
    component: [requireAuth, getConversationsEP],
  },
  {
    path: `${baseUrl}/messages/:username`,
    method: "get" as const,
    component: [requireAuth, getMessagesEP],
  },
  {
    path: `${baseUrl}/messages/:username`,
    method: "post" as const,
    component: [requireAuth, postMessageEP],
  },
  { path: `${baseUrl}/wall`, method: "get" as const, component: [optionalAuth, getWallEP] },
  { path: `${baseUrl}/wall`, method: "post" as const, component: [requireAuth, postWallEP] },
  { path: `${baseUrl}/`, method: "get" as const, component: getEP },
  { path: `${baseUrl}/`, method: "post" as const, component: postEP },
];

export { routes };
