import config from "../../../config";
import { usersRepository } from "../data-access";
import { wallRepository } from "../data-access/wall";
import { socialRepository } from "../data-access/social";
import { notificationsRepository } from "../data-access/notifications";
import { messagesRepository } from "../data-access/messages";
import { makeInputObj } from "../entities";
import makeDataManipulation from "../entities/data-manipulation";
import { logger } from "../../libs/logger";
import createGet from "./get";
import createPost from "./post";
import { createWallGet, createWallPost, createSharePost } from "./wall";
import { createAuthLogin } from "./auth";
import {
  createProfileGet,
  createProfileUpdate,
  createProfileDelete,
} from "./profile";
import { createFeedGet } from "./feed";
import { createSocialActions } from "./social";
import { createNotificationsUseCase } from "./notifications";
import { createMessagesUseCase } from "./messages";

const errorMsgs = config.ERROR_MSG;

const social = createSocialActions({
  socialRepository,
  wallRepository,
  usersRepository,
  notificationsRepository,
});

const notifications = createNotificationsUseCase({
  notificationsRepository,
  usersRepository,
});

const messages = createMessagesUseCase({
  messagesRepository,
  notificationsRepository,
  socialRepository,
  usersRepository,
});

const sharePost = ({
  postId,
  authUsername,
  params,
}: {
  postId: number;
  authUsername: string;
  params: Record<string, unknown>;
}) =>
  createSharePost({
    wallRepository,
    usersRepository,
    socialRepository,
    notificationsRepository,
    makeDataManipulation,
  }).share({ postId, authUsername, params });

const post = ({ params }: { params: Record<string, unknown> }) =>
  createPost({
    makeDataManipulation,
    makeInputObj,
    usersRepository,
    logger,
  }).post({ params, errorMsgs: errorMsgs.post });

const get = () =>
  createGet({
    usersRepository,
    makeDataManipulation,
    logger,
  }).get();

const getFeed = (viewer?: string) =>
  createFeedGet({
    wallRepository,
    usersRepository,
    socialRepository,
    makeDataManipulation,
  }).get(viewer);

const getWall = (viewer?: string) =>
  createWallGet({
    wallRepository,
    usersRepository,
    socialRepository,
    makeDataManipulation,
    logger,
  }).get(viewer);

const postWall = ({
  authUsername,
  params,
}: {
  authUsername: string;
  params: Record<string, unknown>;
}) =>
  createWallPost({
    wallRepository,
    usersRepository,
    socialRepository,
    makeDataManipulation,
    logger,
  }).post({ authUsername, params, errorMsgs: errorMsgs.post });

const login = ({ params }: { params: Record<string, unknown> }) =>
  createAuthLogin({ usersRepository, makeDataManipulation, logger }).login({
    params,
    errorMsgs: errorMsgs.post,
  });

const getProfile = (username: string, viewer?: string) =>
  createProfileGet({
    usersRepository,
    wallRepository,
    socialRepository,
    makeDataManipulation,
  }).get(username, viewer);

const updateProfile = (
  username: string,
  params: Record<string, unknown>
) =>
  createProfileUpdate({ usersRepository, makeDataManipulation }).update({
    username,
    params,
  });

const deleteProfile = (
  username: string,
  params: Record<string, unknown>
) =>
  createProfileDelete({ usersRepository }).delete({
    username,
    params,
    errorMsgs: errorMsgs.post,
  });

export {
  post,
  get,
  getFeed,
  getWall,
  postWall,
  sharePost,
  login,
  getProfile,
  updateProfile,
  deleteProfile,
  social,
  notifications,
  messages,
};
