import config from "../../../config";
import { usersRepository } from "../data-access";
import { makeInputObj } from "../entities";
import makeDataManipulation from "../entities/data-manipulation";
import { logger } from "../../libs/logger";
import createGet from "./get";
import createPost from "./post";

const errorMsgs = config.ERROR_MSG;

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

export { post, get };
